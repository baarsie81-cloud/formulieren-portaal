"use server";

import { notFound, redirect } from "next/navigation";
import { requireDashboardContext } from "@/server/auth/guard";
import { getDb } from "@/server/db";
import { sendFormRequestInvitation } from "@/server/email/invitation";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import {
  formRequestIdSchema,
  parseCreateFormRequest,
  readCreateFormRequestFields,
} from "@/server/forms/schema";
import { writeCreatedTokenCookie } from "@/server/forms/cookie";
import { getPublicOrigin, publicFormUrl } from "@/server/forms/request-meta";
import {
  cancelFormRequest,
  createFormRequest,
  rotateFormRequestToken,
} from "@/server/forms/service";

export type RequestFormState = {
  error: string | null;
};

export async function createFormRequestAction(
  _state: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const tenant = await requireDashboardContext();
  const parsed = parseCreateFormRequest(readCreateFormRequestFields(formData));

  if (!parsed.success) {
    return { error: parsed.error };
  }

  let created;

  try {
    created = await createFormRequest(tenant, parsed.data);
  } catch (error) {
    return { error: toRequestMutationError(error) };
  }

  await writeCreatedTokenCookie(created.request.id, created.rawToken);

  const formUrl = publicFormUrl(await getPublicOrigin(), created.rawToken);
  let emailFailed = false;

  try {
    await sendFormRequestInvitation(getDb(), {
      organizationId: tenant.organizationId,
      organizationName: tenant.organizationName,
      recipientEmail: created.request.recipientEmail,
      recipientName: created.request.recipientName,
      formRequestId: created.request.id,
      formUrl,
      expiresAt: created.request.expiresAt,
    });
  } catch {
    emailFailed = true;
  }

  redirect(
    emailFailed
      ? `/dashboard/requests/${created.request.id}?email=failed`
      : `/dashboard/requests/${created.request.id}`,
  );
}

export async function cancelFormRequestAction(formData: FormData) {
  const tenant = await requireDashboardContext();
  const requestId = parseRequestIdOrNotFound(formData.get("requestId"));

  try {
    await cancelFormRequest(tenant, requestId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  redirect(`/dashboard/requests/${requestId}`);
}

export async function rotateFormRequestTokenAction(formData: FormData) {
  const tenant = await requireDashboardContext();
  const requestId = parseRequestIdOrNotFound(formData.get("requestId"));

  try {
    const rotated = await rotateFormRequestToken(tenant, requestId);
    await writeCreatedTokenCookie(rotated.requestId, rotated.rawToken);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  redirect(`/dashboard/requests/${requestId}`);
}

function parseRequestIdOrNotFound(value: FormDataEntryValue | null): string {
  const parsed = formRequestIdSchema.safeParse(value);

  if (!parsed.success) {
    notFound();
  }

  return parsed.data;
}

function toRequestMutationError(error: unknown): string {
  if (error instanceof ValidationError) {
    if (error.message === "Template has no AcroForm fields") {
      return "Dit sjabloon heeft geen invulbare AcroForm-velden.";
    }

    return "Controleer de ingevulde gegevens.";
  }

  if (error instanceof ConflictError) {
    if (error.message === "Archived clients cannot receive forms") {
      return "Een gearchiveerde cliënt kan geen formulier ontvangen.";
    }

    if (error.message === "Archived templates cannot be sent") {
      return "Een gearchiveerd sjabloon kan niet worden verstuurd.";
    }

    return "Dit verzoek kan nu niet worden aangemaakt.";
  }

  if (error instanceof NotFoundError) {
    return "Kies een cliënt en een PDF-sjabloon uit deze praktijk.";
  }

  throw error;
}
