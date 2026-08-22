import "server-only";

import {
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
  type OrganizationEmailTemplateKind,
} from "@/lib/constants";
import type { TenantContext } from "@/server/auth/tenant";
import { getClient } from "@/server/clients/service";
import { getDb } from "@/server/db";
import {
  buildConfirmationTemplateContext,
  buildInvitationTemplateContext,
  confirmationTemplateKindForCategory,
  invitationTemplateKindForCategory,
  resolveOrganizationEmailTemplate,
  substituteEmailTemplate,
  type EmailTemplateContext,
} from "@/server/email/templates";
import { publicFormUrl } from "@/server/forms/request-meta";
import { getTemplate } from "@/server/templates/service";

export type RequestMailDefaults = {
  documentCategory: DocumentCategory;
  documentCategoryLabel: string;
  invitationKind: OrganizationEmailTemplateKind;
  confirmationKind: OrganizationEmailTemplateKind;
  invitationSubject: string;
  invitationBody: string;
  confirmationSubject: string;
  confirmationBody: string;
};

export type RequestMailSnapshots = {
  documentCategory: DocumentCategory;
  confirmationKind: OrganizationEmailTemplateKind;
  invitationSubjectSnapshot: string;
  invitationBodySnapshot: string;
  confirmationSubjectSnapshot: string;
  confirmationBodySnapshot: string;
};

export async function loadRequestMailDefaults(
  tenant: TenantContext,
  input: { clientId: string; templateId: string },
): Promise<RequestMailDefaults> {
  const client = await getClient(tenant, input.clientId);

  if (client.archivedAt) {
    throw new Error("Archived clients cannot receive forms");
  }

  const template = await getTemplate(tenant, input.templateId);

  if (template.status !== "active") {
    throw new Error("Archived templates cannot be sent");
  }

  const documentCategory = template.category;
  const invitationKind = invitationTemplateKindForCategory(documentCategory);
  const confirmationKind = confirmationTemplateKindForCategory(documentCategory);
  const db = getDb();

  const [invitationTemplate, confirmationTemplate] = await Promise.all([
    resolveOrganizationEmailTemplate(db, tenant.organizationId, invitationKind),
    resolveOrganizationEmailTemplate(db, tenant.organizationId, confirmationKind),
  ]);

  return {
    documentCategory,
    documentCategoryLabel: DOCUMENT_CATEGORY_LABELS[documentCategory],
    invitationKind,
    confirmationKind,
    invitationSubject: invitationTemplate.subjectTemplate,
    invitationBody: invitationTemplate.bodyTemplate,
    confirmationSubject: confirmationTemplate.subjectTemplate,
    confirmationBody: confirmationTemplate.bodyTemplate,
  };
}

export function buildRequestMailSnapshots(input: {
  documentCategory: DocumentCategory;
  invitationSubject: string;
  invitationBody: string;
  confirmationSubject: string;
  confirmationBody: string;
  organizationName: string;
  recipientName: string;
  formUrl: string;
  expiresAt: Date;
}): RequestMailSnapshots {
  const invitationContext = buildInvitationTemplateContext({
    organizationName: input.organizationName,
    recipientName: input.recipientName,
    formUrl: input.formUrl,
    expiresAt: input.expiresAt,
  });
  const confirmationContext = buildConfirmationTemplateContext({
    organizationName: input.organizationName,
    recipientName: input.recipientName,
  });

  const invitation = renderMailSnapshot(
    input.invitationSubject,
    input.invitationBody,
    invitationContext,
  );
  const confirmation = renderMailSnapshot(
    input.confirmationSubject,
    input.confirmationBody,
    confirmationContext,
  );

  return {
    documentCategory: input.documentCategory,
    confirmationKind: confirmationTemplateKindForCategory(input.documentCategory),
    invitationSubjectSnapshot: invitation.subject,
    invitationBodySnapshot: invitation.body,
    confirmationSubjectSnapshot: confirmation.subject,
    confirmationBodySnapshot: confirmation.body,
  };
}

function renderMailSnapshot(
  subjectTemplate: string,
  bodyTemplate: string,
  context: EmailTemplateContext,
) {
  return {
    subject: substituteEmailTemplate(subjectTemplate.trim(), context),
    body: substituteEmailTemplate(bodyTemplate.trim(), context),
  };
}

export async function buildRequestMailSnapshotsForCreate(
  tenant: TenantContext,
  input: {
    templateId: string;
    recipientName: string;
    invitationSubject: string;
    invitationBody: string;
    confirmationSubject: string;
    confirmationBody: string;
    rawToken: string;
    expiresAt: Date;
    publicOrigin: string;
  },
): Promise<RequestMailSnapshots> {
  const template = await getTemplate(tenant, input.templateId);

  return buildRequestMailSnapshots({
    documentCategory: template.category,
    invitationSubject: input.invitationSubject,
    invitationBody: input.invitationBody,
    confirmationSubject: input.confirmationSubject,
    confirmationBody: input.confirmationBody,
    organizationName: tenant.organizationName,
    recipientName: input.recipientName,
    formUrl: publicFormUrl(input.publicOrigin, input.rawToken),
    expiresAt: input.expiresAt,
  });
}
