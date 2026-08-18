import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/server/pdf/hash";

describe("sha256Hex", () => {
  it("returns a stable lowercase hex digest", () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex(new TextEncoder().encode("formulieren"))).toBe(
      sha256Hex(new TextEncoder().encode("formulieren")),
    );
    expect(sha256Hex(new TextEncoder().encode("a"))).not.toBe(
      sha256Hex(new TextEncoder().encode("b")),
    );
  });
});
