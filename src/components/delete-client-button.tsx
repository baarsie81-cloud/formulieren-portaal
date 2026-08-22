"use client";

import { useActionState, useState } from "react";
import {
  deleteClientAction,
  type ClientDeleteState,
} from "@/server/clients/actions";
import { PERMANENT_DELETE_CONFIRMATION } from "@/server/clients/schema";

const initialState: ClientDeleteState = { error: null };

export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteClientAction,
    initialState,
  );
  const [confirmation, setConfirmation] = useState("");
  const canSubmit = confirmation === PERMANENT_DELETE_CONFIRMATION;

  return (
    <form
      action={formAction}
      className="flex max-w-md flex-col gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-4"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <div className="space-y-1">
        <p className="text-sm font-medium text-red-900">
          Cliënt definitief verwijderen
        </p>
        <p className="text-sm text-red-800">
          Je staat op het punt <span className="font-medium">{clientName}</span>{" "}
          permanent te verwijderen. Dit kan niet ongedaan worden gemaakt.
        </p>
        <p className="text-sm text-red-800">
          Typ <span className="font-mono font-semibold">{PERMANENT_DELETE_CONFIRMATION}</span>{" "}
          om te bevestigen.
        </p>
      </div>
      <label className="flex flex-col gap-1 text-sm text-red-900">
        <span className="font-medium">Bevestiging</span>
        <input
          type="text"
          name="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="rounded-md border border-red-300 bg-white px-3 py-2 text-neutral-950 outline-none focus:border-red-500"
          placeholder={PERMANENT_DELETE_CONFIRMATION}
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-900" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!canSubmit || pending}
        className="rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Verwijderen…" : "Definitief verwijderen"}
      </button>
    </form>
  );
}
