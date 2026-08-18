import {
  PDFButton,
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

export type ExtractedPdfField = {
  pdfFieldName: string;
  valueKey: string;
  fieldType: DocumentFieldType;
  pageNumber: number;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  isRequired: boolean;
};

export type ExtractedPdf = {
  pageCount: number;
  fields: ExtractedPdfField[];
};

export async function extractPdfFields(bytes: Uint8Array): Promise<ExtractedPdf> {
  let pdf: PDFDocument;

  try {
    pdf = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
  } catch {
    throw new ValidationError("File must be a valid PDF");
  }

  let formFields: PDFField[];

  try {
    formFields = pdf.getForm().getFields();
  } catch {
    return { pageCount: pdf.getPageCount(), fields: [] };
  }

  const usedValueKeys = new Set<string>();
  const usedPdfNames = new Set<string>();
  const fields: ExtractedPdfField[] = [];

  for (const field of formFields) {
    if (field instanceof PDFButton) {
      continue;
    }

    const pdfFieldName = field.getName().trim();

    if (!pdfFieldName || usedPdfNames.has(pdfFieldName)) {
      continue;
    }

    usedPdfNames.add(pdfFieldName);

    const widget = field.acroField.getWidgets()[0];
    const rect = widget?.getRectangle();
    const valueKey = uniqueValueKey(toValueKey(pdfFieldName), usedValueKeys);

    fields.push({
      pdfFieldName,
      valueKey,
      fieldType: inferFieldType(field),
      pageNumber: pageNumberForWidget(pdf, widget?.P()),
      x: roundCoord(rect?.x),
      y: roundCoord(rect?.y),
      width: roundCoord(rect?.width),
      height: roundCoord(rect?.height),
      isRequired: field.isRequired(),
    });
  }

  return {
    pageCount: pdf.getPageCount(),
    fields,
  };
}

export function toValueKey(pdfFieldName: string): string {
  const slug = pdfFieldName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 80);

  if (!slug) {
    return "field";
  }

  if (/^[0-9]/.test(slug)) {
    return `field_${slug}`.slice(0, 80);
  }

  return slug;
}

function uniqueValueKey(base: string, used: Set<string>): string {
  let key = base;
  let suffix = 2;

  while (used.has(key)) {
    const extra = `_${suffix}`;
    key = `${base.slice(0, Math.max(1, 80 - extra.length))}${extra}`;
    suffix += 1;
  }

  used.add(key);
  return key;
}

function inferFieldType(field: PDFField): DocumentFieldType {
  if (field instanceof PDFSignature) {
    return "signature_area";
  }

  if (field instanceof PDFCheckBox) {
    return "checkbox";
  }

  if (field instanceof PDFTextField) {
    return field.isMultiline() ? "textarea" : "text";
  }

  if (
    field instanceof PDFDropdown ||
    field instanceof PDFOptionList ||
    field instanceof PDFRadioGroup
  ) {
    return "text";
  }

  return "text";
}

function pageNumberForWidget(
  pdf: PDFDocument,
  pageRef: { objectNumber: number; generationNumber: number } | undefined,
): number {
  if (!pageRef) {
    return 1;
  }

  const index = pdf
    .getPages()
    .findIndex(
      (page) =>
        page.ref.objectNumber === pageRef.objectNumber &&
        page.ref.generationNumber === pageRef.generationNumber,
    );

  return index >= 0 ? index + 1 : 1;
}

function roundCoord(value: number | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100) / 100;
}
