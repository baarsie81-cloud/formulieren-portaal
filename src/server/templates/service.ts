import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/audit/actions";
import { writeUserAuditEvent } from "@/server/audit/log";
import type { TenantContext } from "@/server/auth/tenant";
import { getDb } from "@/server/db";
import { documentFields, documentTemplates, formDocuments } from "@/server/db/schema";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { extractPdfFields } from "@/server/pdf/fields";
import { sha256Hex } from "@/server/pdf/hash";
import { assertPdfBytes } from "@/server/pdf/validate";
import {
  assertPdfSha256,
  deletePrivatePdf,
  getPrivatePdfBytes,
  putPrivatePdf,
} from "@/server/storage/blob";
import { assertTemplateBlobKey, templatePdfBlobKey } from "@/server/storage/paths";
import type { FieldMappingInput, TemplateMetadataInput } from "@/server/templates/schema";
import {
  PERMANENT_DELETE_CONFIRMATION,
  templateIdSchema,
} from "@/server/templates/schema";
import {
  activeTemplatesInOrganization,
  archivedTemplatesInOrganization,
  fieldsInTemplate,
  templateInOrganization,
} from "@/server/templates/scope";

export const NO_ACROFORM_FIELDS_MESSAGE = "PDF has no AcroForm fields";

export const TEMPLATE_HAS_FORM_DOCUMENTS_MESSAGE =
  "Dit sjabloon kan niet definitief worden verwijderd zolang er formulierdocumenten aan gekoppeld zijn.";

export const TEMPLATE_NOT_ARCHIVED_MESSAGE =
  "Alleen gearchiveerde sjablonen kunnen definitief worden verwijderd.";

export const TEMPLATE_DELETE_CONFIRMATION_MESSAGE = `Typ exact ${PERMANENT_DELETE_CONFIRMATION} om te bevestigen.`;

function parseTemplateId(templateId: string): string {
  const parsed = templateIdSchema.safeParse(templateId);

  if (!parsed.success) {
    throw new NotFoundError("Template not found");
  }

  return parsed.data;
}

export async function listTemplates(tenant: TenantContext) {
  return getDb()
    .select()
    .from(documentTemplates)
    .where(activeTemplatesInOrganization(tenant.organizationId))
    .orderBy(asc(documentTemplates.name), desc(documentTemplates.createdAt));
}

export async function listArchivedTemplates(tenant: TenantContext) {
  return getDb()
    .select()
    .from(documentTemplates)
    .where(archivedTemplatesInOrganization(tenant.organizationId))
    .orderBy(asc(documentTemplates.name), desc(documentTemplates.createdAt));
}

export async function countTemplates(tenant: TenantContext) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(documentTemplates)
    .where(activeTemplatesInOrganization(tenant.organizationId));

  return row?.value ?? 0;
}

export async function getTemplate(tenant: TenantContext, templateId: string) {
  const id = parseTemplateId(templateId);
  const [template] = await getDb()
    .select()
    .from(documentTemplates)
    .where(templateInOrganization(tenant.organizationId, id))
    .limit(1);

  if (!template) {
    throw new NotFoundError("Template not found");
  }

  return template;
}

export async function listTemplateFields(tenant: TenantContext, templateId: string) {
  const template = await getTemplate(tenant, templateId);

  return getDb()
    .select()
    .from(documentFields)
    .where(fieldsInTemplate(tenant.organizationId, template.id))
    .orderBy(asc(documentFields.sortOrder), asc(documentFields.pdfFieldName));
}

