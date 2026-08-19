import { describe, expect, it } from "vitest";
import {
  effectiveRequestStatus,
  isSignableRequestStatus,
  isWritableRequestStatus,
} from "@/server/forms/status";

describe("effectiveRequestStatus", () => {
  it("marks open requests expired after expiresAt without changing terminal states", () => {
    const past = new Date("2026-01-01T00:00:00.000Z");
    const future = new Date("2026-12-01T00:00:00.000Z");
    const now = new Date("2026-06-01T00:00:00.000Z");

    expect(effectiveRequestStatus("sent", past, now)).toBe("expired");
    expect(effectiveRequestStatus("in_progress", future, now)).toBe("in_progress");
    expect(effectiveRequestStatus("cancelled", past, now)).toBe("cancelled");
    expect(effectiveRequestStatus("completed", past, now)).toBe("completed");
  });

  it("only allows writes on sent, opened, and in_progress", () => {
    expect(isWritableRequestStatus("sent")).toBe(true);
    expect(isWritableRequestStatus("cancelled")).toBe(false);
    expect(isWritableRequestStatus("expired")).toBe(false);
  });

  it("allows signing while opened or in_progress", () => {
    expect(isSignableRequestStatus("opened")).toBe(true);
    expect(isSignableRequestStatus("in_progress")).toBe(true);
    expect(isSignableRequestStatus("completed")).toBe(false);
  });
});
