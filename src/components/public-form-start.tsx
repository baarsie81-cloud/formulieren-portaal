"use client";

import { useActionState } from "react";
import {
  startPublicFormAction,
  type PublicFormState,
} from "@/server/forms/public-actions";

const initialState: PublicFormState = { error: null, saved: false };

export function PublicFormStart({
  token,
  organizationName,
  recipientName,
}: {
  token: string;
  organizationName: string;
  recipientName: string;
}) {
  const [state, formAction, pending] = useActionState(startPublicFormAction, initialState);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-neutral-500">{organizationName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Formulier openen</h1>
        <p className="mt-2 text-neutral-600">
          Dit formulier is bedoeld voor {recipientName}. Open het alleen als je deze link van de
          praktijk hebt ontvangen.
        </p>
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Openen…" : "Formulier openen"}
        </button>
      </form>
    </section>
  );
}
