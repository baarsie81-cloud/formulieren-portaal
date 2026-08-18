import { describe, expect, it } from "vitest";
import { hashIp } from "@/server/forms/ip-hash";

describe("hashIp", () => {
  it("stores an HMAC instead of the raw IP", () => {
    const ip = "203.0.113.10";
    const hashed = hashIp("test-secret", ip);

    expect(hashed).not.toBe(ip);
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
    expect(hashed).toBe(hashIp("test-secret", ip));
    expect(hashed).not.toBe(hashIp("other-secret", ip));
    expect(hashed).not.toBe(hashIp("test-secret", "203.0.113.11"));
  });
});
