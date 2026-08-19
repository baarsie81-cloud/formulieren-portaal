import "server-only";

import { assertTemplateBlobKey, assertFinalPdfBlobKey } from "@/server/storage/paths";
import {
  assertPdfSha256,
  getPrivatePdfBytes,
} from "@/server/storage/blob";
import { IntegrityError } from "@/server/errors";

export async function getStoredFinalPdfBytes(input: {
  organizationId: string;
  formRequestId: string;
  formDocumentId: string;
  finalPdfBlobKey: string;
  finalPdfSha256: string;
}): Promise<Uint8Array> {
  assertFinalPdfBlobKey(
    input.finalPdfBlobKey,
    input.organizationId,
    input.formRequestId,
    input.formDocumentId,
    input.finalPdfSha256,
  );

  const bytes = await getPrivatePdfBytes(input.finalPdfBlobKey);
  assertPdfSha256(bytes, input.finalPdfSha256);

  return bytes;
}

export async function getStoredTemplatePdfBytes(input: {
  organizationId: string;
  documentTemplateId: string;
  templateBlobKey: string;
  templateSha256: string;
}): Promise<Uint8Array> {
  assertTemplateBlobKey(
    input.templateBlobKey,
    input.organizationId,
    input.documentTemplateId,
    input.templateSha256,
  );

  const bytes = await getPrivatePdfBytes(input.templateBlobKey);
  assertPdfSha256(bytes, input.templateSha256);

  return bytes;
}

export function requireFinalizedDocument(document: {
  status: string;
  finalPdfBlobKey: string | null;
  finalPdfSha256: string | null;
  finalizedAt: Date | null;
}): asserts document is {
  status: "finalized";
  finalPdfBlobKey: string;
  finalPdfSha256: string;
  finalizedAt: Date;
} {
  if (
    document.status !== "finalized" ||
    !document.finalPdfBlobKey ||
    !document.finalPdfSha256 ||
    !document.finalizedAt
  ) {
    throw new IntegrityError("Document is not finalized");
  }
}
