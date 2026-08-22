import "server-only";

import { and, asc, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { FORM_REQUEST_TTL_DAYS } from "@/lib/constants";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/audit/actions";
import { writeUserAuditEvent } from "@/server/audit/log";
import type { TenantContext } from "@/server/auth/tenant";
import { getClient } from "@/server/clients/service";
import { getDb } from "@/server/db";
import {
  acceptances,
  auditEvents,
  documentTemplates,
  emailEvents,
  formDocuments,
  formRequests,
  formSessions,
  organizations,
  reminderDeliveries,
  secureTokens,
  signatures,
} from "@/server/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import type { CreateFormRequestInput } from "@/server/forms/schema";
import {
  formRequestIdSchema,
  PERMANENT_DELETE_CONFIRMATION,
} from "@/server/forms/schema";
import {
  activeRequestsInOrganization,
  archivedRequestsInOrganization,
  documentsInRequest,
  requestInOrganization,
} from "@/server/forms/scope";
import { toFieldsSchemaSnapshot } from "@/server/forms/snapshot";
import { buildRequestMailSnapshotsForCreate } from "@/server/forms/mail-config";
import { getPublicOrigin } from "@/server/forms/request-meta";
import {
  effectiveRequestStatus,
  isWritableRequestStatus,
} from "@/server/forms/status";
import { generateRawSecret, hashSecret } from "@/server/forms/token";
import { extractPdfPageSizes } from "@/server/pdf/fields";
import { getTemplate, listTemplateFields, readTemplatePdfBytes } from "@/server/templates/service";
import { deletePrivatePdf } from "@/server/storage/blob";

function parseRequestId(requestId: string): string {
  const parsed = formRequestIdSchema.safeParse(requestId);

  if (!parsed.success) {
    throw new NotFoundError("Form request not found");
  }

  return parsed.data;
}


export const FORM_REQUEST_NOT_ARCHIVED_MESSAGE =
  "Alleen gearchiveerde verzoeken kunnen definitief worden verwijderd.";

export const FORM_REQUEST_DELETE_CONFIRMATION_MESSAGE = `Typ exact ${PERMANENT_DELETE_CONFIRMATION} om te bevestigen.`;

export async function countFormRequests(tenant: TenantContext) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(formRequests)
    .where(activeRequestsInOrganization(tenant.organizationId));

  return row?.value ?? 0;
}

