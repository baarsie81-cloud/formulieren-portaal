import { PDFDocument, StandardFonts, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import { formatAuditSignedAt } from "@/lib/datetime";

export type FinalPdfAuditInfo = {
  organizationName: string;
  documentName: string;
  signerName: string;
  signedAt: Date;
  declarationText: string;
  formDocumentId: string;
  formRequestId: string;
  templateSha256: string;
  organizationSignerName?: string;
  organizationSignerTitle?: string;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const LINE_HEIGHT = 14;

const CLOSING_STATEMENT =
  "Dit document is elektronisch ondertekend en na afronding definitief opgeslagen.";

/** Plain-text lines rendered on the audit page (used for tests and PDF generation). */
export function collectAuditPageLines(audit: FinalPdfAuditInfo): string[] {
  const lines = [
    "Elektronisch ondertekend document",
    `Organisatie: ${audit.organizationName}`,
    `Document: ${audit.documentName}`,
    `Ondertekenaar: ${audit.signerName}`,
    `Datum/tijd ondertekening: ${formatAuditSignedAt(audit.signedAt)}`,
  ];

  if (audit.organizationSignerName) {
    const title = audit.organizationSignerTitle?.trim();
    lines.push(
      title
        ? `Organisatieondertekenaar: ${audit.organizationSignerName} (${title})`
        : `Organisatieondertekenaar: ${audit.organizationSignerName}`,
    );
  }

  lines.push(
    "Akkoordverklaring:",
    audit.declarationText,
    `form_document_id: ${audit.formDocumentId}`,
    `form_request_id: ${audit.formRequestId}`,
    `template_sha256: ${audit.templateSha256}`,
    CLOSING_STATEMENT,
  );

  return lines;
}

export async function appendAuditPage(
  pdf: PDFDocument,
  audit: FinalPdfAuditInfo,
  clientSignaturePng: PDFImage | null,
  organizationSignaturePng: PDFImage | null,
): Promise<void> {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN_X;

  y = drawLine(page, bold, 16, MARGIN_X, y, "Elektronisch ondertekend document");
  y -= 8;

  y = drawField(page, regular, bold, y, "Organisatie", audit.organizationName);
  y = drawField(page, regular, bold, y, "Document", audit.documentName);
  y = drawField(page, regular, bold, y, "Ondertekenaar", audit.signerName);
  y = drawField(page, regular, bold, y, "Datum/tijd ondertekening", formatAuditSignedAt(audit.signedAt));

  if (audit.organizationSignerName) {
    const title = audit.organizationSignerTitle?.trim();
    y = drawField(
      page,
      regular,
      bold,
      y,
      "Organisatieondertekenaar",
      title ? `${audit.organizationSignerName} (${title})` : audit.organizationSignerName,
    );
  }

  y = drawWrappedLabel(page, regular, bold, y, "Akkoordverklaring", audit.declarationText);

  y = drawField(page, regular, bold, y, "form_document_id", audit.formDocumentId);
  y = drawField(page, regular, bold, y, "form_request_id", audit.formRequestId);
  y = drawField(page, regular, bold, y, "template_sha256", audit.templateSha256);

  y -= 4;
  y = drawWrapped(page, regular, 10, MARGIN_X, y, CLOSING_STATEMENT, CONTENT_WIDTH);

  const signatureWidth = 220;
  const signatureHeight = 70;

  if (clientSignaturePng) {
    y = drawSignatureBlock(
      page,
      bold,
      y,
      "Handtekening cliënt",
      clientSignaturePng,
      signatureWidth,
      signatureHeight,
    );
  }

  if (organizationSignaturePng) {
    y = drawSignatureBlock(
      page,
      bold,
      y,
      "Handtekening organisatie",
      organizationSignaturePng,
      signatureWidth,
      signatureHeight,
    );
  }
}

function drawSignatureBlock(
  page: PDFPage,
  bold: PDFFont,
  y: number,
  label: string,
  signaturePng: PDFImage,
  signatureWidth: number,
  signatureHeight: number,
): number {
  y -= 10;
  page.drawText(label, {
    x: MARGIN_X,
    y: y - 12,
    size: 11,
    font: bold,
  });
  y -= 24;

  page.drawImage(signaturePng, {
    x: MARGIN_X,
    y: y - signatureHeight,
    width: signatureWidth,
    height: signatureHeight,
  });

  return y - signatureHeight - 4;
}

function drawField(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  y: number,
  label: string,
  value: string,
): number {
  page.drawText(`${label}:`, {
    x: MARGIN_X,
    y: y - 12,
    size: 11,
    font: bold,
  });

  return drawWrapped(page, regular, 11, MARGIN_X, y - LINE_HEIGHT, value, CONTENT_WIDTH);
}

function drawWrappedLabel(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  y: number,
  label: string,
  value: string,
): number {
  page.drawText(`${label}:`, {
    x: MARGIN_X,
    y: y - 12,
    size: 11,
    font: bold,
  });

  return drawWrapped(page, regular, 11, MARGIN_X, y - LINE_HEIGHT, value, CONTENT_WIDTH);
}

function drawLine(
  page: PDFPage,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  text: string,
): number {
  page.drawText(text, { x, y: y - size, size, font });
  return y - size - LINE_HEIGHT;
}

function drawWrapped(
  page: PDFPage,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  text: string,
  maxWidth: number,
): number {
  let cursorY = y;

  for (const line of wrapText(text, font, size, maxWidth)) {
    page.drawText(line, { x, y: cursorY - size, size, font });
    cursorY -= LINE_HEIGHT;
  }

  return cursorY - 4;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = words[0] ?? "";

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  lines.push(current);
  return lines;
}
