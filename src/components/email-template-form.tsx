"use client";

import { useActionState } from "react";
import type { OrganizationEmailTemplateKind } from "@/lib/constants";
import {
  resetOrganizationEmailTemplateAction,
  upsertOrganizationEmailTemplateAction,
  type OrganizationEmailTemplateFormState,
} from "@/server/email-templates/actions";
import { placeholdersForKind } from "@/server/email-templates/schema";

const initialState: OrganizationEmailTemplateFormState = { error: null };

type EmailTemplateFormProps = {
  kind: OrganizationEmailTemplateKind;
  label: string;
  isCustomized: boolean;
  defaultValues: {
    subjectTemplate: string;
    bodyTemplate: string;
  };
};

export function EmailTemplateForm({
  kind,
  label,
  isCustomized,
  defaultValues,
}: EmailTemplateFormProps) {
  const [saveState, saveAction, savePending] = useActionState(
    upsertOrganizationEmailTemplateAction,
    initialState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    resetOrganizationEmailTemplateAction,
    initialState,
  );

  const pending = savePending || resetPending;
  const error = saveState.error ?? resetState.error;
  const placeholders = placeholdersForKind(kind);

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{label}</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Beschikbare placeholders:{" "}
            {placeholders.map((name) => (
              <code
                key={name}
                className="mr-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-800"
              >
                {`{{${name}}}`}
              </code>
            ))}
          </p>
        </div>
        <span
          className={
            isCustomized
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900"
              : "rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700"
          }
        >
          {isCustomized ? "Aangepast" : "Standaard"}
        </span>
      </div>

      <form action={saveAction} className="flex flex-col gap-4">
        <input type="hidden" name="kind" value={kind} />

        {error ? (
          <p
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-1">
          <label
            htmlFor={`subject-${kind}`}
            className="text-sm font-medium text-neutral-800"
          >
            Onderwerp
          </label>
          <input
            id={`subject-${kind}`}
            name="subjectTemplate"
            type="text"
            required
            maxLength={200}
            defaultValue={defaultValues.subjectTemplate}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={`body-${kind}`}
            className="text-sm font-medium text-neutral-800"
          >
            Berichttekst
          </label>
          <textarea
            id={`body-${kind}`}
            name="bodyTemplate"
            required
            rows={10}
            defaultValue={defaultValues.bodyTemplate}
            className="rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {savePending ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </form>

      {isCustomized ? (
        <form
          action={resetAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `Weet je zeker dat je “${label}” wilt herstellen naar de standaardtekst?`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="kind" value={kind} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
          >
            {resetPending ? "Herstellen…" : "Herstel standaard"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
