"use server";

import { redirect } from "next/navigation";
import { requireDashboardContext } from "@/server/auth/guard";
import {
  parseOrganizationEmailTemplateKind,
  parseUpsertOrganizationEmailTemplate,
  readOrganizationEmailTemplateFormFields,
} from "@/server/email-templates/schema";
import {
  resetOrganizationEmailTemplate,
  upsertOrganizationEmailTemplate,
} from "@/server/email-templates/service";
import { NotFoundError } from "@/server/errors";

export type OrganizationEmailTemplateFormState = {
  error: string | null;
};

export async function upsertOrganizationEmailTemplateAction(
  _state: OrganizationEmailTemplateFormState,
  formData: FormData,
): Promise<OrganizationEmailTemplateFormState> {
  const tenant = await requireDashboardContext();
  const parsed = parseUpsertOrganizationEmailTemplate(
    readOrganizationEmailTemplateFormFields(formData),
  );

  if (!parsed.success) {
    return { error: parsed.error };
  }

  try {
    await upsertOrganizationEmailTemplate(tenant, parsed.data);
  } catch {
    return { error: "Het e-mailsjabloon kon niet worden opgeslagen." };
  }

  redirect(
    `/dashboard/praktijk/e-mail?saved=${encodeURIComponent(parsed.data.kind)}`,
  );
}

export async function resetOrganizationEmailTemplateAction(
  _state: OrganizationEmailTemplateFormState,
  formData: FormData,
): Promise<OrganizationEmailTemplateFormState> {
  const tenant = await requireDashboardContext();
  const kind = parseOrganizationEmailTemplateKind(formData.get("kind"));

  if (!kind) {
    return { error: "Onbekend e-mailsjabloon." };
  }

  try {
    await resetOrganizationEmailTemplate(tenant, kind);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { error: "Dit sjabloon gebruikt al de standaardtekst." };
    }

    return { error: "Het e-mailsjabloon kon niet worden hersteld." };
  }

  redirect(`/dashboard/praktijk/e-mail?reset=${encodeURIComponent(kind)}`);
}
