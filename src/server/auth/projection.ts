export type ClerkUserProjectionInput = {
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses: { emailAddress: string }[];
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type UserProjection = {
  email: string;
  displayName: string;
};

export function projectClerkUser(
  user: ClerkUserProjectionInput,
): UserProjection | null {
  const email =
    user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

  if (!email) {
    return null;
  }

  const nameFromParts = [user.firstName, user.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();

  const displayName = user.fullName?.trim() || nameFromParts || email;

  return {
    email: email.trim().toLowerCase(),
    displayName,
  };
}

export function isArchived(archivedAt: Date | null | undefined): boolean {
  return archivedAt != null;
}
