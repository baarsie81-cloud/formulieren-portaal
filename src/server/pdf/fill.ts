import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFField,
  PDFOptionList,
  PDFRadioGroup,
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
  const text = typeof value === "boolean" ? "" : value;

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
    const clipped = fieldType === "textarea" ? text.slice(0, 5_000) : text.slice(0, 500);

    pdfField.setText(clipped);
    return;
  }

  if (pdfField instanceof PDFDropdown || pdfField instanceof PDFOptionList) {
    const options = pdfField.getOptions();
    const option = matchExistingOption(options, text);

    if (option) {
      pdfField.select(option);
      return;
    }

    // DIAG: temporary – remove before release
    console.error("[fill-diag] option mismatch", {
      pdfFieldName: pdfField.getName(),
      runtimeType: pdfField.constructor.name,
      storedFieldType: fieldType,
      valuePresent: text.length > 0,
      valueLength: text.length,
      availableOptions: options,
    });

    throw new ValidationError("Cannot fill PDF field");
  }

  if (pdfField instanceof PDFRadioGroup) {
    const options = pdfField.getOptions();
    const option = matchExistingOption(options, text);

    if (option) {
      pdfField.select(option);
      return;
    }

    // DIAG: temporary – remove before release
    console.error("[fill-diag] radio mismatch", {
      pdfFieldName: pdfField.getName(),
      runtimeType: pdfField.constructor.name,
      storedFieldType: fieldType,
      valuePresent: text.length > 0,
      valueLength: text.length,
      availableOptions: options,
    });

    throw new ValidationError("Cannot fill PDF field");
  }

  // DIAG: temporary – remove before release
  console.error("[fill-diag] unsupported field type", {
    pdfFieldName: pdfField.getName(),
    runtimeType: pdfField.constructor.name,
    storedFieldType: fieldType,
    valuePresent: text.length > 0,
    valueLength: text.length,
  });

  throw new ValidationError("Cannot fill PDF field");
}

function matchExistingOption(options: string[], value: string): string | null {
  if (!value) {
    return null;
  }

  return options.find((option) => option === value) ?? null;
}
