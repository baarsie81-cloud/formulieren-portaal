import { describe, expect, it } from "vitest";
import { parseSignaturePngDataUrl } from "@/server/pdf/signature-image";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("parseSignaturePngDataUrl", () => {
  it("accepts a valid PNG data URL", () => {
    const bytes = parseSignaturePngDataUrl(`data:image/png;base64,${PNG_BASE64}`);

    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(bytes[0]).toBe(0x89);
  });

  it("rejects non-PNG data URLs", () => {
    expect(() =>
      parseSignaturePngDataUrl("data:image/jpeg;base64,/9j/4AAQ"),
    ).toThrow("Handtekening moet een PNG-afbeelding zijn");
  });
});
