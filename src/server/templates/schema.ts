import { z } from "zod";
import { DOCUMENT_FIELD_TYPES, SIGNATURE_ROLES } from "@/lib/constants";

const optionalNullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

export const templateIdSchema = z.uuid();

export const templateMetadataSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: optionalNullableText(2000),
});

export type TemplateMetadataInput = z.infer<typeof templateMetadataSchema>;

export const fieldMappingSchema = z
  .object({
    id: z.uuid(),
    pdfFieldName: z.string().trim().min(1).max(300),
    valueKey: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9_]*$/),
    fieldType: z.enum(DOCUMENT_FIELD_TYPES),
    isRequired: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
    signatureRole: z.enum(SIGNATURE_ROLES).optional().default("client"),
  })
  .transform((field) => ({
    ...field,
    signatureRole:
      field.fieldType === "signature_area" && field.signatureRole === "organization"
        ? ("organization" as const)
        : ("client" as const),
  }));

export type FieldMappingInput = z.infer<typeof fieldMappingSchema>;

export type TemplateMetadataFields = {
  name: string;
  description: string;
};

export function readTemplateMetadataFields(formData: FormData): TemplateMetadataFields {
  return {
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
  };
}

export function parseTemplateMetadata(data: TemplateMetadataFields): {
  success: true;
  data: TemplateMetadataInput;
} | {
  success: false;
  error: string;
} {
  const parsed = templateMetadataSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: metadataValidationMessage(parsed.error) };
  }

  return { success: true, data: parsed.data };
}

export function readFieldMappings(formData: FormData): unknown[] {
  const ids = formData.getAll("fieldId");

  return ids.map((id, index) => ({
    id: typeof id === "string" ? id : "",
    pdfFieldName: readAllString(formData, "pdfFieldName", index),
    valueKey: readAllString(formData, "valueKey", index),
    fieldType: readAllString(formData, "fieldType", index),
    sortOrder: Number(readAllString(formData, "sortOrder", index)),
    isRequired: typeof id === "string" && formData.get(`required-${id}`) === "on",
    signatureRole: readAllString(formData, "signatureRole", index) || "client",
  }));
}

export function parseFieldMappings(data: unknown[]): {
  success: true;
  data: FieldMappingInput[];
} | {
  success: false;
  error: string;
} {
  const parsed = z.array(fieldMappingSchema).safeParse(data);

  if (!parsed.success) {
    return { success: false, error: fieldValidationMessage(parsed.error) };
  }

  const valueKeys = parsed.data.map((field) => field.valueKey);
  const uniqueKeys = new Set(valueKeys);

  if (uniqueKeys.size !== valueKeys.length) {
    return { success: false, error: "Elke sleutel mag maar één keer voorkomen." };
  }

  return { success: true, data: parsed.data };
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readAllString(formData: FormData, key: string, index: number): string {
  const value = formData.getAll(key)[index];
  return typeof value === "string" ? value : "";
}

function metadataValidationMessage(error: z.ZodError): string {
  const field = error.issues[0]?.path[0];

  if (field === "name") {
    return "Vul een naam in.";
  }

  if (field === "description") {
    return "Omschrijving is te lang.";
  }

  return "Controleer de ingevulde gegevens.";
}

function fieldValidationMessage(error: z.ZodError): string {
  const field = error.issues[0]?.path[1];

  if (field === "valueKey") {
    return "Sleutels mogen alleen kleine letters, cijfers en underscores bevatten.";
  }

  if (field === "fieldType") {
    return "Kies een geldig veldtype.";
  }

  if (field === "sortOrder") {
    return "Volgorde moet een geheel getal zijn.";
  }

  if (field === "signatureRole") {
    return "Kies een geldige handtekeningrol.";
  }

  return "Controleer de veldkoppeling.";
}
