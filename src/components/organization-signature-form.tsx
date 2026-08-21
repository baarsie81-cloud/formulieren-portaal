"use client";

import { useActionState } from "react";
import { MAX_SIGNATURE_PNG_BYTES } from "@/lib/constants";
import {
  updateOrganizationSignatureAction,
  type OrganizationSignatureFormState,
} from "@/server/organizations/actions";

const initialState: OrganizationSignatureFormState = { error: null };
const maxKilobytes = Math.round(MAX_SIGNATURE_PNG_BYTES / 1024);

export function OrganizationSignatureForm({
  storageConfigured,
  hasSignature,
  defaultValues,
}: {
  storageConfigured: boolean;
  hasSignature: boolean;
  defaultValues: {
    signerName: string;
    signerTitle: string;
  };
}) {
  const [state, formAction, pending] = useActionState(
    updateOrganizationSignatureAction,
    initialState,
  );

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
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <label htmlFor="signerName" className="text-sm font-medium text-neutral-800">
          Naam ondertekenaar
        </label>
        <input
          id="signerName"
          name="signerName"
          type="text"
          required
          defaultValue={defaultValues.signerName}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="signerTitle" className="text-sm font-medium text-neutral-800">
          Functie
          <span className="font-normal text-neutral-500"> (optioneel)</span>
        </label>
        <input
          id="signerTitle"
          name="signerTitle"
          type="text"
          defaultValue={defaultValues.signerTitle}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="signaturePng" className="text-sm font-medium text-neutral-800">
          Handtekening (PNG)
          {hasSignature ? (
            <span className="font-normal text-neutral-500"> (optioneel vervangen)</span>
          ) : null}
        </label>
        <input
          id="signaturePng"
          name="signaturePng"
          type="file"
          accept="image/png"
          required={!hasSignature}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        <p className="text-xs text-neutral-500">
          PNG-afbeelding, maximaal {maxKilobytes} KB.
          {hasSignature
            ? " Laat leeg om de huidige handtekening te behouden."
            : null}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </form>
  );
}
