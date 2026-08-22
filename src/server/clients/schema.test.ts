import { describe, expect, it } from "vitest";
import {
  clientIdSchema,
  parseClientInput,
  parsePermanentDeleteConfirmation,
  PERMANENT_DELETE_CONFIRMATION,
} from "@/server/clients/schema";

describe("parseClientInput", () => {
  it("accepts a minimal valid client and normalizes email", () => {
    expect(
      parseClientInput({
        displayName: "  Ada Berg  ",
        email: "Ada@Praktijk.NL",
        phone: "",
        externalReference: "  ",
      }),
    ).toEqual({
      success: true,
      data: {
        displayName: "Ada Berg",
        email: "ada@praktijk.nl",
        phone: null,
        externalReference: null,
      },
    });
  });

  it("keeps optional phone and external reference", () => {
    expect(
      parseClientInput({
        displayName: "Ada Berg",
        email: "ada@praktijk.nl",
        phone: "06 12345678",
        externalReference: "Dossier-12",
      }),
    ).toEqual({
      success: true,
      data: {
        displayName: "Ada Berg",
        email: "ada@praktijk.nl",
        phone: "06 12345678",
        externalReference: "Dossier-12",
      },
    });
  });

  it("rejects missing name and invalid email", () => {
    expect(
      parseClientInput({
        displayName: "   ",
        email: "ada@praktijk.nl",
        phone: "",
        externalReference: "",
      }),
    ).toEqual({
      success: false,
      error: "Vul een naam in.",
    });

    expect(
      parseClientInput({
        displayName: "Ada Berg",
        email: "niet-geldig",
        phone: "",
        externalReference: "",
      }),
    ).toEqual({
      success: false,
      error: "Vul een geldig e-mailadres in.",
    });
  });
});

describe("clientIdSchema", () => {
  it("accepts a UUID", () => {
    expect(clientIdSchema.safeParse("11111111-1111-4111-8111-111111111111").success).toBe(
      true,
    );
    expect(clientIdSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("parsePermanentDeleteConfirmation", () => {
  it("accepts exact VERWIJDEREN", () => {
    expect(parsePermanentDeleteConfirmation(PERMANENT_DELETE_CONFIRMATION)).toEqual({
      success: true,
      data: PERMANENT_DELETE_CONFIRMATION,
    });
  });

  it("rejects wrong casing, empty, and partial values", () => {
    for (const value of ["verwijderen", "Verwijderen", "VERWIJDER", "", null]) {
      expect(parsePermanentDeleteConfirmation(value).success).toBe(false);
    }
  });
});
