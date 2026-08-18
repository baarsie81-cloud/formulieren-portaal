import { describe, expect, it } from "vitest";
import { isArchived, projectClerkUser } from "@/server/auth/projection";

describe("projectClerkUser", () => {
  it("prefers the primary email and full name", () => {
    expect(
      projectClerkUser({
        primaryEmailAddress: { emailAddress: "Ada@Praktijk.NL" },
        emailAddresses: [{ emailAddress: "other@praktijk.nl" }],
        fullName: "Ada Berg",
        firstName: "Ada",
        lastName: "Berg",
      }),
    ).toEqual({
      email: "ada@praktijk.nl",
      displayName: "Ada Berg",
    });
  });

  it("falls back to first and last name, then email", () => {
    expect(
      projectClerkUser({
        primaryEmailAddress: null,
        emailAddresses: [{ emailAddress: "lid@praktijk.nl" }],
        fullName: null,
        firstName: "Jan",
        lastName: "de Vries",
      }),
    ).toEqual({
      email: "lid@praktijk.nl",
      displayName: "Jan de Vries",
    });

    expect(
      projectClerkUser({
        primaryEmailAddress: null,
        emailAddresses: [{ emailAddress: "lid@praktijk.nl" }],
        fullName: "   ",
        firstName: null,
        lastName: null,
      }),
    ).toEqual({
      email: "lid@praktijk.nl",
      displayName: "lid@praktijk.nl",
    });
  });

  it("rejects a Clerk user without email", () => {
    expect(
      projectClerkUser({
        primaryEmailAddress: null,
        emailAddresses: [],
        fullName: "Ada",
        firstName: "Ada",
        lastName: null,
      }),
    ).toBeNull();
  });
});

describe("isArchived", () => {
  it("treats a timestamp as archived", () => {
    expect(isArchived(null)).toBe(false);
    expect(isArchived(undefined)).toBe(false);
    expect(isArchived(new Date("2026-08-18T12:00:00.000Z"))).toBe(true);
  });
});
