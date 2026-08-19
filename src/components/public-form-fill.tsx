"use client";

import { useActionState } from "react";
import { DOCUMENT_FIELD_TYPE_LABELS, type DocumentFieldType } from "@/lib/constants";
import type { FieldSchemaSnapshot } from "@/server/forms/snapshot";
import {
  savePublicFormAction,
  submitPublicFormAction,
  type PublicFormState,
} from "@/server/forms/public-actions";
import type { FieldValueMap } from "@/server/pdf/fill";

const initialState: PublicFormState = { error: null, saved: false };

export function PublicFormFill({
  token,
  organizationName,
  recipientName,
  snapshot,
  values,
}: {
  token: string;
  organizationName: string;
  recipientName: string;
  snapshot: FieldSchemaSnapshot[];
  values: FieldValueMap;
}) {
  const [saveState, saveAction, saving] = useActionState(savePublicFormAction, initialState);
  const [submitState, submitAction, submitting] = useActionState(
    submitPublicFormAction,
    initialState,
  );
  const fillable = snapshot.filter((field) => field.fieldType !== "signature_area");
  const signatures = snapshot.filter((field) => field.fieldType === "signature_area");
  const error = saveState.error ?? submitState.error;
  const pending = saving || submitting;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">{organizationName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Formulier invullen</h1>
        <p className="mt-2 text-neutral-600">
          Hallo {recipientName}. Vul de velden in zoals ze in het originele PDF-document staan.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {saveState.saved && !error ? (
        <p className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700">
          Concept opgeslagen.
        </p>
      ) : null}

      <form className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />

        {fillable.map((field) => (
          <PublicField
            key={field.valueKey}
            field={field}
            defaultValue={values[field.valueKey]}
          />
        ))}

        {signatures.length > 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            {signatures.length === 1
              ? "Het handtekeningveld wordt in een volgende stap ingevuld."
              : "De handtekeningvelden worden in een volgende stap ingevuld."}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            formAction={saveAction}
            disabled={pending}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
          >
            {saving ? "Opslaan…" : "Concept opslaan"}
          </button>
          <button
            type="submit"
            formAction={submitAction}
            disabled={pending}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {submitting ? "Indienen…" : "Gegevens indienen"}
          </button>
        </div>
      </form>
    </section>
  );
}

function PublicField({
  field,
  defaultValue,
}: {
  field: FieldSchemaSnapshot;
  defaultValue: string | boolean | undefined;
}) {
  const id = `field-${field.valueKey}`;
  const label = fieldLabel(field);
  const inputClass =
    "rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900";

  if (field.fieldType === "checkbox") {
    return (
      <label htmlFor={id} className="flex items-start gap-2 text-sm text-neutral-800">
        <input
          id={id}
          name={field.valueKey}
          type="checkbox"
          defaultChecked={defaultValue === true || defaultValue === "true"}
          className="mt-0.5"
        />
        <span>
          {label}
          {field.isRequired ? null : (
            <span className="font-normal text-neutral-500"> (optioneel)</span>
          )}
        </span>
      </label>
    );
  }

  if (field.fieldType === "textarea") {
    return (
      <div className="flex flex-col gap-1">
        <FieldLabel id={id} label={label} required={field.isRequired} />
        <textarea
          id={id}
          name={field.valueKey}
          defaultValue={typeof defaultValue === "string" ? defaultValue : ""}
          required={field.isRequired}
          rows={5}
          className={inputClass}
        />
      </div>
    );
  }

  const inputType = field.fieldType === "date" ? "date" : "text";
  const inputMode = field.fieldType === "number" ? "decimal" : undefined;

  return (
    <div className="flex flex-col gap-1">
      <FieldLabel id={id} label={label} required={field.isRequired} />
      <input
        id={id}
        name={field.valueKey}
        type={inputType}
        inputMode={inputMode}
        defaultValue={typeof defaultValue === "string" ? defaultValue : ""}
        required={field.isRequired}
        className={inputClass}
      />
    </div>
  );
}

function FieldLabel({
  id,
  label,
  required,
}: {
  id: string;
  label: string;
  required: boolean;
}) {
  return (
    <label htmlFor={id} className="text-sm font-medium text-neutral-800">
      {label}
      {required ? null : <span className="font-normal text-neutral-500"> (optioneel)</span>}
    </label>
  );
}

function fieldLabel(field: FieldSchemaSnapshot): string {
  const fromKey = field.valueKey.replaceAll("_", " ");
  const type = field.fieldType as DocumentFieldType;

  if (fromKey.trim()) {
    return fromKey.charAt(0).toUpperCase() + fromKey.slice(1);
  }

  return DOCUMENT_FIELD_TYPE_LABELS[type];
}
