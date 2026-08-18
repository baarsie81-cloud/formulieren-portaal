import { describe, expect, it } from "vitest";
import { parseFieldValues } from "@/server/forms/values";
import type { FieldSchemaSnapshot } from "@/server/forms/snapshot";

const snapshot: FieldSchemaSnapshot[] = [
  {
    pdfFieldName: "Naam",
    valueKey: "naam",
    fieldType: "text",
    isRequired: true,
    sortOrder: 0,
    pageNumber: 1,
  },
  {
    pdfFieldName: "Toelichting",
    valueKey: "toelichting",
    fieldType: "textarea",
    isRequired: false,
    sortOrder: 1,
    pageNumber: 1,
  },
  {
    pdfFieldName: "Geboortedatum",
    valueKey: "geboortedatum",
    fieldType: "date",
    isRequired: false,
    sortOrder: 2,
    pageNumber: 1,
  },
  {
    pdfFieldName: "Akkoord",
    valueKey: "akkoord",
    fieldType: "checkbox",
    isRequired: true,
    sortOrder: 3,
    pageNumber: 1,
  },
  {
    pdfFieldName: "Signature1",
    valueKey: "handtekening",
    fieldType: "signature_area",
    isRequired: true,
    sortOrder: 4,
    pageNumber: 1,
  },
];

describe("parseFieldValues", () => {
  it("allows a draft without required fields and ignores signature areas", () => {
    expect(
      parseFieldValues(snapshot, { toelichting: "  later  " }, "draft"),
    ).toEqual({
      success: true,
      data: {
        toelichting: "later",
        akkoord: false,
      },
    });
  });

  it("requires fillable fields on submit but not the signature area", () => {
    expect(parseFieldValues(snapshot, { naam: "Ada" }, "submit")).toEqual({
      success: false,
      error: "Vul alle verplichte velden in.",
    });

    expect(
      parseFieldValues(
        snapshot,
        {
          naam: "Ada",
          akkoord: true,
          geboortedatum: "2020-01-02",
        },
        "submit",
      ),
    ).toEqual({
      success: true,
      data: {
        naam: "Ada",
        toelichting: "",
        geboortedatum: "2020-01-02",
        akkoord: true,
      },
    });
  });

  it("rejects invalid dates and unknown extra keys are ignored", () => {
    expect(
      parseFieldValues(snapshot, { naam: "Ada", akkoord: true, geboortedatum: "02-01-2020" }, "submit"),
    ).toEqual({
      success: false,
      error: "Vul een geldige datum in.",
    });

    const parsed = parseFieldValues(
      snapshot,
      { naam: "Ada", akkoord: true, secret: "nope" },
      "submit",
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("secret");
      expect(parsed.data).not.toHaveProperty("handtekening");
    }
  });
});
