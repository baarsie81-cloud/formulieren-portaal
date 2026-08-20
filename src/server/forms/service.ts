import "server-only";

import { and, asc, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { FORM_REQUEST_TTL_DAYS } from "@/lib/constants";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/audit/actions";
import { writeUserAuditEvent } from "@/server/audit/log";
import type { TenantContext } from "@/server/auth/tenant";
import { getClient } from "@/server/clients/service";
import { getDb } from "@/server/db";
import {
  documentTemplates,
  formDocuments,
  formRequests,
  formSessions,
  organizations,
  secureTokens,
} from "@/server/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import type { CreateFormRequestInput } from "@/server/forms/schema";
import { formRequestIdSchema } from "@/server/forms/schema";
import { documentsInRequest, requestInOrganization } from "@/server/forms/scope";
import { toFieldsSchemaSnapshot } from "@/server/forms/snapshot";
import {
  effectiveRequestStatus,
  isWritableRequestStatus,
} from "@/server/forms/status";
import { generateRawSecret, hashSecret } from "@/server/forms/token";
import { extractPdfPageSizes } from "@/server/pdf/fields";
import { getTemplate, listTemplateFields, readTemplatePdfBytes } from "@/server/templates/service";

function parseRequestId(requestId: string): string {
  const parsed = formRequestIdSchema.safeParse(requestId);

  if (!parsed.success) {
    throw new NotFoundError("Form request not found");
  }

  return parsed.data;
}

export async function countFormRequests(tenant: TenantContext) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(formRequests)
    .where(eq(formRequests.organizationId, tenant.organizationId));

  return row?.value ?? 0;
}

export async function listFormRequests(tenant: TenantContext) {
  const rows = await getDb()
    .select({
      request: formRequests,
      templateName: documentTemplates.name,
    })
    .from(formRequests)
    .innerJoin(
      formDocuments,
      and(
        eq(formDocuments.organizationId, formRequests.organizationId),
        eq(formDocuments.formRequestId, formRequests.id),
      ),
    )
    .innerJoin(
      documentTemplates,
      and(
        eq(documentTemplates.organizationId, formRequests.organizationId),
        eq(documentTemplates.id, formDocuments.documentTemplateId),
      ),
    )
    .where(eq(formRequests.organizationId, tenant.organizationId))
    .orderBy(desc(formRequests.createdAt), asc(formDocuments.sortOrder));

  return rows.map((row) => ({
    ...row.request,
    templateName: row.templateName,
    status: effectiveRequestStatus(row.request.status, row.request.expiresAt),
  }));
}

export async function getFormRequest(tenant: TenantContext, requestId: string) {
  const id = parseRequestId(requestId);
  const db = getDb();

  const [row] = await db
    .select({
      request: formRequests,
      document: formDocuments,
      templateName: documentTemplates.name,
      organizationName: organizations.name,
    })
    .from(formRequests)
    .innerJoin(
      formDocuments,
      and(
        eq(formDocuments.organizationId, formRequests.organizationId),
        eq(formDocuments.formRequestId, formRequests.id),
      ),
    )
    .innerJoin(
      documentTemplates,
      and(
        eq(documentTemplates.organizationId, formRequests.organizationId),
        eq(documentTemplates.id, formDocuments.documentTemplateId),
      ),
    )
    .innerJoin(organizations, eq(organizations.id, formRequests.organizationId))
    .where(requestInOrganization(tenant.organizationId, id))
    .orderBy(asc(formDocuments.sortOrder))
    .limit(1);

  if (!row) {
    throw new NotFoundError("Form request not found");
  }

  const status = effectiveRequestStatus(row.request.status, row.request.expiresAt);

  if (status === "expired" && row.request.status !== "expired") {
    await markRequestExpired(tenant.organizationId, row.request.id);
    row.request.status = "expired";
  }

  const [activeToken] = await db
    .select({ id: secureTokens.id, expiresAt: secureTokens.expiresAt })
    .from(secureTokens)
    .where(
      and(
        eq(secureTokens.organizationId, tenant.organizationId),
        eq(secureTokens.formRequestId, row.request.id),
        isNull(secureTokens.revokedAt),
      ),
    )
    .limit(1);

  const fillSubmitted = await hasSubmittedFill(tenant.organizationId, row.request.id);
  const isFinalized = row.document.status === "finalized";

  return {
    request: { ...row.request, status },
    document: row.document,
    templateName: row.templateName,
    organizationName: row.organizationName,
    hasActiveToken: Boolean(activeToken) && status !== "expired" && status !== "cancelled",
    fillSubmitted,
    isFinalized,
    canCancel: isWritableRequestStatus(status) && !isFinalized,
    canRotateToken: isWritableRequestStatus(status) && !isFinalized,
  };
}

