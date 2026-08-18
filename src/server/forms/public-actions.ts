"use server";

import { redirect } from "next/navigation";
import { PUBLIC_FORM_INVALID_MESSAGE } from "@/lib/constants";
import { ConflictError, TokenAccessError } from "@/server/errors";
import {
  getPublicFormContext,
  savePublicFormValues,
  startPublicFormSession,
  submitPublicFormFill,
} from "@/server/forms/public";
import { getRequestMeta, publicFormPath } from "@/server/forms/request-meta";
import { parseRawToken } from "@/server/forms/schema";
import { readPublicFieldValues } from "@/server/forms/values";

export type PublicFormState = {
  error: string | null;
  saved: boolean;
};

export async function startPublicFormAction(
  _state: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  const token = parseRawToken(readFormString(formData, "token"));

  if (!token) {
    return { error: PUBLIC_FORM_INVALID_MESSAGE, saved: false };
  }

  try {
    await startPublicFormSession(token, await getRequestMeta());
  } catch (error) {
    return { error: toPublicFormError(error), saved: false };
  }

  redirect(publicFormPath(token));
}

export async function savePublicFormAction(
  _state: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  return persistPublicFormAction(formData, "draft");
}

export async function submitPublicFormAction(
  _state: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  return persistPublicFormAction(formData, "submit");
}

async function persistPublicFormAction(
  formData: FormData,
  mode: "draft" | "submit",
): Promise<PublicFormState> {
  const token = parseRawToken(readFormString(formData, "token"));

  if (!token) {
    return { error: PUBLIC_FORM_INVALID_MESSAGE, saved: false };
  }

  try {
    const context = await getPublicFormContext(token);
    const raw = readPublicFieldValues(context.snapshot, formData);
    const result =
      mode === "submit"
        ? await submitPublicFormFill(token, raw, await getRequestMeta())
        : await savePublicFormValues(token, raw, await getRequestMeta());

    if (!result.success) {
      return { error: result.error, saved: false };
    }
  } catch (error) {
    return { error: toPublicFormError(error), saved: false };
  }

  return { error: null, saved: mode === "draft" };
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function toPublicFormError(error: unknown): string {
  if (error instanceof TokenAccessError) {
    return PUBLIC_FORM_INVALID_MESSAGE;
  }

  if (error instanceof ConflictError) {
    return "Dit formulier is al ingevuld en kan niet meer worden gewijzigd.";
  }

  if (error instanceof Error && error.message === "HMAC_SECRET is not set") {
    return "Het formulier is tijdelijk niet beschikbaar.";
  }

  if (error instanceof Error && error.message === "DATABASE_URL is not set") {
    return "Het formulier is tijdelijk niet beschikbaar.";
  }

  throw error;
}
