import { hasCompleteGeometry } from "@/lib/pdf-geometry";
import type { DocumentFieldType } from "@/lib/constants";
import type { FieldSchemaSnapshot } from "@/server/forms/snapshot";

const OVERLAY_INPUT_FIELD_TYPES = ["text", "textarea", "date", "number", "checkbox"] as const;

export type OverlayInputFieldType = (typeof OVERLAY_INPUT_FIELD_TYPES)[number];

export type OverlayInputField = FieldSchemaSnapshot & {
  fieldType: OverlayInputFieldType;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
};

export type OverlayFieldsByPage = {
  pageNumber: number;
  fields: OverlayInputField[];
};

/** @deprecated Use OverlayInputField */
export type OverlayTextField = OverlayInputField;

export function isOverlayInputFieldType(
  fieldType: DocumentFieldType,
): fieldType is OverlayInputFieldType {
  return (OVERLAY_INPUT_FIELD_TYPES as readonly string[]).includes(fieldType);
}

/**
 * Returns all overlayable input fields with complete geometry, across all pages.
 */
export function pickOverlayInputFields(
  fields: readonly FieldSchemaSnapshot[],
): OverlayInputField[] {
  const candidates: OverlayInputField[] = [];

  for (const field of fields) {
    if (!isOverlayInputFieldType(field.fieldType) || !hasCompleteGeometry(field)) {
      continue;
    }

    candidates.push({ ...field, fieldType: field.fieldType });
  }

  return candidates.sort(
    (a, b) =>
      a.pageNumber - b.pageNumber ||
      a.sortOrder - b.sortOrder ||
      a.pdfFieldName.localeCompare(b.pdfFieldName),
  );
}

/**
 * Groups overlay fields by pageNumber (ascending). Pages without fields are omitted.
 */
export function groupOverlayFieldsByPage(
  fields: readonly OverlayInputField[],
): OverlayFieldsByPage[] {
  const byPage = new Map<number, OverlayInputField[]>();

  for (const field of fields) {
    const list = byPage.get(field.pageNumber);

    if (list) {
      list.push(field);
    } else {
      byPage.set(field.pageNumber, [field]);
    }
  }

  return [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pageNumber, pageFields]) => ({
      pageNumber,
      fields: pageFields,
    }));
}

/** @deprecated Use pickOverlayInputFields */
export const pickOverlayTextFields = pickOverlayInputFields;
