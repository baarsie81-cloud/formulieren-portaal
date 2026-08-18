"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MAX_TEMPLATE_PDF_BYTES } from "@/lib/constants";
import {
  createTemplateAction,
  type TemplateFormState,
} from "@/server/templates/actions";

const initialState: TemplateFormState = { error: null };
const maxMegabytes = Math.round(MAX_TEMPLATE_PDF_BYTES / (1024 * 1024));

export function TemplateUploadForm({ storageConfigured }: { storageConfigured: boolean }) {
  const [state, formAction, pending] = useActionState(createTemplateAction, initialState);

  if (!storageConfigured) {
    return (
      <p className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
        Bestandsopslag is niet geconfigureerd. Zet <code>BLOB_READ_WRITE_TOKEN</code> in{" "}
        <code>.env.local</code>.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-4">
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}

      <Field id="name" name="name" label="Naam" required />
      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium text-neutral-800">
          Omschrijving
          <span className="font-normal text-neutral-500"> (optioneel)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="pdf" className="text-sm font-medium text-neutral-800">
          PDF-bestand
        </label>
        <input
          id="pdf"
          name="pdf"
          type="file"
          accept="application/pdf"
          required
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        <p className="text-xs text-neutral-500">Bestaand PDF-formulier, maximaal {maxMegabytes} MB.</p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Uploaden…" : "Sjabloon opslaan"}
        </button>
        <Link href="/dashboard/templates" className="text-sm text-neutral-600 hover:text-neutral-950">
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
  required,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-800">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        required={required}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
      />
    </div>
  );
}
