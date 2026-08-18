import { and, eq } from "drizzle-orm";
import { documentFields, documentTemplates } from "@/server/db/schema";

export function templateInOrganization(organizationId: string, templateId: string) {
  return and(
    eq(documentTemplates.organizationId, organizationId),
    eq(documentTemplates.id, templateId),
  );
}

export function activeTemplatesInOrganization(organizationId: string) {
  return and(
    eq(documentTemplates.organizationId, organizationId),
    eq(documentTemplates.status, "active"),
  );
}

export function fieldsInTemplate(organizationId: string, templateId: string) {
  return and(
    eq(documentFields.organizationId, organizationId),
    eq(documentFields.documentTemplateId, templateId),
  );
}

export function fieldInOrganization(organizationId: string, fieldId: string) {
  return and(eq(documentFields.organizationId, organizationId), eq(documentFields.id, fieldId));
}
