import "server-only";

import { assertTemplateBlobKey } from "@/server/storage/paths";
import {
  assertPdfSha256,
  getPrivatePdfBytes,
} from "@/server/storage/blob";
import { IntegrityError } from "@/server/errors";
import { fillAcroForm } from "@/server/pdf/fill";
import { parseFieldsSchemaSnapshot } from "@/server/forms/snapshot";
import { asFieldValueMap } from "@/server/forms/values";

export async function buildFilledPdfBytes(input: {
  organizationId: string;
  documentTemplateId: string;
  templateBlobKey: string;
  templateSha256: string;
  fieldsSchemaSnapshot: unknown;
  fieldValues: unknown;
}): Promise<Uint8Array> {
  const snapshot = parseFieldsSchemaSnapshot(input.fieldsSchemaSnapshot);

  if (!snapshot) {
    throw new IntegrityError("Stored field schema is invalid");
  }

  assertTemplateBlobKey(
    input.templateBlobKey,
    input.organizationId,
    input.documentTemplateId,
    input.templateSha256,
  );

  const bytes = await getPrivatePdfBytes(input.templateBlobKey);
  assertPdfSha256(bytes, input.templateSha256);

  return fillAcroForm(bytes, snapshot, asFieldValueMap(input.fieldValues));
}
