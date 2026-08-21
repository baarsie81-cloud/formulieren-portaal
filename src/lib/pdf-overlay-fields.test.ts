import { describe, expect, it } from "vitest";
import {
  groupOverlayFieldsByPage,
  pickOverlayInputFields,
} from "@/lib/pdf-overlay-fields";
import type { FieldSchemaSnapshot } from "@/server/forms/snapshot";

const geometry = {
  x: 10,
  y: 20,
  width: 100,
  height: 16,
  pageWidth: 595,
  pageHeight: 842,
};

function field(
  partial: Partial<FieldSchemaSnapshot> & Pick<FieldSchemaSnapshot, "valueKey" | "pdfFieldName">,
): FieldSchemaSnapshot {
  return {
    fieldType: "text",
    isRequired: false,
    sortOrder: 0,
    pageNumber: 1,
    x: null,
    y: null,
    width: null,
    height: null,
    pageWidth: null,
    pageHeight: null,
    signatureRole: "client",
    ...partial,
  };
}

describe("pickOverlayInputFields", () => {
  it("returns overlayable fields with geometry across all pages", () => {
    const fields = [
      field({
        pdfFieldName: "b",
        valueKey: "b",
        sortOrder: 2,
        pageNumber: 1,
        ...geometry,
      }),
      field({
        pdfFieldName: "a",
        valueKey: "a",
        sortOrder: 1,
        pageNumber: 1,
        ...geometry,
      }),
      field({
        pdfFieldName: "notes",
        valueKey: "notes",
        fieldType: "textarea",
        sortOrder: 3,
        pageNumber: 1,
        ...geometry,
        height: 80,
      }),
      field({
        pdfFieldName: "born",
        valueKey: "born",
        fieldType: "date",
        sortOrder: 4,
        pageNumber: 1,
        ...geometry,
      }),
      field({
        pdfFieldName: "amount",
        valueKey: "amount",
        fieldType: "number",
        sortOrder: 5,
        pageNumber: 1,
        ...geometry,
      }),
      field({
        pdfFieldName: "page2",
        valueKey: "page2",
        sortOrder: 6,
        pageNumber: 2,
        ...geometry,
        pageWidth: 612,
        pageHeight: 792,
      }),
      field({
        pdfFieldName: "consent",
        valueKey: "consent",
        fieldType: "checkbox",
        sortOrder: 7,
        pageNumber: 1,
        ...geometry,
        width: 12,
        height: 12,
      }),
      field({
        pdfFieldName: "missing",
        valueKey: "missing",
        sortOrder: 0,
        pageNumber: 1,
      }),
    ];

    expect(pickOverlayInputFields(fields).map((entry) => entry.valueKey)).toEqual([
      "a",
      "b",
      "notes",
      "born",
      "amount",
      "consent",
      "page2",
    ]);
  });

  it("returns an empty list when no overlayable input fields exist", () => {
    expect(
      pickOverlayInputFields([
        field({ pdfFieldName: "x", valueKey: "x", fieldType: "checkbox" }),
        field({
          pdfFieldName: "sig",
          valueKey: "sig",
          fieldType: "signature_area",
          ...geometry,
        }),
      ]),
    ).toEqual([]);
  });

  it("can select a page that only has checkbox overlays", () => {
    expect(
      pickOverlayInputFields([
        field({
          pdfFieldName: "consent",
          valueKey: "consent",
          fieldType: "checkbox",
          sortOrder: 1,
          pageNumber: 1,
          ...geometry,
          width: 12,
          height: 12,
        }),
      ]).map((entry) => entry.valueKey),
    ).toEqual(["consent"]);
  });
});

describe("groupOverlayFieldsByPage", () => {
  it("groups overlay fields by ascending pageNumber", () => {
    const fields = pickOverlayInputFields([
      field({
        pdfFieldName: "city",
        valueKey: "city",
        sortOrder: 1,
        pageNumber: 2,
        ...geometry,
        pageWidth: 612,
        pageHeight: 792,
      }),
      field({
        pdfFieldName: "name",
        valueKey: "name",
        sortOrder: 1,
        pageNumber: 1,
        ...geometry,
      }),
      field({
        pdfFieldName: "consent",
        valueKey: "consent",
        fieldType: "checkbox",
        sortOrder: 2,
        pageNumber: 1,
        ...geometry,
        width: 12,
        height: 12,
      }),
    ]);

    expect(groupOverlayFieldsByPage(fields)).toEqual([
      {
        pageNumber: 1,
        fields: [
          expect.objectContaining({ valueKey: "name" }),
          expect.objectContaining({ valueKey: "consent" }),
        ],
      },
      {
        pageNumber: 2,
        fields: [expect.objectContaining({ valueKey: "city" })],
      },
    ]);
  });
});
