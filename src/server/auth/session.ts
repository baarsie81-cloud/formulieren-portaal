import "server-only";

import { auth } from "@clerk/nextjs/server";
import { mapClerkOrgRole, type AppRole } from "@/server/auth/roles";

export class AuthError extends Error {
  readonly status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type AuthenticatedUser = {
  clerkUserId: string;
};

export type AuthenticatedOrganization = {
  clerkUserId: string;
  clerkOrganizationId: string;
  role: AppRole;
};

export async function requireAuth(): Promise<AuthenticatedUser> {
  const { userId } = await auth();

  if (!userId) {
    throw new AuthError("Authentication required", 401);
  }

  return { clerkUserId: userId };
}

export async function requireOrganization(): Promise<AuthenticatedOrganization> {
  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    throw new AuthError("Authentication required", 401);
  }

  if (!orgId) {
    throw new AuthError("Active organization required", 403);
  }

  const role = mapClerkOrgRole(orgRole);

  if (!role) {
    throw new AuthError("Unsupported organization role", 403);
  }

  return {
    clerkUserId: userId,
    clerkOrganizationId: orgId,
    role,
  };
}
