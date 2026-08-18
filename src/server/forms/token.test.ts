import { describe, expect, it } from "vitest";
import { generateRawSecret, hashSecret, hashesMatch, isRawToken } from "@/server/forms/token";

describe("form tokens", () => {
  it("generates a high-entropy raw token that is not stored as-is", () => {
    const raw = generateRawSecret();

    expect(isRawToken(raw)).toBe(true);
    expect(hashSecret(raw)).not.toBe(raw);
    expect(hashSecret(raw)).toBe(hashSecret(raw));
    expect(hashSecret(raw)).not.toBe(hashSecret(generateRawSecret()));
  });

  it("compares hashes in a length-safe way", () => {
    const hash = hashSecret("token-a");

    expect(hashesMatch(hash, hash)).toBe(true);
    expect(hashesMatch(hash, hashSecret("token-b"))).toBe(false);
    expect(hashesMatch(hash, "deadbeef")).toBe(false);
    expect(hashesMatch("", "")).toBe(false);
  });
});
