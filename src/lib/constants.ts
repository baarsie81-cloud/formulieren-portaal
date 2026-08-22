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

export const SIGNATURE_ROLES = ["client", "organization"] as const;

export type SignatureRole = (typeof SIGNATURE_ROLES)[number];

export const SIGNATURE_ROLE_LABELS: Record<SignatureRole, string> = {
  client: "Cliënt",
  organization: "Organisatie",
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
export const FORM_SIGNED_COOKIE = "fp_form_signed";

/** 32 random bytes as base64url (no padding). */
export const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const PUBLIC_FORM_INVALID_MESSAGE =
  "Deze link is ongeldig of verlopen. Neem contact op met de praktijk als je een nieuw formulier verwacht.";

export const DOCUMENT_CATEGORIES = ["intake", "contract"] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  intake: "Intake",
  contract: "Contract",
};

export const ORGANIZATION_EMAIL_TEMPLATE_KINDS = [
  "intake_invitation",
  "contract_invitation",
  "intake_confirmation",
  "contract_confirmation",
] as const;

export type OrganizationEmailTemplateKind =
  (typeof ORGANIZATION_EMAIL_TEMPLATE_KINDS)[number];

export const ORGANIZATION_EMAIL_TEMPLATE_KIND_LABELS: Record<
  OrganizationEmailTemplateKind,
  string
> = {
  intake_invitation: "Intake-uitnodiging",
  contract_invitation: "Contract-uitnodiging",
  intake_confirmation: "Intake-bevestiging",
  contract_confirmation: "Contract-bevestiging",
};

export const EMAIL_KINDS = ["invitation", "confirmation"] as const;

export type EmailKind = (typeof EMAIL_KINDS)[number];

/** Max PNG size for a client-drawn or typed-rendered signature. */
export const MAX_SIGNATURE_PNG_BYTES = 512 * 1024;

export const SIGNATURE_DECLARATION_TEXT =
  "Ik verklaar dat de ingevulde gegevens naar waarheid zijn ingevuld en ga akkoord met het ondertekenen van dit document.";
