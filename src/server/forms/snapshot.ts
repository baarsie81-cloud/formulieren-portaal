import { z } from "zod";
import {
  DOCUMENT_FIELD_TYPES,
  SIGNATURE_ROLES,
  type DocumentFieldType,
  type SignatureRole,
} from "@/lib/constants";

const nullableCoordSchema = z
  .number()
  .finite()
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const signatureRoleSchema = z
  .enum(SIGNATURE_ROLES)
  .nullable()
  .optional()
  .transform((value): SignatureRole => value ?? "client");

export type FieldSchemaSnapshot = {
  pdfFieldName: string;
  valueKey: string;
  fieldType: DocumentFieldType;
  isRequired: boolean;
  sortOrder: number;
  pageNumber: number;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  pageWidth: number | null;
  pageHeight: number | null;
  signatureRole: SignatureRole;
};

export const fieldSchemaSnapshotSchema = z.object({
  pdfFieldName: z.string().trim().min(1).max(300),
  valueKey: z.string().trim().min(1).max(80),
  fieldType: z.enum(DOCUMENT_FIELD_TYPES),
  isRequired: z.boolean(),
  sortOrder: z.number().int(),
  pageNumber: z.number().int().min(1),
  x: nullableCoordSchema,
  y: nullableCoordSchema,
  width: nullableCoordSchema,
  height: nullableCoordSchema,
  pageWidth: nullableCoordSchema,
  pageHeight: nullableCoordSchema,
  signatureRole: signatureRoleSchema,
});

export type SnapshotFieldSource = {
  pdfFieldName: string;
  valueKey: string;
  fieldType: DocumentFieldType;
  isRequired: boolean;
  sortOrder: number;
  pageNumber: number;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  pageWidth?: number | null;
  pageHeight?: number | null;
  signatureRole?: SignatureRole | null;
};

export function toFieldsSchemaSnapshot(
  fields: readonly SnapshotFieldSource[],
): FieldSchemaSnapshot[] {
  return fields.map((field) => ({
    pdfFieldName: field.pdfFieldName,
    valueKey: field.valueKey,
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    sortOrder: field.sortOrder,
    pageNumber: field.pageNumber,
    x: field.x ?? null,
    y: field.y ?? null,
    width: field.width ?? null,
    height: field.height ?? null,
    pageWidth: field.pageWidth ?? null,
    pageHeight: field.pageHeight ?? null,
    signatureRole: resolveSignatureRole(field.signatureRole),
  }));
}

export function parseFieldsSchemaSnapshot(value: unknown): FieldSchemaSnapshot[] | null {
  const parsed = z.array(fieldSchemaSnapshotSchema).safeParse(value);

  if (!parsed.success) {
    return null;
  }

  return [...parsed.data].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.pdfFieldName.localeCompare(b.pdfFieldName),
  );
}

export function fillableFields(snapshot: readonly FieldSchemaSnapshot[]): FieldSchemaSnapshot[] {
  return snapshot.filter((field) => field.fieldType !== "signature_area");
}

export function signatureFields(snapshot: readonly FieldSchemaSnapshot[]): FieldSchemaSnapshot[] {
  return snapshot.filter((field) => field.fieldType === "signature_area");
}

export function resolveSignatureRole(
  role: SignatureRole | null | undefined,
): SignatureRole {
  return role === "organization" ? "organization" : "client";
}

export function hasOrganizationSignatureFields(
  snapshot: readonly FieldSchemaSnapshot[],
): boolean {
  return signatureFields(snapshot).some(
    (field) => resolveSignatureRole(field.signatureRole) === "organization",
  );
}
