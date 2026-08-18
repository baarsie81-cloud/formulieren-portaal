import "server-only";

import type { TenantContext } from "@/server/auth/tenant";
import type { Database } from "@/server/db";
import { auditEvents } from "@/server/db/schema";

type WriteAuditEventInput = {
  tenant: TenantContext;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

export async function writeUserAuditEvent(
  db: Pick<Database, "insert">,
  input: WriteAuditEventInput,
) {
  await db.insert(auditEvents).values({
    organizationId: input.tenant.organizationId,
    actorType: "user",
    actorUserId: input.tenant.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? {},
  });
}
