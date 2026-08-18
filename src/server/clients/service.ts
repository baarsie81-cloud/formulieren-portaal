import "server-only";

import { asc, count, desc } from "drizzle-orm";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/server/audit/actions";
import { writeUserAuditEvent } from "@/server/audit/log";
import type { TenantContext } from "@/server/auth/tenant";
import { getDb } from "@/server/db";
import { isUniqueViolation } from "@/server/db/postgres-errors";
import { clients } from "@/server/db/schema";
import { ConflictError, NotFoundError } from "@/server/errors";
import type { ClientInput } from "@/server/clients/schema";
import { clientIdSchema } from "@/server/clients/schema";
import {
  activeClientsInOrganization,
  clientInOrganization,
} from "@/server/clients/scope";

const ACTIVE_EMAIL_CONSTRAINT = "clients_organization_id_email_active_idx";

function parseClientId(clientId: string): string {
  const parsed = clientIdSchema.safeParse(clientId);

  if (!parsed.success) {
    throw new NotFoundError("Client not found");
  }

  return parsed.data;
}

export async function listClients(tenant: TenantContext) {
  return getDb()
    .select()
    .from(clients)
    .where(activeClientsInOrganization(tenant.organizationId))
    .orderBy(asc(clients.displayName), desc(clients.createdAt));
}

export async function getClient(tenant: TenantContext, clientId: string) {
  const id = parseClientId(clientId);
  const [client] = await getDb()
    .select()
    .from(clients)
    .where(clientInOrganization(tenant.organizationId, id))
    .limit(1);

  if (!client) {
    throw new NotFoundError("Client not found");
  }

  return client;
}

export async function countClients(tenant: TenantContext) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(clients)
    .where(activeClientsInOrganization(tenant.organizationId));

  return row?.value ?? 0;
}

export async function createClient(tenant: TenantContext, input: ClientInput) {
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const [client] = await tx
        .insert(clients)
        .values({
          organizationId: tenant.organizationId,
          displayName: input.displayName,
          email: input.email,
          phone: input.phone,
          externalReference: input.externalReference,
        })
        .returning();

      if (!client) {
        throw new Error("Failed to create client");
      }

      await writeUserAuditEvent(tx, {
        tenant,
        action: AUDIT_ACTIONS.CLIENT_CREATED,
        entityType: AUDIT_ENTITY_TYPES.CLIENT,
        entityId: client.id,
      });

      return client;
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      throw error;
    }

    if (isUniqueViolation(error, ACTIVE_EMAIL_CONSTRAINT) || isUniqueViolation(error)) {
      throw new ConflictError("A client with this email already exists");
    }

    throw error;
  }
}

export async function updateClient(
  tenant: TenantContext,
  clientId: string,
  input: ClientInput,
) {
  const existing = await getClient(tenant, clientId);

  if (existing.archivedAt) {
    throw new ConflictError("Archived clients cannot be updated");
  }

  const changedFields = changedClientFields(existing, input);

  if (changedFields.length === 0) {
    return existing;
  }

  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const [client] = await tx
        .update(clients)
        .set({
          displayName: input.displayName,
          email: input.email,
          phone: input.phone,
          externalReference: input.externalReference,
        })
        .where(clientInOrganization(tenant.organizationId, existing.id))
        .returning();

      if (!client) {
        throw new NotFoundError("Client not found");
      }

      await writeUserAuditEvent(tx, {
        tenant,
        action: AUDIT_ACTIONS.CLIENT_UPDATED,
        entityType: AUDIT_ENTITY_TYPES.CLIENT,
        entityId: client.id,
        metadata: { changedFields },
      });

      return client;
    });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ConflictError) {
      throw error;
    }

    if (isUniqueViolation(error, ACTIVE_EMAIL_CONSTRAINT) || isUniqueViolation(error)) {
      throw new ConflictError("A client with this email already exists");
    }

    throw error;
  }
}

export async function archiveClient(tenant: TenantContext, clientId: string) {
  const existing = await getClient(tenant, clientId);

  if (existing.archivedAt) {
    return existing;
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    const [client] = await tx
      .update(clients)
      .set({
        archivedAt: new Date(),
      })
      .where(clientInOrganization(tenant.organizationId, existing.id))
      .returning();

    if (!client) {
      throw new NotFoundError("Client not found");
    }

    await writeUserAuditEvent(tx, {
      tenant,
      action: AUDIT_ACTIONS.CLIENT_ARCHIVED,
      entityType: AUDIT_ENTITY_TYPES.CLIENT,
      entityId: client.id,
    });

    return client;
  });
}

function changedClientFields(
  existing: {
    displayName: string;
    email: string;
    phone: string | null;
    externalReference: string | null;
  },
  input: ClientInput,
): string[] {
  const changed: string[] = [];

  if (existing.displayName !== input.displayName) {
    changed.push("displayName");
  }

  if (existing.email !== input.email) {
    changed.push("email");
  }

  if (existing.phone !== input.phone) {
    changed.push("phone");
  }

  if (existing.externalReference !== input.externalReference) {
    changed.push("externalReference");
  }

  return changed;
}
