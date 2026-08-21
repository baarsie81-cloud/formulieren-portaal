"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  DOCUMENT_FIELD_TYPE_LABELS,
  DOCUMENT_FIELD_TYPES,
  SIGNATURE_ROLE_LABELS,
  SIGNATURE_ROLES,
  type DocumentFieldType,
  type SignatureRole,
} from "@/lib/constants";
import {
  updateTemplateFieldsAction,
  type TemplateFormState,
} from "@/server/templates/actions";

type FieldRow = {
  id: string;
  pdfFieldName: string;
  valueKey: string;
  fieldType: DocumentFieldType;
  signatureRole: SignatureRole;
  pageNumber: number;
  x: number | null;
  y: number | null;
  isRequired: boolean;
  sortOrder: number;
};

const initialState: TemplateFormState = { error: null };

export function TemplateFieldsForm({
  templateId,
  fields,
}: {
  templateId: string;
  fields: FieldRow[];
}) {
  const [state, formAction, pending] = useActionState(
    updateTemplateFieldsAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="templateId" value={templateId} />

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">PDF-veld</th>
              <th className="px-3 py-2 font-medium">Sleutel</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Handtekening</th>
              <th className="px-3 py-2 font-medium">Pagina</th>
              <th className="px-3 py-2 font-medium">Verplicht</th>
              <th className="px-3 py-2 font-medium">Volgorde</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <FieldMappingRow key={field.id} field={field} />
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Opslaan…" : "Koppeling opslaan"}
      </button>
    </form>
  );
}

function FieldMappingRow({ field }: { field: FieldRow }) {
  const [fieldType, setFieldType] = useState<DocumentFieldType>(field.fieldType);
  const isSignature = fieldType === "signature_area";

  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="px-3 py-2 align-top">
        <input type="hidden" name="fieldId" value={field.id} />
        <input type="hidden" name="pdfFieldName" value={field.pdfFieldName} />
        <code className="break-all text-xs text-neutral-800">{field.pdfFieldName}</code>
      </td>
      <td className="px-3 py-2 align-top">
        <input
          name="valueKey"
          defaultValue={field.valueKey}
          required
          className="w-full rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs outline-none focus:border-neutral-900"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <select
          name="fieldType"
          value={fieldType}
          onChange={(event) => setFieldType(event.target.value as DocumentFieldType)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
        >
          {DOCUMENT_FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {DOCUMENT_FIELD_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 align-top">
        {isSignature ? (
          <select
            name="signatureRole"
            defaultValue={field.signatureRole === "organization" ? "organization" : "client"}
            className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
          >
            {SIGNATURE_ROLES.map((role) => (
              <option key={role} value={role}>
                {SIGNATURE_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input type="hidden" name="signatureRole" value="client" />
            <span className="text-neutral-400">—</span>
          </>
        )}
      </td>
      <td className="px-3 py-2 align-top text-neutral-700">
        {field.pageNumber}
        {field.x != null && field.y != null ? (
          <span className="block text-xs text-neutral-500">
            {field.x}×{field.y}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="checkbox"
          name={`required-${field.id}`}
          defaultChecked={field.isRequired}
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="number"
          name="sortOrder"
          min={0}
          max={10000}
          step={1}
          defaultValue={field.sortOrder}
          required
          className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900"
        />
      </td>
    </tr>
  );
}
