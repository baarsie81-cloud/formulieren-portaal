"use server";

import { redirect } from "next/navigation";
import { PUBLIC_FORM_INVALID_MESSAGE } from "@/lib/constants";
import { getDb } from "@/server/db";
import {
  loadFormCompletionEmailContext,
  sendFormCompletionNotifications,
} from "@/server/email/confirmation";
import { AppError, ConflictError, TokenAccessError, ValidationError } from "@/server/errors";
import {
  clearFormSessionCookie,
  writeFormSignedCookie,
} from "@/server/forms/cookie";
import {
  getPublicFormContext,
  savePublicFormValues,
  startPublicFormSession,
  submitPublicFormFill,
} from "@/server/forms/public";
import { getPublicOrigin, getRequestMeta, publicFormPath } from "@/server/forms/request-meta";
import { parseRawToken } from "@/server/forms/schema";
import { signAndFinalizePublicForm } from "@/server/forms/signing";
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

export async function signPublicFormAction(
  _state: PublicFormState,
  formData: FormData,
): Promise<PublicFormState> {
  const token = parseRawToken(readFormString(formData, "token"));

  if (!token) {
    return { error: PUBLIC_FORM_INVALID_MESSAGE, saved: false };
  }

  const method = readFormString(formData, "method");

  if (method !== "drawn" && method !== "typed") {
    return { error: "Kies een handtekeningmethode.", saved: false };
  }

  try {
    const context = await getPublicFormContext(token);
    const emailContext = await loadFormCompletionEmailContext(getDb(), token);

    await signAndFinalizePublicForm(
      token,
      {
        signerName: readFormString(formData, "signerName"),
        method,
        signatureDataUrl: readFormString(formData, "signatureDataUrl"),
        acceptedDeclaration: formData.get("acceptedDeclaration") === "on",
      },
      await getRequestMeta(),
    );

    if (emailContext) {
      try {
        await sendFormCompletionNotifications(getDb(), {
          ...emailContext,
          dashboardOrigin: await getPublicOrigin(),
        });
      } catch {
        // Finalize already succeeded; mail failure must not block the client flow.
      }
    }

    await clearFormSessionCookie();
    await writeFormSignedCookie(context.recipientName);
  } catch (error) {
    return { error: toPublicFormError(error), saved: false };
  }

  redirect("/f/afgerond");
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

  if (mode === "submit") {
    redirect(publicFormPath(token));
  }

  return { error: null, saved: true };
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

  if (error instanceof ValidationError) {
    return error.message;
  }

  if (error instanceof Error && error.message === "HMAC_SECRET is not set") {
    return "Het formulier is tijdelijk niet beschikbaar.";
  }

  if (error instanceof Error && error.message === "DATABASE_URL is not set") {
    return "Het formulier is tijdelijk niet beschikbaar.";
  }

  // Storage, email, integrity, and other platform errors must not crash the page.
  if (error instanceof AppError) {
    return "Er is een technische fout opgetreden. Probeer het later opnieuw of neem contact op met de praktijk.";
  }

  throw error;
}
