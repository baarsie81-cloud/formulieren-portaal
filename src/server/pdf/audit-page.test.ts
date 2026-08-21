import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { SIGNATURE_DECLARATION_TEXT } from "@/lib/constants";
import {
  appendAuditPage,
  collectAuditPageLines,
  type FinalPdfAuditInfo,
} from "@/server/pdf/audit-page";

const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const AUDIT: FinalPdfAuditInfo = {
  organizationName: "Praktijk Berg",
  documentName: "Intakeformulier",
  signerName: "Ada Berg",
  signedAt: new Date("2026-08-18T17:00:00.000Z"),
  declarationText: SIGNATURE_DECLARATION_TEXT,
  formDocumentId: "55555555-5555-4555-8555-555555555555",
  formRequestId: "44444444-4444-4444-8444-444444444444",
  templateSha256: "a".repeat(64),
};

describe("collectAuditPageLines", () => {
  it("includes all required audit fields without final_pdf_sha256", () => {
    const lines = collectAuditPageLines(AUDIT);
    const combined = lines.join("\n");

    expect(combined).toContain("Elektronisch ondertekend document");
    expect(combined).toContain(AUDIT.organizationName);
    expect(combined).toContain(AUDIT.documentName);
    expect(combined).toContain(AUDIT.signerName);
    expect(combined).toContain(AUDIT.declarationText);
    expect(combined).toContain(AUDIT.formDocumentId);
    expect(combined).toContain(AUDIT.formRequestId);
    expect(combined).toContain(AUDIT.templateSha256);
    expect(combined).toContain("Europe/Amsterdam");
    expect(combined).toContain("(UTC)");
    expect(combined).toContain("definitief opgeslagen");
    expect(combined).not.toMatch(/final_pdf_sha256/i);
  });
});

describe("appendAuditPage", () => {
  it("adds one page and can render the signature on the audit page", async () => {
    const pdf = await PDFDocument.create();
    const png = await pdf.embedPng(PNG_BYTES);

    await appendAuditPage(pdf, AUDIT, png, png);

    const bytes = await pdf.save();
    const loaded = await PDFDocument.load(bytes);

    expect(loaded.getPageCount()).toBe(1);
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(Buffer.from(bytes).toString("latin1")).toContain("/Subtype /Image");
  });
});

describe("appendAuditPage dual signatures", () => {
  it("embeds both client and organization signature images", async () => {
    const pdf = await PDFDocument.create();
    const clientPng = await pdf.embedPng(PNG_BYTES);
    const organizationPng = await pdf.embedPng(PNG_BYTES);

    await appendAuditPage(pdf, AUDIT, clientPng, organizationPng);

    const bytes = await pdf.save();
    const loaded = await PDFDocument.load(bytes);
    const latin1 = Buffer.from(bytes).toString("latin1");

    expect(loaded.getPageCount()).toBe(1);
    expect(latin1).toContain("/Subtype /Image");
    // Two embedded images (client + organization)
    expect(latin1.split("/Subtype /Image").length - 1).toBeGreaterThanOrEqual(2);
  });
});
