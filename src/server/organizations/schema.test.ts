import { describe, expect, it } from "vitest";
import {
  parseOrganizationSignatureMetadata,
  readOrganizationSignatureMetadataFields,
} from "@/server/organizations/schema";

describe("organization signature metadata", () => {
  it("accepts a name and optional title", () => {
    const parsed = parseOrganizationSignatureMetadata({
      signerName: "Praktijk Berg",
      signerTitle: "Directeur",
    });

    expect(parsed).toEqual({
      success: true,
      data: {
        signerName: "Praktijk Berg",
        signerTitle: "Directeur",
      },
    });
  });

  it("treats an empty title as null", () => {
    const parsed = parseOrganizationSignatureMetadata({
      signerName: "Ada Berg",
      signerTitle: "  ",
    });

    expect(parsed).toEqual({
      success: true,
      data: {
        signerName: "Ada Berg",
        signerTitle: null,
      },
    });
  });

  it("rejects a too-short signer name", () => {
    const parsed = parseOrganizationSignatureMetadata({
      signerName: "A",
      signerTitle: "",
    });

    expect(parsed.success).toBe(false);
  });

  it("reads form fields", () => {
    const formData = new FormData();
    formData.set("signerName", "Praktijk Berg");
    formData.set("signerTitle", "Behandelaar");

    expect(readOrganizationSignatureMetadataFields(formData)).toEqual({
      signerName: "Praktijk Berg",
      signerTitle: "Behandelaar",
    });
  });
});
