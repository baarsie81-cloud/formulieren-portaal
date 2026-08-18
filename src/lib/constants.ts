export const APP_NAME = "Formulieren Portaal";
export const APP_TAGLINE = "Beveiligd beheer van cliëntformulieren";
export const TIMEZONE = "Europe/Amsterdam";

/** Server-action upload cap. Stay under the Vercel Function body limit. */
export const MAX_TEMPLATE_PDF_BYTES = 4 * 1024 * 1024;

export const DOCUMENT_FIELD_TYPES = [
  "text",
  "textarea",
  "date",
  "checkbox",
  "number",
  "signature_area",
] as const;

export type DocumentFieldType = (typeof DOCUMENT_FIELD_TYPES)[number];

export const DOCUMENT_FIELD_TYPE_LABELS: Record<DocumentFieldType, string> = {
  text: "Tekst",
  textarea: "Tekst (meerregelig)",
  date: "Datum",
  checkbox: "Selectievak",
  number: "Getal",
  signature_area: "Handtekening",
};
