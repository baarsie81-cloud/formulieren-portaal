import "server-only";

import { cache } from "react";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { isArchived, projectClerkUser } from "@/server/auth/projection";
import { AuthError, requireOrganization } from "@/server/auth/session";
import { getDb, type Database } from "@/server/db";
import { organizationByClerkId, userByClerkId } from "@/server/db/clerk-mapping";
import { isUniqueViolation } from "@/server/db/postgres-errors";
import {
  organizationMembers,
  organizations,
  users,
} from "@/server/db/schema";
import type { AppRole } from "@/server/auth/roles";

export type TenantContext = {
  clerkUserId: string;
  clerkOrganizationId: string;
  role: AppRole;
  organizationId: string;
  organizationName: string;
  userId: string;
  userDisplayName: string;
};

type DbOrTx = Pick<Database, "query" | "insert" | "update">;

async function getClerkOrganizationName(clerkOrganizationId: string): Promise<string> {
  const client = await clerkClient();
  const organization = await client.organizations.getOrganization({
    organizationId: clerkOrganizationId,
  });

  const name = organization.name?.trim();

  if (!name) {
    throw new AuthError("Organization name is required", 403);
  }

  return name;
}

async function ensureOrganization(
  db: DbOrTx,
  clerkOrganizationId: string,
  name: string,
) {
  const existing = await db.query.organizations.findFirst({
    where: organizationByClerkId(clerkOrganizationId),
  });

  if (existing) {
    if (isArchived(existing.archivedAt)) {
      throw new AuthError("Organization is archived", 403);
    }

    if (existing.name !== name) {
      const [updated] = await db
        .update(organizations)
        .set({ name })
        .where(eq(organizations.id, existing.id))
        .returning();

      return updated ?? existing;
    }

    return existing;
  }

  try {
    const [created] = await db
      .insert(organizations)
      .values({
        clerkOrganizationId,
        name,
      })
      .returning();

    if (!created) {
      throw new AuthError("Active organization required", 403);
    }

    return created;
  } catch (error) {
    if (!isUniqueViolation(error, "organizations_clerk_organization_id_unique")) {
      throw error;
    }

    const raced = await db.query.organizations.findFirst({
      where: organizationByClerkId(clerkOrganizationId),
    });

    if (!raced) {
      throw new AuthError("Active organization required", 403);
    }

    if (isArchived(raced.archivedAt)) {
      throw new AuthError("Organization is archived", 403);
    }

    return raced;
  }
}

async function ensureUser(
  db: DbOrTx,
  clerkUserId: string,
  projection: { email: string; displayName: string },
) {
  const existing = await db.query.users.findFirst({
    where: userByClerkId(clerkUserId),
  });

  if (existing) {
    if (
      existing.email !== projection.email ||
      existing.displayName !== projection.displayName
    ) {
      const [updated] = await db
        .update(users)
        .set({
          email: projection.email,
          displayName: projection.displayName,
        })
        .where(eq(users.id, existing.id))
        .returning();

      return updated ?? existing;
    }

    return existing;
  }

  try {
    const [created] = await db
      .insert(users)
      .values({
        clerkUserId,
        email: projection.email,
        displayName: projection.displayName,
      })
      .returning();

    if (!created) {
      throw new AuthError("User projection failed", 403);
    }

    return created;
  } catch (error) {
    if (!isUniqueViolation(error, "users_clerk_user_id_unique")) {
      throw error;
    }

    const raced = await db.query.users.findFirst({
      where: userByClerkId(clerkUserId),
    });

    if (!raced) {
      throw new AuthError("User projection failed", 403);
    }

    return raced;
  }
}

async function ensureMembership(
  db: DbOrTx,
  organizationId: string,
  userId: string,
  role: AppRole,
) {
  const existing = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, userId),
    ),
  });

  if (existing) {
    if (existing.role === role && existing.revokedAt == null) {
      return existing;
    }

    const [updated] = await db
      .update(organizationMembers)
      .set({
        role,
        revokedAt: null,
      })
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.id, existing.id),
        ),
      )
      .returning();

    return updated ?? existing;
  }

  try {
    const [created] = await db
      .insert(organizationMembers)
      .values({
        organizationId,
        userId,
        role,
      })
      .returning();

    if (!created) {
      throw new AuthError("Organization membership is required", 403);
    }

    return created;
  } catch (error) {
    if (
      !isUniqueViolation(error, "organization_members_organization_id_user_id_unique")
    ) {
      throw error;
    }

    const raced = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
        isNull(organizationMembers.revokedAt),
      ),
    });

    if (!raced) {
      throw new AuthError("Organization membership is required", 403);
    }

    return raced;
  }
}

async function resolveTenant(): Promise<TenantContext> {
  const session = await requireOrganization();
  const clerkUser = await currentUser();

  if (!clerkUser || clerkUser.id !== session.clerkUserId) {
    throw new AuthError("Authentication required", 401);
  }

  const organizationName = await getClerkOrganizationName(
    session.clerkOrganizationId,
  );
  const projection = projectClerkUser(clerkUser);

  if (!projection) {
    throw new AuthError("User email is required", 403);
  }

  const db = getDb();

  const { organization, user } = await db.transaction(async (tx) => {
    const organization = await ensureOrganization(
      tx,
      session.clerkOrganizationId,
      organizationName,
    );
    const user = await ensureUser(tx, session.clerkUserId, projection);
    await ensureMembership(tx, organization.id, user.id, session.role);

    return { organization, user };
  });

  return {
    clerkUserId: session.clerkUserId,
    clerkOrganizationId: session.clerkOrganizationId,
    role: session.role,
    organizationId: organization.id,
    organizationName: organization.name,
    userId: user.id,
    userDisplayName: user.displayName,
  };
}

/** Request-scoped. Always derive organizationId from the Clerk session, never from the client. */
export const requireTenant = cache(resolveTenant);
