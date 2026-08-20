import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { SIGNATURE_DECLARATION_TEXT } from "@/lib/constants";
import { collectAuditPageLines } from "@/server/pdf/audit-page";
import type { FieldSchemaSnapshot } from "@/server/forms/snapshot";
import { buildFinalPdfBytes } from "@/server/pdf/finalize";
import { sha256Hex } from "@/server/pdf/hash";

const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const AUDIT = {
  organizationName: "Praktijk Berg",
  documentName: "Intakeformulier",
  signerName: "Ada Berg",
  signedAt: new Date("2026-08-18T17:00:00.000Z"),
  declarationText: SIGNATURE_DECLARATION_TEXT,
  formDocumentId: "55555555-5555-4555-8555-555555555555",
  formRequestId: "44444444-4444-4444-8444-444444444444",
  templateSha256: "a".repeat(64),
};

const NO_GEOMETRY = {
  x: null,
  y: null,
  width: null,
  height: null,
  pageWidth: null,
  pageHeight: null,
} as const;

function snap(
  field: Omit<FieldSchemaSnapshot, keyof typeof NO_GEOMETRY>,
): FieldSchemaSnapshot {
  return { ...field, ...NO_GEOMETRY };
}

describe("buildFinalPdfBytes", () => {
  it("appends an audit page to the template PDF", async () => {
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
        snap({
          pdfFieldName: "client_name",
          valueKey: "client_name",
          fieldType: "text",
          isRequired: true,
          sortOrder: 0,
          pageNumber: 1,
        }),
      ],
      values: { client_name: "Ada Berg" },
      signaturePngBytes: PNG_BYTES,
      audit: AUDIT,
    });

    const finalPdf = await PDFDocument.load(finalBytes);

    expect(finalPdf.getPageCount()).toBe(2);
    expect(collectAuditPageLines(AUDIT).join("\n")).toContain(AUDIT.signerName);
  });

  it("does not embed final_pdf_sha256 in the PDF bytes", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();

    const finalBytes = await buildFinalPdfBytes({
      templateBytes: await pdf.save(),
      snapshot: [],
      values: {},
      signaturePngBytes: PNG_BYTES,
      audit: AUDIT,
    });

    const finalPdfSha256 = sha256Hex(finalBytes);

    expect(Buffer.from(finalBytes).toString("latin1")).not.toContain(finalPdfSha256);
  });

  it("embeds the signature on the audit page when the template has no signature widget", async () => {
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
        snap({
          pdfFieldName: "note",
          valueKey: "note",
          fieldType: "text",
          isRequired: false,
          sortOrder: 0,
          pageNumber: 1,
        }),
      ],
      values: { note: "Klaar" },
      signaturePngBytes: PNG_BYTES,
      audit: AUDIT,
    });

    const finalPdf = await PDFDocument.load(finalBytes);

    expect(finalPdf.getPageCount()).toBe(2);
    expect(Buffer.from(finalBytes).toString("latin1")).toContain("/Subtype /Image");
  });

  it("falls back to the audit page when the snapshot references a missing signature widget", async () => {
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
        snap({
          pdfFieldName: "note",
          valueKey: "note",
          fieldType: "text",
          isRequired: false,
          sortOrder: 0,
          pageNumber: 1,
        }),
        snap({
          pdfFieldName: "missing_signature",
          valueKey: "signature1",
          fieldType: "signature_area",
          isRequired: true,
          sortOrder: 1,
          pageNumber: 1,
        }),
      ],
      values: { note: "Klaar" },
      signaturePngBytes: PNG_BYTES,
      audit: AUDIT,
    });

    const finalPdf = await PDFDocument.load(finalBytes);

    expect(finalPdf.getPageCount()).toBe(2);
    expect(Buffer.from(finalBytes).toString("latin1")).toContain("/Subtype /Image");
  });
});
