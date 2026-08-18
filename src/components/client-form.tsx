"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from "@/server/clients/actions";

type ClientFormProps = {
  clientId?: string;
  defaultValues?: {
    displayName: string;
    email: string;
    phone: string | null;
    externalReference: string | null;
  };
  submitLabel: string;
  cancelHref: string;
};

const initialState: ClientFormState = { error: null };

export function ClientForm({
  clientId,
  defaultValues,
  submitLabel,
  cancelHref,
}: ClientFormProps) {
  const action = clientId ? updateClientAction : createClientAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}

      <Field
        id="displayName"
        name="displayName"
        label="Naam"
        defaultValue={defaultValues?.displayName}
        required
        autoComplete="name"
      />
      <Field
        id="email"
        name="email"
        label="E-mailadres"
        type="email"
        defaultValue={defaultValues?.email}
        required
        autoComplete="email"
      />
      <Field
        id="phone"
        name="phone"
        label="Telefoonnummer"
        defaultValue={defaultValues?.phone ?? ""}
        autoComplete="tel"
        optional
      />
      <Field
        id="externalReference"
        name="externalReference"
        label="Extern kenmerk"
        defaultValue={defaultValues?.externalReference ?? ""}
        optional
      />

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Opslaan…" : submitLabel}
        </button>
        <Link href={cancelHref} className="text-sm text-neutral-600 hover:text-neutral-950">
          Annuleren
        </Link>
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  defaultValue,
  required,
  optional,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  optional?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-800">
        {label}
        {optional ? (
          <span className="font-normal text-neutral-500"> (optioneel)</span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      />
    </div>
  );
}