export async function createFormRequest(
  tenant: TenantContext,
  input: CreateFormRequestInput,
) {
  const client = await getClient(tenant, input.clientId);

  if (client.archivedAt) {
    throw new ConflictError("Archived clients cannot receive forms");
  }

  const template = await getTemplate(tenant, input.templateId);

  if (template.status !== "active") {
    throw new ConflictError("Archived templates cannot be sent");
  }

  const fields = await listTemplateFields(tenant, template.id);

  if (fields.length === 0) {
    throw new ValidationError("Template has no AcroForm fields");
  }

  const fieldsForSnapshot = await withPageSizesForSnapshot(tenant, template.id, fields);
  const snapshot = toFieldsSchemaSnapshot(fieldsForSnapshot);
  const rawToken = generateRawSecret();
  const tokenHash = hashSecret(rawToken);
  const expiresAt = new Date(Date.now() + FORM_REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();

  const request = await db.transaction(async (tx) => {
    const [createdRequest] = await tx
      .insert(formRequests)
      .values({
        organizationId: tenant.organizationId,
        clientId: client.id,
        createdByUserId: tenant.userId,
        recipientName: client.displayName,
        recipientEmail: client.email,
        status: "sent",
        expiresAt,
      })
      .returning();

    if (!createdRequest) {
      throw new Error("Failed to create form request");
    }

    const [document] = await tx
      .insert(formDocuments)
      .values({
        organizationId: tenant.organizationId,
        formRequestId: createdRequest.id,
        documentTemplateId: template.id,
        sortOrder: 0,
        templateBlobKey: template.blobKey,
        templateSha256: template.sha256,
        fieldsSchemaSnapshot: snapshot,
        fieldValues: {},
        status: "pending",
      })
      .returning();

    if (!document) {
      throw new Error("Failed to create form document");
    }

    await tx.insert(secureTokens).values({
      organizationId: tenant.organizationId,
      formRequestId: createdRequest.id,
      tokenHash,
      expiresAt,
    });

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.FORM_REQUEST_CREATED,
      entityType: AUDIT_ENTITY_TYPES.FORM_REQUEST,
      entityId: createdRequest.id,
      formRequestId: createdRequest.id,
      formDocumentId: document.id,
      metadata: {
        templateId: template.id,
        fieldCount: snapshot.length,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return createdRequest;
  });

  return { request, rawToken };
}

export async function cancelFormRequest(tenant: TenantContext, requestId: string) {
  const existing = await getFormRequest(tenant, requestId);

  if (!existing.canCancel) {
    throw new ConflictError("Form request cannot be cancelled");
  }

  const now = new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const [request] = await tx
      .update(formRequests)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelReason: "Cancelled by staff",
      })
      .where(requestInOrganization(tenant.organizationId, existing.request.id))
      .returning();

    if (!request) {
      throw new NotFoundError("Form request not found");
    }

    await tx
      .update(formDocuments)
      .set({ status: "cancelled" })
      .where(documentsInRequest(tenant.organizationId, existing.request.id));

    await revokeActiveTokensAndSessions(tx, tenant.organizationId, existing.request.id, now);

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.FORM_REQUEST_CANCELLED,
      entityType: AUDIT_ENTITY_TYPES.FORM_REQUEST,
      entityId: request.id,
      formRequestId: request.id,
    });

    return request;
  });
}

export async function rotateFormRequestToken(tenant: TenantContext, requestId: string) {
  const existing = await getFormRequest(tenant, requestId);

  if (!existing.canRotateToken) {
    throw new ConflictError("Form request token cannot be rotated");
  }

  const rawToken = generateRawSecret();
  const tokenHash = hashSecret(rawToken);
  const now = new Date();
  const db = getDb();

  await db.transaction(async (tx) => {
    await revokeActiveTokensAndSessions(tx, tenant.organizationId, existing.request.id, now);

    await tx.insert(secureTokens).values({
      organizationId: tenant.organizationId,
      formRequestId: existing.request.id,
      tokenHash,
      expiresAt: existing.request.expiresAt,
    });

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.FORM_REQUEST_TOKEN_ROTATED,
      entityType: AUDIT_ENTITY_TYPES.FORM_REQUEST,
      entityId: existing.request.id,
      formRequestId: existing.request.id,
    });
  });

  return { requestId: existing.request.id, rawToken };
}

async function hasSubmittedFill(organizationId: string, requestId: string) {
  const [submitted] = await getDb()
    .select({ id: formSessions.id })
    .from(formSessions)
    .where(
      and(
        eq(formSessions.organizationId, organizationId),
        eq(formSessions.formRequestId, requestId),
        isNotNull(formSessions.completedAt),
      ),
    )
    .limit(1);

  return Boolean(submitted);
}

async function markRequestExpired(organizationId: string, requestId: string) {
  await getDb()
    .update(formRequests)
    .set({ status: "expired" })
    .where(
      and(
        requestInOrganization(organizationId, requestId),
        inArray(formRequests.status, ["sent", "opened", "in_progress"]),
      ),
    );
}

async function revokeActiveTokensAndSessions(
  tx: Pick<ReturnType<typeof getDb>, "update">,
  organizationId: string,
  requestId: string,
  now: Date,
) {
  await tx
    .update(secureTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(secureTokens.organizationId, organizationId),
        eq(secureTokens.formRequestId, requestId),
        isNull(secureTokens.revokedAt),
      ),
    );

  await tx
    .update(formSessions)
    .set({ revokedAt: now })
    .where(
      and(
        eq(formSessions.organizationId, organizationId),
        eq(formSessions.formRequestId, requestId),
        isNull(formSessions.revokedAt),
      ),
    );
}

async function withPageSizesForSnapshot<
  T extends {
    pageNumber: number;
    pageWidth: number | null;
    pageHeight: number | null;
  },
>(tenant: TenantContext, templateId: string, fields: T[]): Promise<T[]> {
  if (fields.every((field) => field.pageWidth != null && field.pageHeight != null)) {
    return fields;
  }

  const { bytes } = await readTemplatePdfBytes(tenant, templateId);
  const pageSizes = await extractPdfPageSizes(bytes);
  const byPage = new Map(pageSizes.map((page) => [page.pageNumber, page]));

  return fields.map((field) => {
    const page = byPage.get(field.pageNumber);

    return {
      ...field,
      pageWidth: field.pageWidth ?? page?.width ?? null,
      pageHeight: field.pageHeight ?? page?.height ?? null,
    };
  });
}
