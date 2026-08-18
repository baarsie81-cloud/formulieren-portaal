import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "@/server/db/postgres-errors";

describe("isUniqueViolation", () => {
  it("detects PostgreSQL unique violations", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(
      isUniqueViolation(
        { code: "23505", constraint: "clients_organization_id_email_active_idx" },
        "clients_organization_id_email_active_idx",
      ),
    ).toBe(true);
    expect(
      isUniqueViolation({
        cause: { code: "23505", constraint: "clients_organization_id_email_active_idx" },
      }),
    ).toBe(true);
  });

  it("rejects other errors", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(new Error("unique"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(
      isUniqueViolation(
        { code: "23505", constraint: "other_constraint" },
        "clients_organization_id_email_active_idx",
      ),
    ).toBe(false);
  });
});