export async function createTemplate(
  tenant: TenantContext,
  input: TemplateMetadataInput,
  pdfBytes: Uint8Array,
) {
  assertPdfBytes(pdfBytes);

  const extracted = await extractPdfFields(pdfBytes);

  if (extracted.fields.length === 0) {
    throw new ValidationError(NO_ACROFORM_FIELDS_MESSAGE);
  }

  const sha256 = sha256Hex(pdfBytes);
  const templateId = randomUUID();
  const blobKey = templatePdfBlobKey(tenant.organizationId, templateId, sha256);

  await putPrivatePdf(blobKey, pdfBytes);

  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const [template] = await tx
        .insert(documentTemplates)
        .values({
          id: templateId,
          organizationId: tenant.organizationId,
          name: input.name,
          description: input.description,
          category: input.category,
          blobKey,
          sha256,
          status: "active",
        })
        .returning();

      if (!template) {
        throw new Error("Failed to create template");
      }

      await tx.insert(documentFields).values(
        extracted.fields.map((field, index) => ({
          organizationId: tenant.organizationId,
          documentTemplateId: template.id,
          pdfFieldName: field.pdfFieldName,
          valueKey: field.valueKey,
          fieldType: field.fieldType,
          pageNumber: field.pageNumber,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          pageWidth: field.pageWidth,
          pageHeight: field.pageHeight,
          isRequired: field.isRequired,
          sortOrder: index,
        })),
      );

      await writeUserAuditEvent(tx, {
        tenant,
        action: AUDIT_ACTIONS.TEMPLATE_CREATED,
        entityType: AUDIT_ENTITY_TYPES.DOCUMENT_TEMPLATE,
        entityId: template.id,
        metadata: {
          sha256,
          fieldCount: extracted.fields.length,
        },
      });

      return template;
    });
  } catch (error) {
    await deletePrivatePdf(blobKey).catch(() => undefined);
    throw error;
  }
}

export async function updateTemplateMetadata(
  tenant: TenantContext,
  templateId: string,
  input: TemplateMetadataInput,
) {
  const existing = await getTemplate(tenant, templateId);
  assertActiveTemplate(existing);

  const changedFields: string[] = [];

  if (existing.name !== input.name) {
    changedFields.push("name");
  }

  if (existing.description !== input.description) {
    changedFields.push("description");
  }

  if (existing.category !== input.category) {
    changedFields.push("category");
  }

  if (changedFields.length === 0) {
    return existing;
  }

  return getDb().transaction(async (tx) => {
    const [template] = await tx
      .update(documentTemplates)
      .set({
        name: input.name,
        description: input.description,
        category: input.category,
      })
      .where(templateInOrganization(tenant.organizationId, existing.id))
      .returning();

    if (!template) {
      throw new NotFoundError("Template not found");
    }

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.TEMPLATE_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT_TEMPLATE,
      entityId: template.id,
      metadata: { changedFields },
    });

    return template;
  });
}

export async function updateTemplateFieldMappings(
  tenant: TenantContext,
  templateId: string,
  mappings: FieldMappingInput[],
) {
  const existing = await getTemplate(tenant, templateId);
  assertActiveTemplate(existing);

  const currentFields = await listTemplateFields(tenant, existing.id);

  if (mappings.length !== currentFields.length) {
    throw new ValidationError("Field mapping does not match the stored PDF fields");
  }

  const currentById = new Map(currentFields.map((field) => [field.id, field]));

  for (const mapping of mappings) {
    const current = currentById.get(mapping.id);

    if (!current || current.pdfFieldName !== mapping.pdfFieldName) {
      throw new ValidationError("Field mapping does not match the stored PDF fields");
    }
  }

  const changedCount = mappings.filter((mapping) => {
    const current = currentById.get(mapping.id);

    return (
      current &&
      (current.valueKey !== mapping.valueKey ||
        current.fieldType !== mapping.fieldType ||
        current.isRequired !== mapping.isRequired ||
        current.sortOrder !== mapping.sortOrder ||
        current.signatureRole !== mapping.signatureRole)
    );
  }).length;

  if (changedCount === 0) {
    return currentFields;
  }

  await getDb().transaction(async (tx) => {
    for (const mapping of mappings) {
      const [updated] = await tx
        .update(documentFields)
        .set({
          valueKey: mapping.valueKey,
          fieldType: mapping.fieldType,
          isRequired: mapping.isRequired,
          sortOrder: mapping.sortOrder,
          signatureRole: mapping.signatureRole,
        })
        .where(
          and(
            eq(documentFields.organizationId, tenant.organizationId),
            eq(documentFields.documentTemplateId, existing.id),
            eq(documentFields.id, mapping.id),
          ),
        )
        .returning();

      if (!updated) {
        throw new NotFoundError("Template not found");
      }
    }

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.TEMPLATE_FIELDS_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT_TEMPLATE,
      entityId: existing.id,
      metadata: { changedCount },
    });
  });

  return listTemplateFields(tenant, existing.id);
}

