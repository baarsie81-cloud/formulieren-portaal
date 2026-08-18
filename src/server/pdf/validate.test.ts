import { describe, expect, it } from "vitest";
import { MAX_TEMPLATE_PDF_BYTES } from "@/lib/constants";
import { ValidationError } from "@/server/errors";
import { assertPdfBytes } from "@/server/pdf/validate";

describe("assertPdfBytes", () => {
  it("accepts a PDF header", () => {
    expect(() => assertPdfBytes(new TextEncoder().encode("%PDF-1.7\n"))).not.toThrow();
  });

  it("rejects empty, oversized, and non-PDF bytes", () => {
    expect(() => assertPdfBytes(new Uint8Array())).toThrow(ValidationError);
    expect(() => assertPdfBytes(new TextEncoder().encode("not-a-pdf"))).toThrow(
      ValidationError,
    );
    expect(() =>
      assertPdfBytes(new Uint8Array(MAX_TEMPLATE_PDF_BYTES + 1)),
    ).toThrow(ValidationError);
  });
});
