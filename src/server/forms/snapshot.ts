import { z } from "zod";
import { DOCUMENT_FIELD_TYPES, type DocumentFieldType } from "@/lib/constants";

export type FieldSchemaSnapshot = {
  pdfFieldName: string;
  valueKey: string;
  fieldType: DocumentFieldType;
  isRequired: boolean;
  sortOrder: number;
  pageNumber: number;
};

export const fieldSchemaSnapshotSchema = z.object({
  pdfFieldName: z.string().trim().min(1).max(300),
  valueKey: z.string().trim().min(1).max(80),
  fieldType: z.enum(DOCUMENT_FIELD_TYPES),
  isRequired: z.boolean(),
  sortOrder: z.number().int(),
  pageNumber: z.number().int().min(1),
});

export function toFieldsSchemaSnapshot(
  fields: readonly {
    pdfFieldName: string;
    valueKey: string;
    fieldType: DocumentFieldType;
    isRequired: boolean;
    sortOrder: number;
    pageNumber: number;
  }[],
): FieldSchemaSnapshot[] {
  return fields.map((field) => ({
    pdfFieldName: field.pdfFieldName,
    valueKey: field.valueKey,
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    sortOrder: field.sortOrder,
    pageNumber: field.pageNumber,
  }));
}

export function parseFieldsSchemaSnapshot(value: unknown): FieldSchemaSnapshot[] | null {
  const parsed = z.array(fieldSchemaSnapshotSchema).safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return [...parsed.data].sort((a, b) => a.sortOrder - b.sortOrder || a.pdfFieldName.localeCompare(b.pdfFieldName));
}

export function fillableFields(snapshot: readonly FieldSchemaSnapshot[]): FieldSchemaSnapshot[] {
  return snapshot.filter((field) => field.fieldType !== "signature_area");
}
