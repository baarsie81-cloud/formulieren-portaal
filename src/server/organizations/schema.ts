import { z } from "zod";

const optionalNullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

export const organizationSignatureMetadataSchema = z.object({
  signerName: z.string().trim().min(2).max(200),
  signerTitle: optionalNullableText(200),
});

export type OrganizationSignatureMetadataInput = z.infer<
  typeof organizationSignatureMetadataSchema
>;

export type OrganizationSignatureMetadataFields = {
  signerName: string;
  signerTitle: string;
};

export function readOrganizationSignatureMetadataFields(
  formData: FormData,
): OrganizationSignatureMetadataFields {
  return {
    signerName: readFormString(formData, "signerName"),
    signerTitle: readFormString(formData, "signerTitle"),
  };
}

export function parseOrganizationSignatureMetadata(
  data: OrganizationSignatureMetadataFields,
):
  | { success: true; data: OrganizationSignatureMetadataInput }
  | { success: false; error: string } {
  const parsed = organizationSignatureMetadataSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: metadataValidationMessage(parsed.error) };
  }

  return { success: true, data: parsed.data };
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function metadataValidationMessage(error: z.ZodError): string {
  const field = error.issues[0]?.path[0];

  if (field === "signerName") {
    return "Vul de naam van de ondertekenaar in (minimaal 2 tekens).";
  }

  if (field === "signerTitle") {
    return "Functie is te lang.";
  }

  return "Controleer de ingevulde gegevens.";
}
