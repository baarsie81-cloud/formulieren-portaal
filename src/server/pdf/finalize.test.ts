import { PDFDocument, PDFString } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { SIGNATURE_DECLARATION_TEXT } from "@/lib/constants";
import { collectAuditPageLines } from "@/server/pdf/audit-page";
import type { FieldSchemaSnapshot } from "@/server/forms/snapshot";
import { buildFinalPdfBytes } from "@/server/pdf/finalize";
import { sha256Hex } from "@/server/pdf/hash";
import { ValidationError } from "@/server/errors";

/** 1×1 PNG */
const CLIENT_PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

/** 2×3 PNG — distinct dimensions from the client signature image */
const ORGANIZATION_PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAEklEQVR42mP8z8BQz0BFwzAFAFYuAs5Y4iqcAAAAAElFTkSuQmCC",
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
  field: Omit<FieldSchemaSnapshot, keyof typeof NO_GEOMETRY | "signatureRole"> & {
    signatureRole?: FieldSchemaSnapshot["signatureRole"];
  },
): FieldSchemaSnapshot {
  return {
    signatureRole: "client",
    ...field,
    ...NO_GEOMETRY,
  };
}

async function createPdfWithSignatureFields(
  fields: { name: string; rect: [number, number, number, number] }[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const form = pdf.getForm();
  const context = pdf.context;

  for (const field of fields) {
    const dict = context.obj({
      FT: "Sig",
      T: PDFString.of(field.name),
      Rect: field.rect,
      Subtype: "Widget",
      F: 4,
      P: page.ref,
    });
    const ref = context.register(dict);
    form.acroForm.addField(ref);
    page.node.addAnnot(ref);
  }

  return pdf.save();
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
      signaturePngBytes: CLIENT_PNG_BYTES,
      organizationSignaturePngBytes: ORGANIZATION_PNG_BYTES,
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
      signaturePngBytes: CLIENT_PNG_BYTES,
      organizationSignaturePngBytes: ORGANIZATION_PNG_BYTES,
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
      signaturePngBytes: CLIENT_PNG_BYTES,
      organizationSignaturePngBytes: ORGANIZATION_PNG_BYTES,
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
      signaturePngBytes: CLIENT_PNG_BYTES,
      organizationSignaturePngBytes: ORGANIZATION_PNG_BYTES,
      audit: AUDIT,
    });

    const finalPdf = await PDFDocument.load(finalBytes);

    expect(finalPdf.getPageCount()).toBe(2);
    expect(Buffer.from(finalBytes).toString("latin1")).toContain("/Subtype /Image");
  });

  it("places the client PNG on a single intake signature field", async () => {
    const templateBytes = await createPdfWithSignatureFields([
      { name: "Signature1", rect: [50, 100, 250, 160] },
    ]);

    const finalBytes = await buildFinalPdfBytes({
      templateBytes,
      snapshot: [
        snap({
          pdfFieldName: "Signature1",
          valueKey: "signature1",
          fieldType: "signature_area",
          isRequired: true,
          sortOrder: 0,
          pageNumber: 1,
        }),
      ],
      values: {},
      signaturePngBytes: CLIENT_PNG_BYTES,
      organizationSignaturePngBytes: ORGANIZATION_PNG_BYTES,
      audit: AUDIT,
    });

    const asText = Buffer.from(finalBytes).toString("latin1");

    expect(asText).toContain("/Width 1");
    expect(asText).toContain("/Width 2");
  });

  it("places client PNG on form signature fields and both PNGs on the audit page", async () => {
    const templateBytes = await createPdfWithSignatureFields([
      { name: "Signature1", rect: [50, 100, 250, 160] },
    ]);

    const finalBytes = await buildFinalPdfBytes({
      templateBytes,
      snapshot: [
        snap({
          pdfFieldName: "Signature1",
          valueKey: "signature1",
          fieldType: "signature_area",
          isRequired: true,
          sortOrder: 0,
          pageNumber: 1,
        }),
      ],
      values: {},
      signaturePngBytes: CLIENT_PNG_BYTES,
      organizationSignaturePngBytes: ORGANIZATION_PNG_BYTES,
      audit: {
        ...AUDIT,
        documentName: "Contract",
        organizationSignerName: "Praktijk Berg",
        organizationSignerTitle: "Directeur",
      },
    });

    const asText = Buffer.from(finalBytes).toString("latin1");

    expect(asText).toContain("/Width 1");
    expect(asText).toContain("/Width 2");
    expect(asText).toContain("/Height 3");
    expect(
      collectAuditPageLines({
        ...AUDIT,
        organizationSignerName: "Praktijk Berg",
        organizationSignerTitle: "Directeur",
      }).join("\n"),
    ).toContain("Organisatieondertekenaar: Praktijk Berg (Directeur)");
  });

  it("stamps client PNG on legacy signature fields and still requires organization PNG on audit", async () => {
    const templateBytes = await createPdfWithSignatureFields([
      { name: "Signature1", rect: [50, 100, 250, 160] },
      { name: "Signature2", rect: [50, 200, 250, 260] },
    ]);

    const legacySnapshot = [
      {
        pdfFieldName: "Signature1",
        valueKey: "signature1",
        fieldType: "signature_area" as const,
        isRequired: true,
        sortOrder: 0,
        pageNumber: 1,
      },
      {
        pdfFieldName: "Signature2",
        valueKey: "signature2",
        fieldType: "signature_area" as const,
        isRequired: true,
        sortOrder: 1,
        pageNumber: 1,
      },
    ];

    const { parseFieldsSchemaSnapshot } = await import("@/server/forms/snapshot");
    const parsed = parseFieldsSchemaSnapshot(legacySnapshot);

    expect(parsed?.every((field) => field.signatureRole === "client")).toBe(true);

    const finalBytes = await buildFinalPdfBytes({
      templateBytes,
      snapshot: parsed!,
      values: {},
      signaturePngBytes: CLIENT_PNG_BYTES,
      organizationSignaturePngBytes: ORGANIZATION_PNG_BYTES,
      audit: AUDIT,
    });

    const asText = Buffer.from(finalBytes).toString("latin1");

    expect(asText).toContain("/Width 1");
    expect(asText).toContain("/Width 2");
  });

  it("fails clearly when the organization signature PNG is missing", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();

    await expect(
      buildFinalPdfBytes({
        templateBytes: await pdf.save(),
        snapshot: [],
        values: {},
        signaturePngBytes: CLIENT_PNG_BYTES,
        organizationSignaturePngBytes: new Uint8Array(),
        audit: AUDIT,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
