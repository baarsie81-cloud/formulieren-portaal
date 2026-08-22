import { describe, expect, it } from "vitest";
import {
  parseFieldMappings,
  parseTemplateMetadata,
  readFieldMappings,
  templateIdSchema,
} from "@/server/templates/schema";

describe("parseTemplateMetadata", () => {
  it("accepts valid intake and contract categories", () => {
    expect(
      parseTemplateMetadata({
        name: "  Intake  ",
        description: "  ",
        category: "intake",
      }),
    ).toEqual({
      success: true,
      data: {
        name: "Intake",
        description: null,
        category: "intake",
      },
    });

    expect(
      parseTemplateMetadata({
        name: "Contract",
        description: "Toelichting",
        category: "contract",
      }),
    ).toEqual({
      success: true,
      data: {
        name: "Contract",
        description: "Toelichting",
        category: "contract",
      },
    });
  });

  it("rejects a missing name", () => {
    expect(
      parseTemplateMetadata({ name: "   ", description: "", category: "intake" }),
    ).toEqual({
      success: false,
      error: "Vul een naam in.",
    });
  });

  it("rejects an invalid category", () => {
    expect(
      parseTemplateMetadata({
        name: "Formulier",
        description: "",
        category: "onbekend",
      }),
    ).toEqual({
      success: false,
      error: "Kies een formuliertype (Intake of Contract).",
    });

    expect(
      parseTemplateMetadata({
        name: "Formulier",
        description: "",
        category: "",
      }),
    ).toEqual({
      success: false,
      error: "Kies een formuliertype (Intake of Contract).",
    });
  });
});

describe("parseFieldMappings", () => {
  const field = {
    id: "11111111-1111-4111-8111-111111111111",
    pdfFieldName: "client_name",
    valueKey: "client_name",
    fieldType: "text" as const,
    isRequired: true,
    sortOrder: 0,
  };

  it("accepts unique mappings and defaults signatureRole to client", () => {
    expect(parseFieldMappings([field])).toEqual({
      success: true,
      data: [{ ...field, signatureRole: "client" }],
    });
  });

  it("rejects duplicate value keys and invalid keys", () => {
    expect(
      parseFieldMappings([
        field,
        { ...field, id: "22222222-2222-4222-8222-222222222222" },
      ]),
    ).toEqual({
      success: false,
      error: "Elke sleutel mag maar één keer voorkomen.",
    });

    expect(parseFieldMappings([{ ...field, valueKey: "Client-Name" }])).toEqual({
      success: false,
      error: "Sleutels mogen alleen kleine letters, cijfers en underscores bevatten.",
    });
  });

  it("keeps organization role only for signature_area fields", () => {
    expect(
      parseFieldMappings([
        {
          id: "11111111-1111-4111-8111-111111111111",
          pdfFieldName: "OrgSig",
          valueKey: "org_signature",
          fieldType: "signature_area",
          isRequired: true,
          sortOrder: 0,
          signatureRole: "organization",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          pdfFieldName: "ClientSig",
          valueKey: "client_signature",
          fieldType: "signature_area",
          isRequired: true,
          sortOrder: 1,
          signatureRole: "client",
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          pdfFieldName: "Name",
          valueKey: "name",
          fieldType: "text",
          isRequired: true,
          sortOrder: 2,
          signatureRole: "organization",
        },
      ]),
    ).toEqual({
      success: true,
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          pdfFieldName: "OrgSig",
          valueKey: "org_signature",
          fieldType: "signature_area",
          isRequired: true,
          sortOrder: 0,
          signatureRole: "organization",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          pdfFieldName: "ClientSig",
          valueKey: "client_signature",
          fieldType: "signature_area",
          isRequired: true,
          sortOrder: 1,
          signatureRole: "client",
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          pdfFieldName: "Name",
          valueKey: "name",
          fieldType: "text",
          isRequired: true,
          sortOrder: 2,
          signatureRole: "client",
        },
      ],
    });
  });

  it("reads signatureRole from form data", () => {
    const formData = new FormData();
    formData.append("fieldId", "11111111-1111-4111-8111-111111111111");
    formData.append("pdfFieldName", "OrgSig");
    formData.append("valueKey", "org_signature");
    formData.append("fieldType", "signature_area");
    formData.append("sortOrder", "0");
    formData.append("signatureRole", "organization");
    formData.set("required-11111111-1111-4111-8111-111111111111", "on");

    const parsed = parseFieldMappings(readFieldMappings(formData));

    expect(parsed).toEqual({
      success: true,
      data: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          pdfFieldName: "OrgSig",
          valueKey: "org_signature",
          fieldType: "signature_area",
          isRequired: true,
          sortOrder: 0,
          signatureRole: "organization",
        },
      ],
    });
  });
});

describe("templateIdSchema", () => {
  it("accepts a UUID", () => {
    expect(templateIdSchema.safeParse("11111111-1111-4111-8111-111111111111").success).toBe(
      true,
    );
    expect(templateIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
