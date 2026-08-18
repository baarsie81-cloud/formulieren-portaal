export type AppRole = "admin" | "member";

const CLERK_ORG_ROLE_MAP: Record<string, AppRole> = {
  "org:admin": "admin",
  admin: "admin",
  "org:member": "member",
  member: "member",
};

export function mapClerkOrgRole(role: string | null | undefined): AppRole | null {
  if (!role) {
    return null;
  }

  return CLERK_ORG_ROLE_MAP[role] ?? null;
}
