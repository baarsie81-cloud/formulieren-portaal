import { describe, expect, it } from "vitest";
import { mapClerkOrgRole } from "@/server/auth/roles";

describe("mapClerkOrgRole", () => {
  it("maps Clerk organization admin roles", () => {
    expect(mapClerkOrgRole("org:admin")).toBe("admin");
    expect(mapClerkOrgRole("admin")).toBe("admin");
  });

  it("maps Clerk organization member roles", () => {
    expect(mapClerkOrgRole("org:member")).toBe("member");
    expect(mapClerkOrgRole("member")).toBe("member");
  });

  it("rejects missing or unknown roles", () => {
    expect(mapClerkOrgRole(null)).toBeNull();
    expect(mapClerkOrgRole(undefined)).toBeNull();
    expect(mapClerkOrgRole("org:guest")).toBeNull();
  });
});
