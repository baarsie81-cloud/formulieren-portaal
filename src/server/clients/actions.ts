"use server";

import { notFound, redirect } from "next/navigation";
import { requireDashboardContext } from "@/server/auth/guard";
import {
  parseClientInput,
  readClientFormFields,
  clientIdSchema,
} from "@/server/clients/schema";
import {
  archiveClient,
  createClient,
  updateClient,
} from "@/server/clients/service";
import { ConflictError, NotFoundError } from "@/server/errors";

export type ClientFormState = {
  error: string | null;
};

export async function createClientAction(
  _state: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const tenant = await requireDashboardContext();
  const parsed = parseClientInput(readClientFormFields(formData));

  if (!parsed.success) {
    return { error: parsed.error };
  }

  let client;

  try {
    client = await createClient(tenant, parsed.data);
  } catch (error) {
    return { error: toClientMutationError(error) };
  }

  redirect(`/dashboard/clients/${client.id}`);
}

export async function updateClientAction(
  _state: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const tenant = await requireDashboardContext();
  const clientId = parseClientIdOrNotFound(formData.get("clientId"));
  const parsed = parseClientInput(readClientFormFields(formData));

  if (!parsed.success) {
    return { error: parsed.error };
  }

  try {
    await updateClient(tenant, clientId, parsed.data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    return { error: toClientMutationError(error) };
  }

  redirect(`/dashboard/clients/${clientId}`);
}

export async function archiveClientAction(formData: FormData) {
  const tenant = await requireDashboardContext();
  const clientId = parseClientIdOrNotFound(formData.get("clientId"));

  try {
    await archiveClient(tenant, clientId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  redirect("/dashboard/clients");
}

function parseClientIdOrNotFound(value: FormDataEntryValue | null): string {
  const parsed = clientIdSchema.safeParse(value);

  if (!parsed.success) {
    notFound();
  }

  return parsed.data;
}

function toClientMutationError(error: unknown): string {
  if (error instanceof ConflictError) {
    if (error.message === "Archived clients cannot be updated") {
      return "Een gearchiveerde cliënt kan niet worden gewijzigd.";
    }

    return "Er bestaat al een cliënt met dit e-mailadres.";
  }

  throw error;
}
