import { describe, expect, it } from "vitest";
import {
  fillableFields,
  parseFieldsSchemaSnapshot,
  toFieldsSchemaSnapshot,
} from "@/server/forms/snapshot";

const fields = [
  {
    pdfFieldName: "client_name",
    valueKey: "client_name",
    fieldType: "text" as const,
    isRequired: true,
    sortOrder: 1,
    pageNumber: 1,
  },
  {
    pdfFieldName: "Signature1",
    valueKey: "signature1",
    fieldType: "signature_area" as const,
    isRequired: true,
    sortOrder: 2,
    pageNumber: 1,
  },
];

describe("fields schema snapshot", () => {
  it("freezes mapping fields without inventing extras", () => {
    const snapshot = toFieldsSchemaSnapshot(fields);

    expect(snapshot).toEqual(fields);
    expect(fillableFields(snapshot).map((field) => field.valueKey)).toEqual(["client_name"]);
  });

  it("rejects a tampered stored snapshot", () => {
    expect(parseFieldsSchemaSnapshot([{ valueKey: "x" }])).toBeNull();
    expect(parseFieldsSchemaSnapshot(fields)?.map((field) => field.pdfFieldName)).toEqual([
      "client_name",
      "Signature1",
    ]);
  });
});
