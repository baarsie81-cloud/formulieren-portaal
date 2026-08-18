import { and, eq, isNull } from "drizzle-orm";
import { clients } from "@/server/db/schema";

export function clientInOrganization(organizationId: string, clientId: string) {
  return and(eq(clients.organizationId, organizationId), eq(clients.id, clientId));
}

export function activeClientsInOrganization(organizationId: string) {
  return and(
    eq(clients.organizationId, organizationId),
    isNull(clients.archivedAt),
  );
}
