import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildFinalPdfBytes } from "@/server/pdf/finalize";

const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

describe("buildFinalPdfBytes", () => {
  it("fills values and produces a PDF byte stream", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    pdf.getForm().createTextField("client_name").addToPage(page, {
      x: 50,
      y: 700,
      width: 200,
      height: 20,
    });

    const finalBytes = await buildFinalPdfBytes({
      templateBytes: await pdf.save(),
      snapshot: [
        {
          pdfFieldName: "client_name",
          valueKey: "client_name",
          fieldType: "text",
          isRequired: true,
          sortOrder: 0,
          pageNumber: 1,
        },
      ],
      values: { client_name: "Ada Berg" },
      signaturePngBytes: null,
    });

    const finalPdf = await PDFDocument.load(finalBytes);
    expect(finalPdf.getPageCount()).toBe(1);
    expect(finalBytes.byteLength).toBeGreaterThan(0);
  });

  it("accepts a signature PNG without throwing when no signature widgets exist", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    pdf.getForm().createTextField("note").addToPage(page, {
      x: 40,
      y: 700,
      width: 200,
      height: 20,
    });

    const finalBytes = await buildFinalPdfBytes({
      templateBytes: await pdf.save(),
      snapshot: [
        {
          pdfFieldName: "note",
          valueKey: "note",
          fieldType: "text",
          isRequired: false,
          sortOrder: 0,
          pageNumber: 1,
        },
        {
          pdfFieldName: "missing_signature",
          valueKey: "signature1",
          fieldType: "signature_area",
          isRequired: true,
          sortOrder: 1,
          pageNumber: 1,
        },
      ],
      values: { note: "Klaar" },
      signaturePngBytes: PNG_BYTES,
    });

    expect(finalBytes.byteLength).toBeGreaterThan(0);
  });
});
