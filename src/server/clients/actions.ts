"use server";

import { notFound, redirect } from "next/navigation";
import { requireDashboardContext } from "@/server/auth/guard";
import {
  parseClientInput,
  parsePermanentDeleteConfirmation,
  readClientFormFields,
  clientIdSchema,
} from "@/server/clients/schema";
import {
  archiveClient,
  createClient,
  deleteClient,
  restoreClient,
  updateClient,
} from "@/server/clients/service";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";

export type ClientFormState = {
  error: string | null;
};

export type ClientDeleteState = {
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

export async function restoreClientAction(formData: FormData) {
  const tenant = await requireDashboardContext();
  const clientId = parseClientIdOrNotFound(formData.get("clientId"));

  try {
    await restoreClient(tenant, clientId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  redirect("/dashboard/clients");
}

export async function deleteClientAction(
  _state: ClientDeleteState,
  formData: FormData,
): Promise<ClientDeleteState> {
  const tenant = await requireDashboardContext();
  const clientId = parseClientIdOrNotFound(formData.get("clientId"));
  const confirmation = parsePermanentDeleteConfirmation(
    formData.get("confirmation"),
  );

  if (!confirmation.success) {
    return { error: confirmation.error };
  }

  try {
    await deleteClient(tenant, clientId, confirmation.data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    if (error instanceof ValidationError) {
      return { error: error.message };
    }

    if (error instanceof ConflictError) {
      return { error: error.message };
    }

    throw error;
  }

  redirect("/dashboard/clients?view=archived");
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
