import { eq } from "drizzle-orm";
import { organizations, users } from "./schema";

/** Clerk organization.id → organizations.clerk_organization_id */
export function organizationByClerkId(clerkOrganizationId: string) {
  return eq(organizations.clerkOrganizationId, clerkOrganizationId);
}

/** Clerk user.id → users.clerk_user_id */
export function userByClerkId(clerkUserId: string) {
  return eq(users.clerkUserId, clerkUserId);
}
