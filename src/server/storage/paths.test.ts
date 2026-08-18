import { describe, expect, it } from "vitest";
import { assertTemplateBlobKey, templatePdfBlobKey } from "@/server/storage/paths";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
const SHA256 = "a".repeat(64);

describe("templatePdfBlobKey", () => {
  it("prefixes the path with the organization id", () => {
    const key = templatePdfBlobKey(ORGANIZATION_ID, TEMPLATE_ID, SHA256);

    expect(key.startsWith(`${ORGANIZATION_ID}/`)).toBe(true);
    expect(key).toContain(`/templates/${TEMPLATE_ID}/`);
    expect(key.endsWith(`/${SHA256}.pdf`)).toBe(true);
    expect(key).not.toContain(OTHER_ORGANIZATION_ID);
  });

  it("rejects values that could traverse or forge a path", () => {
    expect(() =>
      templatePdfBlobKey("../secret", TEMPLATE_ID, SHA256),
    ).toThrow("Invalid organization id");
    expect(() =>
      templatePdfBlobKey(ORGANIZATION_ID, "not-a-uuid", SHA256),
    ).toThrow("Invalid template id");
    expect(() =>
      templatePdfBlobKey(ORGANIZATION_ID, TEMPLATE_ID, "deadbeef"),
    ).toThrow("Invalid SHA-256");
  });
});

describe("assertTemplateBlobKey", () => {
  it("accepts the canonical key and rejects a foreign prefix", () => {
    const key = templatePdfBlobKey(ORGANIZATION_ID, TEMPLATE_ID, SHA256);

    expect(() =>
      assertTemplateBlobKey(key, ORGANIZATION_ID, TEMPLATE_ID, SHA256),
    ).not.toThrow();
    expect(() =>
      assertTemplateBlobKey(
        `${OTHER_ORGANIZATION_ID}/templates/${TEMPLATE_ID}/${SHA256}.pdf`,
        ORGANIZATION_ID,
        TEMPLATE_ID,
        SHA256,
      ),
    ).toThrow("Blob key does not match template identity");
  });
});
