import { and, eq } from "drizzle-orm";
import { formDocuments, formRequests } from "@/server/db/schema";

export function requestInOrganization(organizationId: string, requestId: string) {
  return and(
    eq(formRequests.organizationId, organizationId),
    eq(formRequests.id, requestId),
  );
}

export function documentInOrganization(organizationId: string, documentId: string) {
  return and(
    eq(formDocuments.organizationId, organizationId),
    eq(formDocuments.id, documentId),
  );
}

export function documentsInRequest(organizationId: string, requestId: string) {
  return and(
    eq(formDocuments.organizationId, organizationId),
    eq(formDocuments.formRequestId, requestId),
  );
}
