const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

function assertSha256(value: string): void {
  if (!SHA256_PATTERN.test(value)) {
    throw new Error("Invalid SHA-256");
  }
}

/** Content-addressed private blob path. Always prefixed with the tenant UUID. */
export function templatePdfBlobKey(
  organizationId: string,
  templateId: string,
  sha256: string,
): string {
  assertUuid(organizationId, "organization id");
  assertUuid(templateId, "template id");
  assertSha256(sha256);

  return `${organizationId}/templates/${templateId}/${sha256}.pdf`;
}

export function assertTemplateBlobKey(
  blobKey: string,
  organizationId: string,
  templateId: string,
  sha256: string,
): void {
  const expected = templatePdfBlobKey(organizationId, templateId, sha256);

  if (blobKey !== expected) {
    throw new Error("Blob key does not match template identity");
  }
}
