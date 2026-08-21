"use server";

import { redirect } from "next/navigation";
import { requireDashboardContext } from "@/server/auth/guard";
import { StorageError, ValidationError } from "@/server/errors";
import {
  parseOrganizationSignatureMetadata,
  readOrganizationSignatureMetadataFields,
} from "@/server/organizations/schema";
import { updateOrganizationSignature } from "@/server/organizations/service";
import { readSignaturePngBytes } from "@/server/pdf/signature-image";

export type OrganizationSignatureFormState = {
  error: string | null;
};

export async function updateOrganizationSignatureAction(
  _state: OrganizationSignatureFormState,
  formData: FormData,
): Promise<OrganizationSignatureFormState> {
  const tenant = await requireDashboardContext();
  const parsed = parseOrganizationSignatureMetadata(
    readOrganizationSignatureMetadataFields(formData),
  );

  if (!parsed.success) {
    return { error: parsed.error };
  }

  const png = formData.get("signaturePng");
  let pngBytes: Uint8Array | null = null;

  if (png instanceof File && png.size > 0) {
    try {
      pngBytes = await readSignaturePngBytes(png);
    } catch (error) {
      return { error: toOrganizationSignatureError(error) };
    }
  } else if (png instanceof File && png.size === 0) {
    pngBytes = null;
  } else if (png != null && png !== "") {
    return { error: "Upload een PNG-bestand." };
  }

  try {
    await updateOrganizationSignature(tenant, parsed.data, pngBytes);
  } catch (error) {
    return { error: toOrganizationSignatureError(error) };
  }

  redirect("/dashboard/praktijk");
}

function toOrganizationSignatureError(error: unknown): string {
  if (error instanceof ValidationError) {
    if (
      error.message === "Upload a PNG file" ||
      error.message === "File must be a PNG" ||
      error.message === "Handtekening moet een PNG-afbeelding zijn"
    ) {
      return "Upload een geldig PNG-bestand.";
    }

    if (error.message === "Signature PNG is too large") {
      return "Het PNG-bestand is te groot (maximaal 512 KB).";
    }

    return "Controleer de ingevulde gegevens.";
  }

  if (error instanceof StorageError) {
    return "Bestandsopslag is niet geconfigureerd. Zet BLOB_READ_WRITE_TOKEN in .env.local.";
  }

  throw error;
}
