import { z } from "zod";
import {
  ORGANIZATION_EMAIL_TEMPLATE_KINDS,
  type OrganizationEmailTemplateKind,
} from "@/lib/constants";

const mailSubjectSchema = z.string().trim().min(1).max(200);
const mailBodySchema = z.string().trim().min(1).max(100_000);

export const organizationEmailTemplateKindSchema = z.enum(
  ORGANIZATION_EMAIL_TEMPLATE_KINDS,
);

export const upsertOrganizationEmailTemplateSchema = z.object({
  kind: organizationEmailTemplateKindSchema,
  subjectTemplate: mailSubjectSchema,
  bodyTemplate: mailBodySchema,
});

export type UpsertOrganizationEmailTemplateInput = z.infer<
  typeof upsertOrganizationEmailTemplateSchema
>;

export type OrganizationEmailTemplateFormFields = {
  kind: string;
  subjectTemplate: string;
  bodyTemplate: string;
};

export function readOrganizationEmailTemplateFormFields(
  formData: FormData,
): OrganizationEmailTemplateFormFields {
  return {
    kind: readFormString(formData, "kind"),
    subjectTemplate: readFormString(formData, "subjectTemplate"),
    bodyTemplate: readFormString(formData, "bodyTemplate"),
  };
}

export function parseUpsertOrganizationEmailTemplate(
  data: OrganizationEmailTemplateFormFields,
):
  | { success: true; data: UpsertOrganizationEmailTemplateInput }
  | { success: false; error: string } {
  const parsed = upsertOrganizationEmailTemplateSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: upsertValidationMessage(parsed.error) };
  }

  return { success: true, data: parsed.data };
}

export function parseOrganizationEmailTemplateKind(
  value: FormDataEntryValue | null,
): OrganizationEmailTemplateKind | null {
  const raw = typeof value === "string" ? value : "";
  const parsed = organizationEmailTemplateKindSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function placeholdersForKind(kind: OrganizationEmailTemplateKind): string[] {
  if (kind === "intake_invitation" || kind === "contract_invitation") {
    return [
      "organizationName",
      "recipientName",
      "formUrl",
      "expiresAt",
      "ttlDays",
    ];
  }

  return ["organizationName", "recipientName"];
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function upsertValidationMessage(error: z.ZodError): string {
  const field = error.issues[0]?.path[0];

  if (field === "kind") {
    return "Onbekend e-mailsjabloon.";
  }

  if (field === "subjectTemplate") {
    return "Vul een onderwerp in (maximaal 200 tekens).";
  }

  if (field === "bodyTemplate") {
    return "Vul een berichttekst in.";
  }

  return "Controleer de ingevulde gegevens.";
}
