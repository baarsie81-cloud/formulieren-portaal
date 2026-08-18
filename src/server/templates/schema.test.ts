import { describe, expect, it } from "vitest";
import {
  parseFieldMappings,
  parseTemplateMetadata,
  templateIdSchema,
} from "@/server/templates/schema";

describe("parseTemplateMetadata", () => {
  it("accepts a name and optional description", () => {
    expect(
      parseTemplateMetadata({
        name: "  Intake  ",
        description: "  ",
      }),
    ).toEqual({
      success: true,
      data: {
        name: "Intake",
        description: null,
      },
    });
  });

  it("rejects a missing name", () => {
    expect(parseTemplateMetadata({ name: "   ", description: "" })).toEqual({
      success: false,
      error: "Vul een naam in.",
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

  it("accepts unique mappings", () => {
    expect(parseFieldMappings([field])).toEqual({
      success: true,
      data: [field],
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
});

describe("templateIdSchema", () => {
  it("accepts a UUID", () => {
    expect(templateIdSchema.safeParse("11111111-1111-4111-8111-111111111111").success).toBe(
      true,
    );
    expect(templateIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
