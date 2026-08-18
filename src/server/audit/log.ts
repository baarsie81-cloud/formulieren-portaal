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
  formRequestId?: string;
  formDocumentId?: string;
  formSessionId?: string;
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
    formRequestId: input.formRequestId,
    formDocumentId: input.formDocumentId,
    formSessionId: input.formSessionId,
    metadata: input.metadata ?? {},
  });
}

type WriteClientAuditEventInput = {
  organizationId: string;
  action: string;
  entityType: string;
  entityId: string;
  formRequestId: string;
  formDocumentId?: string;
  formSessionId?: string;
  ipHash?: string;
  metadata?: Record<string, unknown>;
};

export async function writeClientAuditEvent(
  db: Pick<Database, "insert">,
  input: WriteClientAuditEventInput,
) {
  await db.insert(auditEvents).values({
    organizationId: input.organizationId,
    actorType: "client",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    formRequestId: input.formRequestId,
    formDocumentId: input.formDocumentId,
    formSessionId: input.formSessionId,
    ipHash: input.ipHash,
    metadata: input.metadata ?? {},
  });
}
