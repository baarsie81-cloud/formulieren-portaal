import {
  PDFDocument,
  PDFField,
  PDFSignature,
} from "pdf-lib";
import { ValidationError } from "@/server/errors";
import { fillAcroForm, type FieldValueMap } from "@/server/pdf/fill";
import {
  type FieldSchemaSnapshot,
} from "@/server/forms/snapshot";
import {
  appendAuditPage,
  type FinalPdfAuditInfo,
} from "@/server/pdf/audit-page";

export type { FinalPdfAuditInfo };

export async function buildFinalPdfBytes(input: {
  templateBytes: Uint8Array;
  snapshot: readonly FieldSchemaSnapshot[];
  values: FieldValueMap;
  signaturePngBytes: Uint8Array;
  organizationSignaturePngBytes: Uint8Array;
  audit: FinalPdfAuditInfo;
}): Promise<Uint8Array> {
  if (!input.organizationSignaturePngBytes.length) {
    throw new ValidationError(
      "Organisatiehandtekening ontbreekt. Neem contact op met de praktijk.",
    );
  }

  const filled = await fillAcroForm(input.templateBytes, input.snapshot, input.values);
  const pdf = await PDFDocument.load(filled, {
    ignoreEncryption: false,
    updateMetadata: false,
  });

  const clientSignaturePng = await pdf.embedPng(input.signaturePngBytes);
  const organizationSignaturePng = await pdf.embedPng(
    input.organizationSignaturePngBytes,
  );

  const form = pdf.getForm();
  const signatureFields = input.snapshot.filter(
    (field) => field.fieldType === "signature_area",
  );

  for (const field of signatureFields) {
    try {
      drawSignatureOnField(
        pdf,
        form.getField(field.pdfFieldName),
        clientSignaturePng,
      );
    } catch {
      // Snapshot may reference a signature widget that is absent from the PDF bytes.
    }
  }

  try {
    form.flatten();
  } catch {
    // Some templates cannot flatten cleanly; filled values remain in the AcroForm.
  }

  await appendAuditPage(
    pdf,
    input.audit,
    clientSignaturePng,
    organizationSignaturePng,
  );

  return pdf.save();
}


function drawSignatureOnField(
  pdf: PDFDocument,
  field: PDFField,
  png: Awaited<ReturnType<PDFDocument["embedPng"]>>,
): boolean {
  if (!(field instanceof PDFSignature)) {
    return false;
  }

  const widget = field.acroField.getWidgets()[0];
  const rect = widget?.getRectangle();
  const pageRef = widget?.P();

  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const page = pageForWidget(pdf, pageRef);

  page.drawImage(png, {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });

  return true;
}

function pageForWidget(
  pdf: PDFDocument,
  pageRef: { objectNumber: number; generationNumber: number } | undefined,
) {
  if (!pageRef) {
    return pdf.getPages()[0] ?? (() => {
      throw new ValidationError("PDF has no pages");
    })();
  }

  const page = pdf
    .getPages()
    .find(
      (entry) =>
        entry.ref.objectNumber === pageRef.objectNumber &&
        entry.ref.generationNumber === pageRef.generationNumber,
    );

  return page ?? pdf.getPages()[0] ?? (() => {
    throw new ValidationError("PDF has no pages");
  })();
}
