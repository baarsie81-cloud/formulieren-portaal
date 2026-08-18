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

export const FORM_REQUEST_TTL_DAYS = 14;

export const FORM_REQUEST_STATUSES = [
  "sent",
  "opened",
  "in_progress",
  "completed",
  "expired",
  "cancelled",
] as const;

export type FormRequestStatus = (typeof FORM_REQUEST_STATUSES)[number];

export const FORM_REQUEST_STATUS_LABELS: Record<FormRequestStatus, string> = {
  sent: "Link aangemaakt",
  opened: "Geopend",
  in_progress: "Bezig met invullen",
  completed: "Afgerond",
  expired: "Verlopen",
  cancelled: "Geannuleerd",
};

export const FORM_SESSION_COOKIE = "fp_form_session";
export const FORM_CREATED_TOKEN_COOKIE = "fp_created_form_token";

/** 32 random bytes as base64url (no padding). */
export const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const PUBLIC_FORM_INVALID_MESSAGE =
  "Deze link is ongeldig of verlopen. Neem contact op met de praktijk als je een nieuw formulier verwacht.";
