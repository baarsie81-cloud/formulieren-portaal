import "server-only";

import {
  ORGANIZATION_EMAIL_TEMPLATE_KIND_LABELS,
  ORGANIZATION_EMAIL_TEMPLATE_KINDS,
  type OrganizationEmailTemplateKind,
} from "@/lib/constants";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/audit/actions";
import { writeUserAuditEvent } from "@/server/audit/log";
import type { TenantContext } from "@/server/auth/tenant";
import { getDb } from "@/server/db";
import { organizationEmailTemplates } from "@/server/db/schema";
import { getDefaultEmailTemplate } from "@/server/email/templates";
import {
  emailTemplateInOrganization,
  emailTemplatesInOrganization,
} from "@/server/email-templates/scope";
import type { UpsertOrganizationEmailTemplateInput } from "@/server/email-templates/schema";
import { NotFoundError } from "@/server/errors";

export type OrganizationEmailTemplateView = {
  kind: OrganizationEmailTemplateKind;
  label: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isCustomized: boolean;
  id: string | null;
  updatedAt: Date | null;
};

export async function listOrganizationEmailTemplates(
  tenant: TenantContext,
): Promise<OrganizationEmailTemplateView[]> {
  const rows = await getDb()
    .select({
      id: organizationEmailTemplates.id,
      kind: organizationEmailTemplates.kind,
      subjectTemplate: organizationEmailTemplates.subjectTemplate,
      bodyTemplate: organizationEmailTemplates.bodyTemplate,
      updatedAt: organizationEmailTemplates.updatedAt,
    })
    .from(organizationEmailTemplates)
    .where(emailTemplatesInOrganization(tenant.organizationId));

  const byKind = new Map(rows.map((row) => [row.kind, row]));

  return ORGANIZATION_EMAIL_TEMPLATE_KINDS.map((kind) => {
    const row = byKind.get(kind);
    if (row) {
      return {
        kind,
        label: ORGANIZATION_EMAIL_TEMPLATE_KIND_LABELS[kind],
        subjectTemplate: row.subjectTemplate,
        bodyTemplate: row.bodyTemplate,
        isCustomized: true,
        id: row.id,
        updatedAt: row.updatedAt,
      };
    }

    const defaults = getDefaultEmailTemplate(kind);
    return {
      kind,
      label: ORGANIZATION_EMAIL_TEMPLATE_KIND_LABELS[kind],
      subjectTemplate: defaults.subjectTemplate,
      bodyTemplate: defaults.bodyTemplate,
      isCustomized: false,
      id: null,
      updatedAt: null,
    };
  });
}

export async function upsertOrganizationEmailTemplate(
  tenant: TenantContext,
  input: UpsertOrganizationEmailTemplateInput,
): Promise<OrganizationEmailTemplateView> {
  const db = getDb();

  const row = await db.transaction(async (tx) => {
    const [upserted] = await tx
      .insert(organizationEmailTemplates)
      .values({
        organizationId: tenant.organizationId,
        kind: input.kind,
        subjectTemplate: input.subjectTemplate,
        bodyTemplate: input.bodyTemplate,
      })
      .onConflictDoUpdate({
        target: [
          organizationEmailTemplates.organizationId,
          organizationEmailTemplates.kind,
        ],
        set: {
          subjectTemplate: input.subjectTemplate,
          bodyTemplate: input.bodyTemplate,
        },
      })
      .returning();

    if (!upserted) {
      throw new Error("Failed to upsert organization email template");
    }

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.ORGANIZATION_EMAIL_TEMPLATE_UPDATED,
      entityType: AUDIT_ENTITY_TYPES.ORGANIZATION_EMAIL_TEMPLATE,
      entityId: upserted.id,
      metadata: { kind: input.kind },
    });

    return upserted;
  });

  return {
    kind: row.kind,
    label: ORGANIZATION_EMAIL_TEMPLATE_KIND_LABELS[row.kind],
    subjectTemplate: row.subjectTemplate,
    bodyTemplate: row.bodyTemplate,
    isCustomized: true,
    id: row.id,
    updatedAt: row.updatedAt,
  };
}

export async function resetOrganizationEmailTemplate(
  tenant: TenantContext,
  kind: OrganizationEmailTemplateKind,
): Promise<OrganizationEmailTemplateView> {
  const db = getDb();

  await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(organizationEmailTemplates)
      .where(emailTemplateInOrganization(tenant.organizationId, kind))
      .returning({
        id: organizationEmailTemplates.id,
      });

    if (!row) {
      throw new NotFoundError("Organization email template not found");
    }

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.ORGANIZATION_EMAIL_TEMPLATE_RESET,
      entityType: AUDIT_ENTITY_TYPES.ORGANIZATION_EMAIL_TEMPLATE,
      entityId: row.id,
      metadata: { kind },
    });
  });

  const defaults = getDefaultEmailTemplate(kind);
  return {
    kind,
    label: ORGANIZATION_EMAIL_TEMPLATE_KIND_LABELS[kind],
    subjectTemplate: defaults.subjectTemplate,
    bodyTemplate: defaults.bodyTemplate,
    isCustomized: false,
    id: null,
    updatedAt: null,
  };
}
