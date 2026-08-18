import {
  PDFCheckBox,
  PDFDocument,
  PDFField,
  PDFSignature,
  PDFTextField,
} from "pdf-lib";
import type { DocumentFieldType } from "@/lib/constants";
import { ValidationError } from "@/server/errors";

export type FillablePdfField = {
  pdfFieldName: string;
  valueKey: string;
  fieldType: DocumentFieldType;
};

export type FieldValueMap = Record<string, string | boolean>;

export async function fillAcroForm(
  bytes: Uint8Array,
  fields: readonly FillablePdfField[],
  values: FieldValueMap,
): Promise<Uint8Array> {
  let pdf: PDFDocument;

  try {
    pdf = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
  } catch {
    throw new ValidationError("File must be a valid PDF");
  }

  const form = pdf.getForm();

  for (const field of fields) {
    if (field.fieldType === "signature_area") {
      continue;
    }

    const value = values[field.valueKey];

    if (value === undefined) {
      continue;
    }

    applyFieldValue(form.getField(field.pdfFieldName), field.fieldType, value);
  }

  try {
    form.updateFieldAppearances();
  } catch {
    // Some templates use fonts pdf-lib cannot subset. Values remain in the AcroForm.
  }

  return pdf.save();
}

function applyFieldValue(
  pdfField: PDFField,
  fieldType: DocumentFieldType,
  value: string | boolean,
): void {
  if (pdfField instanceof PDFSignature) {
    return;
  }

  if (pdfField instanceof PDFCheckBox) {
    if (value === true || value === "true") {
      pdfField.check();
    } else {
      pdfField.uncheck();
    }
    return;
  }

  if (pdfField instanceof PDFTextField) {
    const text = typeof value === "boolean" ? "" : value;
    const clipped = fieldType === "textarea" ? text.slice(0, 5_000) : text.slice(0, 500);

    pdfField.setText(clipped);
    return;
  }

  throw new ValidationError("Cannot fill PDF field");
}
