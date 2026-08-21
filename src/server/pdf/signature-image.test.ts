import { describe, expect, it } from "vitest";
import {
  parseSignaturePngDataUrl,
  readSignaturePngBytes,
} from "@/server/pdf/signature-image";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const PNG_BYTES = Uint8Array.from(Buffer.from(PNG_BASE64, "base64"));

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

describe("readSignaturePngBytes", () => {
  it("accepts a PNG file", async () => {
    const file = new File([PNG_BYTES], "signature.png", { type: "image/png" });
    const bytes = await readSignaturePngBytes(file);

    expect(bytes[0]).toBe(0x89);
    expect(bytes.byteLength).toBe(PNG_BYTES.byteLength);
  });

  it("rejects a non-PNG content type", async () => {
    const file = new File([PNG_BYTES], "signature.jpg", { type: "image/jpeg" });

    await expect(readSignaturePngBytes(file)).rejects.toThrow("File must be a PNG");
  });

  it("rejects bytes without a PNG header", async () => {
    const file = new File([Uint8Array.from([1, 2, 3, 4])], "x.png", {
      type: "image/png",
    });

    await expect(readSignaturePngBytes(file)).rejects.toThrow(
      "Handtekening moet een PNG-afbeelding zijn",
    );
  });
});
