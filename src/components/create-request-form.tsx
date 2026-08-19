"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createFormRequestAction,
  type RequestFormState,
} from "@/server/forms/actions";

type Option = { id: string; label: string; extra?: string };

const initialState: RequestFormState = { error: null };

export function CreateRequestForm({
  clients,
  templates,
  defaultClientId,
  emailEnabled,
}: {
  clients: Option[];
  templates: Option[];
  defaultClientId?: string;
  emailEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(createFormRequestAction, initialState);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="clientId" className="text-sm font-medium text-neutral-800">
          Cliënt
        </label>
        <select
          id="clientId"
          name="clientId"
          required
          defaultValue={defaultClientId ?? ""}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
        >
          <option value="" disabled>
            Kies een cliënt
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.label}
              {client.extra ? ` (${client.extra})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="templateId" className="text-sm font-medium text-neutral-800">
          PDF-sjabloon
        </label>
        <select
          id="templateId"
          name="templateId"
          required
          defaultValue=""
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
        >
          <option value="" disabled>
            Kies een sjabloon
          </option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-neutral-600">
        {emailEnabled
          ? "Na het aanmaken ontvangt de cliënt per e-mail een beveiligde link. U kunt de link ook op de detailpagina kopiëren."
          : "Er wordt een beveiligde link gemaakt die u op de detailpagina kunt kopiëren."}{" "}
        Het PDF-ontwerp blijft ongewijzigd; de cliënt vult de bestaande AcroForm-velden in.
      </p>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Versturen…" : emailEnabled ? "Versturen" : "Link maken"}
        </button>
        <Link href="/dashboard/requests" className="text-sm text-neutral-600 hover:text-neutral-950">
          Annuleren
        </Link>
      </div>
    </form>
  );
}
