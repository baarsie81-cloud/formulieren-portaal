import { z } from "zod";
import type { FieldValueMap } from "@/server/pdf/fill";
import { fillableFields, type FieldSchemaSnapshot } from "@/server/forms/snapshot";

const TEXT_MAX = 500;
const TEXTAREA_MAX = 5_000;

export type ParseFieldValuesResult =
  | { success: true; data: FieldValueMap }
  | { success: false; error: string };

export function parseFieldValues(
  snapshot: readonly FieldSchemaSnapshot[],
  raw: Record<string, unknown>,
  mode: "draft" | "submit",
): ParseFieldValuesResult {
  const data: FieldValueMap = {};

  for (const field of fillableFields(snapshot)) {
    const parsed = parseOneField(field, raw[field.valueKey], mode);

    if (!parsed.success) {
      return parsed;
    }

    if (parsed.value !== undefined) {
      data[field.valueKey] = parsed.value;
    }
  }

  return { success: true, data };
}

export function mergeFieldValues(
  current: FieldValueMap,
  patch: FieldValueMap,
): FieldValueMap {
  return { ...current, ...patch };
}

export function asFieldValueMap(value: unknown): FieldValueMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const result: FieldValueMap = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "boolean") {
      result[key] = entry;
    }
  }

  return result;
}

function parseOneField(
  field: FieldSchemaSnapshot,
  raw: unknown,
  mode: "draft" | "submit",
): { success: true; value?: string | boolean } | { success: false; error: string } {
  if (field.fieldType === "checkbox") {
    const checked = raw === true || raw === "true" || raw === "on";

    if (mode === "submit" && field.isRequired && !checked) {
      return { success: false, error: "Vul alle verplichte velden in." };
    }

    return { success: true, value: checked };
  }

  const text = typeof raw === "string" ? raw.trim() : "";

  if (text === "") {
    if (mode === "submit" && field.isRequired) {
      return { success: false, error: "Vul alle verplichte velden in." };
    }

    return { success: true, value: mode === "submit" ? "" : undefined };
  }

  if (field.fieldType === "date") {
    const parsed = z.iso.date().safeParse(text);

    if (!parsed.success) {
      return { success: false, error: "Vul een geldige datum in." };
    }

    return { success: true, value: parsed.data };
  }

  if (field.fieldType === "number") {
    if (!/^-?\d+([.,]\d+)?$/.test(text)) {
      return { success: false, error: "Vul een geldig getal in." };
    }

    return { success: true, value: text.replace(",", ".") };
  }

  if (field.fieldType === "textarea") {
    if (text.length > TEXTAREA_MAX) {
      return { success: false, error: "Een tekstveld is te lang." };
    }

    return { success: true, value: text };
  }

  if (text.length > TEXT_MAX) {
    return { success: false, error: "Een tekstveld is te lang." };
  }

  return { success: true, value: text };
}

export function readPublicFieldValues(
  snapshot: readonly FieldSchemaSnapshot[],
  formData: FormData,
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};

  for (const field of fillableFields(snapshot)) {
    if (field.fieldType === "checkbox") {
      raw[field.valueKey] = formData.get(field.valueKey) === "on";
    } else {
      const value = formData.get(field.valueKey);
      raw[field.valueKey] = typeof value === "string" ? value : "";
    }
  }

  return raw;
}