export async function listFormRequests(tenant: TenantContext) {
  const rows = await getDb()
    .select({
      request: formRequests,
      templateName: documentTemplates.name,
      documentStatus: formDocuments.status,
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
    .where(activeRequestsInOrganization(tenant.organizationId))
    .orderBy(desc(formRequests.createdAt), asc(formDocuments.sortOrder));

  return rows.map((row) => ({
    ...row.request,
    templateName: row.templateName,
    documentStatus: row.documentStatus,
    status: effectiveRequestStatus(row.request.status, row.request.expiresAt),
    isFinalized: row.documentStatus === "finalized",
  }));
}

export async function listArchivedFormRequests(tenant: TenantContext) {
  const rows = await getDb()
    .select({
      request: formRequests,
      templateName: documentTemplates.name,
      documentStatus: formDocuments.status,
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
    .where(archivedRequestsInOrganization(tenant.organizationId))
    .orderBy(desc(formRequests.createdAt), asc(formDocuments.sortOrder));

  return rows.map((row) => ({
    ...row.request,
    templateName: row.templateName,
    documentStatus: row.documentStatus,
    status: effectiveRequestStatus(row.request.status, row.request.expiresAt),
    isFinalized: row.documentStatus === "finalized",
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

  const isArchived = row.request.archivedAt != null;

  return {
    request: { ...row.request, status },
    document: row.document,
    templateName: row.templateName,
    organizationName: row.organizationName,
    hasActiveToken:
      Boolean(activeToken) &&
      !isArchived &&
      status !== "expired" &&
      status !== "cancelled",
    fillSubmitted,
    isFinalized,
    isArchived,
    canArchive: !isArchived,
    canRestore: isArchived,
    canDelete: isArchived,
    canCancel: !isArchived && isWritableRequestStatus(status) && !isFinalized,
    canRotateToken: !isArchived && isWritableRequestStatus(status) && !isFinalized,
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
  const publicOrigin = await getPublicOrigin();
  const mailSnapshots = await buildRequestMailSnapshotsForCreate(tenant, {
    templateId: template.id,
    recipientName: client.displayName,
    invitationSubject: input.invitationSubject,
    invitationBody: input.invitationBody,
    confirmationSubject: input.confirmationSubject,
    confirmationBody: input.confirmationBody,
    rawToken,
    expiresAt,
    publicOrigin,
  });
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
        documentCategory: mailSnapshots.documentCategory,
        invitationSubjectSnapshot: mailSnapshots.invitationSubjectSnapshot,
        invitationBodySnapshot: mailSnapshots.invitationBodySnapshot,
        confirmationKindSnapshot: mailSnapshots.confirmationKind,
        confirmationSubjectSnapshot: mailSnapshots.confirmationSubjectSnapshot,
        confirmationBodySnapshot: mailSnapshots.confirmationBodySnapshot,
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


export async function archiveFormRequest(tenant: TenantContext, requestId: string) {
  const existing = await getFormRequest(tenant, requestId);

  if (existing.request.archivedAt) {
    return existing.request;
  }

  const now = new Date();

  return getDb().transaction(async (tx) => {
    const [request] = await tx
      .update(formRequests)
      .set({ archivedAt: now })
      .where(requestInOrganization(tenant.organizationId, existing.request.id))
      .returning();

    if (!request) {
      throw new NotFoundError("Form request not found");
    }

    await revokeActiveTokensAndSessions(
      tx,
      tenant.organizationId,
      existing.request.id,
      now,
    );

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.FORM_REQUEST_ARCHIVED,
      entityType: AUDIT_ENTITY_TYPES.FORM_REQUEST,
      entityId: request.id,
      formRequestId: request.id,
      metadata: {
        status: request.status,
        documentStatus: existing.document.status,
      },
    });

    return request;
  });
}

export async function restoreFormRequest(tenant: TenantContext, requestId: string) {
  const existing = await getFormRequest(tenant, requestId);

  if (!existing.request.archivedAt) {
    return existing.request;
  }

  return getDb().transaction(async (tx) => {
    const [request] = await tx
      .update(formRequests)
      .set({ archivedAt: null })
      .where(requestInOrganization(tenant.organizationId, existing.request.id))
      .returning();

    if (!request) {
      throw new NotFoundError("Form request not found");
    }

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.FORM_REQUEST_RESTORED,
      entityType: AUDIT_ENTITY_TYPES.FORM_REQUEST,
      entityId: request.id,
      formRequestId: request.id,
      metadata: {
        status: request.status,
        documentStatus: existing.document.status,
      },
    });

    return request;
  });
}

export async function deleteFormRequest(
  tenant: TenantContext,
  requestId: string,
  confirmation: string,
) {
  if (confirmation !== PERMANENT_DELETE_CONFIRMATION) {
    throw new ValidationError(FORM_REQUEST_DELETE_CONFIRMATION_MESSAGE);
  }

  const existing = await getFormRequest(tenant, requestId);

  if (!existing.request.archivedAt) {
    throw new ConflictError(FORM_REQUEST_NOT_ARCHIVED_MESSAGE);
  }

  const db = getDb();
  const organizationId = tenant.organizationId;
  const id = existing.request.id;

  const documents = await db
    .select({
      id: formDocuments.id,
      status: formDocuments.status,
      finalPdfBlobKey: formDocuments.finalPdfBlobKey,
    })
    .from(formDocuments)
    .where(documentsInRequest(organizationId, id));

  const documentIds = documents.map((document) => document.id);

  const signatureRows =
    documentIds.length === 0
      ? []
      : await db
          .select({
            id: signatures.id,
            signatureBlobKey: signatures.signatureBlobKey,
            formDocumentId: signatures.formDocumentId,
          })
          .from(signatures)
          .where(
            and(
              eq(signatures.organizationId, organizationId),
              inArray(signatures.formDocumentId, documentIds),
            ),
          );

  const sessionRows = await db
    .select({ id: formSessions.id })
    .from(formSessions)
    .where(
      and(
        eq(formSessions.organizationId, organizationId),
        eq(formSessions.formRequestId, id),
      ),
    );

  const sessionIds = sessionRows.map((row) => row.id);

  const blobKeys = [
    ...documents
      .map((document) => document.finalPdfBlobKey)
      .filter((key): key is string => Boolean(key)),
    ...signatureRows.map((row) => row.signatureBlobKey),
  ];

  const hadSignatures = signatureRows.length > 0;
  const hadFinalPdf = documents.some((document) => document.finalPdfBlobKey != null);
  const hadFinalizedDocument = documents.some(
    (document) => document.status === "finalized",
  );

  await db.transaction(async (tx) => {
    // Audit before deletion; omit request/document/session FKs so RESTRICT
    // parents can be removed while the delete event itself is retained.
    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.FORM_REQUEST_DELETED,
      entityType: AUDIT_ENTITY_TYPES.FORM_REQUEST,
      entityId: id,
      metadata: {
        status: existing.request.status,
        recipientEmail: existing.request.recipientEmail,
        recipientName: existing.request.recipientName,
        documentIds,
        hadSignatures,
        hadFinalPdf,
        hadFinalizedDocument,
        confirmation: "typed",
      },
    });

    await tx
      .update(auditEvents)
      .set({
        formRequestId: null,
        formDocumentId: null,
        formSessionId: null,
      })
      .where(
        and(
          eq(auditEvents.organizationId, organizationId),
          eq(auditEvents.formRequestId, id),
        ),
      );

    if (documentIds.length > 0) {
      await tx
        .update(auditEvents)
        .set({
          formDocumentId: null,
          formSessionId: null,
        })
        .where(
          and(
            eq(auditEvents.organizationId, organizationId),
            inArray(auditEvents.formDocumentId, documentIds),
          ),
        );
    }

    if (sessionIds.length > 0) {
      await tx
        .update(auditEvents)
        .set({ formSessionId: null })
        .where(
          and(
            eq(auditEvents.organizationId, organizationId),
            inArray(auditEvents.formSessionId, sessionIds),
          ),
        );
    }

    const deliveryRows = await tx
      .select({ id: reminderDeliveries.id })
      .from(reminderDeliveries)
      .where(
        and(
          eq(reminderDeliveries.organizationId, organizationId),
          eq(reminderDeliveries.formRequestId, id),
        ),
      );

    const deliveryIds = deliveryRows.map((row) => row.id);

    await tx
      .update(emailEvents)
      .set({ formRequestId: null })
      .where(
        and(
          eq(emailEvents.organizationId, organizationId),
          eq(emailEvents.formRequestId, id),
        ),
      );

    if (deliveryIds.length > 0) {
      await tx
        .update(emailEvents)
        .set({ reminderDeliveryId: null })
        .where(
          and(
            eq(emailEvents.organizationId, organizationId),
            inArray(emailEvents.reminderDeliveryId, deliveryIds),
          ),
        );
    }

    await tx
      .delete(reminderDeliveries)
      .where(
        and(
          eq(reminderDeliveries.organizationId, organizationId),
          eq(reminderDeliveries.formRequestId, id),
        ),
      );

    // Signatures/acceptances reference sessions — delete before sessions.
    if (documentIds.length > 0) {
      await tx
        .delete(signatures)
        .where(
          and(
            eq(signatures.organizationId, organizationId),
            inArray(signatures.formDocumentId, documentIds),
          ),
        );

      await tx
        .delete(acceptances)
        .where(
          and(
            eq(acceptances.organizationId, organizationId),
            inArray(acceptances.formDocumentId, documentIds),
          ),
        );
    }

    // Sessions reference tokens — delete sessions before tokens.
    await tx
      .delete(formSessions)
      .where(
        and(
          eq(formSessions.organizationId, organizationId),
          eq(formSessions.formRequestId, id),
        ),
      );

    await tx
      .delete(secureTokens)
      .where(
        and(
          eq(secureTokens.organizationId, organizationId),
          eq(secureTokens.formRequestId, id),
        ),
      );

    await tx.delete(formDocuments).where(documentsInRequest(organizationId, id));

    const [deleted] = await tx
      .delete(formRequests)
      .where(requestInOrganization(organizationId, id))
      .returning({ id: formRequests.id });

    if (!deleted) {
      throw new NotFoundError("Form request not found");
    }
  });

  for (const blobKey of blobKeys) {
    await deletePrivatePdf(blobKey).catch(() => undefined);
  }

  return { id };
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