export async function archiveTemplate(tenant: TenantContext, templateId: string) {
  const existing = await getTemplate(tenant, templateId);

  if (existing.status === "archived") {
    return existing;
  }

  return getDb().transaction(async (tx) => {
    const [template] = await tx
      .update(documentTemplates)
      .set({
        status: "archived",
      })
      .where(templateInOrganization(tenant.organizationId, existing.id))
      .returning();

    if (!template) {
      throw new NotFoundError("Template not found");
    }

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.TEMPLATE_ARCHIVED,
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT_TEMPLATE,
      entityId: template.id,
    });

    return template;
  });
}

export async function readTemplatePdfBytes(tenant: TenantContext, templateId: string) {
  const template = await getTemplate(tenant, templateId);

  assertTemplateBlobKey(
    template.blobKey,
    tenant.organizationId,
    template.id,
    template.sha256,
  );

  const bytes = await getPrivatePdfBytes(template.blobKey);
  assertPdfSha256(bytes, template.sha256);

  return { template, bytes };
}


export async function restoreTemplate(tenant: TenantContext, templateId: string) {
  const existing = await getTemplate(tenant, templateId);

  if (existing.status === "active") {
    return existing;
  }

  return getDb().transaction(async (tx) => {
    const [template] = await tx
      .update(documentTemplates)
      .set({
        status: "active",
      })
      .where(templateInOrganization(tenant.organizationId, existing.id))
      .returning();

    if (!template) {
      throw new NotFoundError("Template not found");
    }

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.TEMPLATE_RESTORED,
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT_TEMPLATE,
      entityId: template.id,
    });

    return template;
  });
}

export async function deleteTemplate(
  tenant: TenantContext,
  templateId: string,
  confirmation: string,
) {
  if (confirmation !== PERMANENT_DELETE_CONFIRMATION) {
    throw new ValidationError(TEMPLATE_DELETE_CONFIRMATION_MESSAGE);
  }

  const existing = await getTemplate(tenant, templateId);

  if (existing.status !== "archived") {
    throw new ConflictError(TEMPLATE_NOT_ARCHIVED_MESSAGE);
  }

  const linkedDocumentCount = await countFormDocumentsForTemplate(
    tenant.organizationId,
    existing.id,
  );

  if (linkedDocumentCount > 0) {
    throw new ConflictError(TEMPLATE_HAS_FORM_DOCUMENTS_MESSAGE);
  }

  const blobKey = existing.blobKey;

  await getDb().transaction(async (tx) => {
    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.TEMPLATE_DELETED,
      entityType: AUDIT_ENTITY_TYPES.DOCUMENT_TEMPLATE,
      entityId: existing.id,
      metadata: {
        name: existing.name,
        sha256: existing.sha256,
        confirmation: "typed",
      },
    });

    await tx
      .delete(documentFields)
      .where(fieldsInTemplate(tenant.organizationId, existing.id));

    const [deleted] = await tx
      .delete(documentTemplates)
      .where(templateInOrganization(tenant.organizationId, existing.id))
      .returning({ id: documentTemplates.id });

    if (!deleted) {
      throw new NotFoundError("Template not found");
    }
  });

  await deletePrivatePdf(blobKey).catch(() => undefined);

  return { id: existing.id };
}

async function countFormDocumentsForTemplate(
  organizationId: string,
  templateId: string,
): Promise<number> {
  const [row] = await getDb()
    .select({ value: count() })
    .from(formDocuments)
    .where(
      and(
        eq(formDocuments.organizationId, organizationId),
        eq(formDocuments.documentTemplateId, templateId),
      ),
    );

  return row?.value ?? 0;
}

function assertActiveTemplate(template: { status: string }) {
  if (template.status === "archived") {
    throw new ConflictError("Archived templates cannot be updated");
  }
}
