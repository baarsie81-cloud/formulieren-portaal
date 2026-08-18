import { describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/datetime";

describe("formatDateTime", () => {
  it("formats UTC timestamps in Europe/Amsterdam", () => {
    const formatted = formatDateTime(new Date("2026-08-18T17:00:00.000Z"));

    expect(formatted).toContain("18");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("19:00");
  });
});
