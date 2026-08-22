import { and, eq } from "drizzle-orm";
import type { OrganizationEmailTemplateKind } from "@/lib/constants";
import { organizationEmailTemplates } from "@/server/db/schema";

export function emailTemplateInOrganization(
  organizationId: string,
  kind: OrganizationEmailTemplateKind,
) {
  return and(
    eq(organizationEmailTemplates.organizationId, organizationId),
    eq(organizationEmailTemplates.kind, kind),
  );
}

export function emailTemplatesInOrganization(organizationId: string) {
  return eq(organizationEmailTemplates.organizationId, organizationId);
}
