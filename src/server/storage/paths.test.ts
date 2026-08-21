import { describe, expect, it } from "vitest";
import {
  assertFinalPdfBlobKey,
  assertSignatureBlobKey,
  assertTemplateBlobKey,
  finalPdfBlobKey,
  organizationSignaturePngBlobKey,
  signaturePngBlobKey,
  templatePdfBlobKey,
} from "@/server/storage/paths";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const DOCUMENT_ID = "55555555-5555-4555-8555-555555555555";
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

describe("signaturePngBlobKey", () => {
  it("stores signatures under the tenant and document id", () => {
    const key = signaturePngBlobKey(ORGANIZATION_ID, DOCUMENT_ID, SHA256);

    expect(key).toBe(`${ORGANIZATION_ID}/signatures/${DOCUMENT_ID}/${SHA256}.png`);
  });
});

describe("organizationSignaturePngBlobKey", () => {
  it("stores the organization signature under the tenant", () => {
    const key = organizationSignaturePngBlobKey(ORGANIZATION_ID, SHA256);

    expect(key).toBe(`${ORGANIZATION_ID}/organization-signature/${SHA256}.png`);
  });
});

describe("finalPdfBlobKey", () => {
  it("stores final PDFs under the tenant, request, and document id", () => {
    const key = finalPdfBlobKey(ORGANIZATION_ID, REQUEST_ID, DOCUMENT_ID, SHA256);

    expect(key).toBe(`${ORGANIZATION_ID}/final/${REQUEST_ID}/${DOCUMENT_ID}/${SHA256}.pdf`);
  });
});

describe("assertSignatureBlobKey", () => {
  it("accepts the canonical signature key", () => {
    const key = signaturePngBlobKey(ORGANIZATION_ID, DOCUMENT_ID, SHA256);

    expect(() =>
      assertSignatureBlobKey(key, ORGANIZATION_ID, DOCUMENT_ID, SHA256),
    ).not.toThrow();
  });
});

describe("assertFinalPdfBlobKey", () => {
  it("accepts the canonical final PDF key", () => {
    const key = finalPdfBlobKey(ORGANIZATION_ID, REQUEST_ID, DOCUMENT_ID, SHA256);

    expect(() =>
      assertFinalPdfBlobKey(key, ORGANIZATION_ID, REQUEST_ID, DOCUMENT_ID, SHA256),
    ).not.toThrow();
    expect(() =>
      assertFinalPdfBlobKey(
        templatePdfBlobKey(ORGANIZATION_ID, TEMPLATE_ID, SHA256),
        ORGANIZATION_ID,
        REQUEST_ID,
        DOCUMENT_ID,
        SHA256,
      ),
    ).toThrow("Blob key does not match final PDF identity");
  });
});
