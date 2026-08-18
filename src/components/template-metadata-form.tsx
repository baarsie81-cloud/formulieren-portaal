"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  updateTemplateMetadataAction,
  type TemplateFormState,
} from "@/server/templates/actions";

type TemplateMetadataFormProps = {
  templateId: string;
  defaultValues: {
    name: string;
    description: string | null;
  };
};

const initialState: TemplateFormState = { error: null };

export function TemplateMetadataForm({
  templateId,
  defaultValues,
}: TemplateMetadataFormProps) {
  const [state, formAction, pending] = useActionState(
    updateTemplateMetadataAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      <input type="hidden" name="templateId" value={templateId} />

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-neutral-800">
          Naam
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultValues.name}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-neutral-800">
          Omschrijving
          <span className="font-normal text-neutral-500"> (optioneel)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues.description ?? ""}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Opslaan…" : "Gegevens opslaan"}
        </button>
        <Link href="/dashboard/templates" className="text-sm text-neutral-600 hover:text-neutral-950">
          Terug
        </Link>
      </div>
    </form>
  );
}
