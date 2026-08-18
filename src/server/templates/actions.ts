"use server";

import { notFound, redirect } from "next/navigation";
import { requireDashboardContext } from "@/server/auth/guard";
import { ConflictError, NotFoundError, StorageError, ValidationError } from "@/server/errors";
import { readPdfBytes } from "@/server/pdf/validate";
import {
  parseFieldMappings,
  parseTemplateMetadata,
  readFieldMappings,
  readTemplateMetadataFields,
  templateIdSchema,
} from "@/server/templates/schema";
import {
  archiveTemplate,
  createTemplate,
  NO_ACROFORM_FIELDS_MESSAGE,
  updateTemplateFieldMappings,
  updateTemplateMetadata,
} from "@/server/templates/service";

export type TemplateFormState = {
  error: string | null;
};

export async function createTemplateAction(
  _state: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const tenant = await requireDashboardContext();
  const parsed = parseTemplateMetadata(readTemplateMetadataFields(formData));

  if (!parsed.success) {
    return { error: parsed.error };
  }

  const pdf = formData.get("pdf");

  if (!(pdf instanceof File)) {
    return { error: "Upload een PDF-bestand." };
  }

  let template;

  try {
    const pdfBytes = await readPdfBytes(pdf);
    template = await createTemplate(tenant, parsed.data, pdfBytes);
  } catch (error) {
    return { error: toTemplateMutationError(error) };
  }

  redirect(`/dashboard/templates/${template.id}`);
}

export async function updateTemplateMetadataAction(
  _state: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const tenant = await requireDashboardContext();
  const templateId = parseTemplateIdOrNotFound(formData.get("templateId"));
  const parsed = parseTemplateMetadata(readTemplateMetadataFields(formData));

  if (!parsed.success) {
    return { error: parsed.error };
  }

  try {
    await updateTemplateMetadata(tenant, templateId, parsed.data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    return { error: toTemplateMutationError(error) };
  }

  redirect(`/dashboard/templates/${templateId}`);
}

export async function updateTemplateFieldsAction(
  _state: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const tenant = await requireDashboardContext();
  const templateId = parseTemplateIdOrNotFound(formData.get("templateId"));
  const parsed = parseFieldMappings(readFieldMappings(formData));

  if (!parsed.success) {
    return { error: parsed.error };
  }

  try {
    await updateTemplateFieldMappings(tenant, templateId, parsed.data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    return { error: toTemplateMutationError(error) };
  }

  redirect(`/dashboard/templates/${templateId}`);
}

export async function archiveTemplateAction(formData: FormData) {
  const tenant = await requireDashboardContext();
  const templateId = parseTemplateIdOrNotFound(formData.get("templateId"));

  try {
    await archiveTemplate(tenant, templateId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  redirect("/dashboard/templates");
}

function parseTemplateIdOrNotFound(value: FormDataEntryValue | null): string {
  const parsed = templateIdSchema.safeParse(value);

  if (!parsed.success) {
    notFound();
  }

  return parsed.data;
}

function toTemplateMutationError(error: unknown): string {
  if (error instanceof ValidationError) {
    if (error.message === "PDF is too large") {
      return "Het PDF-bestand is te groot (maximaal 4 MB).";
    }

    if (
      error.message === "File must be a PDF" ||
      error.message === "File must be a valid PDF" ||
      error.message === "Upload a PDF file"
    ) {
      return "Upload een geldig PDF-bestand.";
    }

    if (error.message === "Field mapping does not match the stored PDF fields") {
      return "De veldkoppeling hoort niet bij dit PDF-sjabloon.";
    }

    if (error.message === NO_ACROFORM_FIELDS_MESSAGE) {
      return "Dit PDF-bestand bevat geen interactieve AcroForm-velden. Maak eerst invulvelden aan en upload daarna opnieuw.";
    }

    return "Controleer de ingevulde gegevens.";
  }

  if (error instanceof ConflictError) {
    return "Een gearchiveerd sjabloon kan niet worden gewijzigd.";
  }

  if (error instanceof StorageError) {
    return "Bestandsopslag is niet geconfigureerd. Zet BLOB_READ_WRITE_TOKEN in .env.local.";
  }

  throw error;
}
