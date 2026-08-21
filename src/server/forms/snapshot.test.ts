import { describe, expect, it } from "vitest";
import {
  fillableFields,
  hasOrganizationSignatureFields,
  parseFieldsSchemaSnapshot,
  resolveSignatureRole,
  toFieldsSchemaSnapshot,
} from "@/server/forms/snapshot";

const legacyFields = [
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

const geometryFields = [
  {
    pdfFieldName: "client_name",
    valueKey: "client_name",
    fieldType: "text" as const,
    isRequired: true,
    sortOrder: 1,
    pageNumber: 1,
    x: 50,
    y: 700,
    width: 200,
    height: 20,
    pageWidth: 595.28,
    pageHeight: 841.89,
    signatureRole: "client" as const,
  },
  {
    pdfFieldName: "notes",
    valueKey: "notes",
    fieldType: "textarea" as const,
    isRequired: false,
    sortOrder: 2,
    pageNumber: 2,
    x: 40,
    y: 600,
    width: 300,
    height: 80,
    pageWidth: 612,
    pageHeight: 792,
    signatureRole: "client" as const,
  },
  {
    pdfFieldName: "Signature1",
    valueKey: "signature1",
    fieldType: "signature_area" as const,
    isRequired: true,
    sortOrder: 3,
    pageNumber: 2,
    x: 40,
    y: 100,
    width: 200,
    height: 60,
    pageWidth: 612,
    pageHeight: 792,
    signatureRole: "client" as const,
  },
];

describe("fields schema snapshot", () => {
  it("freezes mapping fields and includes geometry when present", () => {
    const snapshot = toFieldsSchemaSnapshot(geometryFields);

    expect(snapshot).toEqual(geometryFields);
    expect(fillableFields(snapshot).map((field) => field.valueKey)).toEqual([
      "client_name",
      "notes",
    ]);
    expect(snapshot[0]).toMatchObject({
      x: 50,
      y: 700,
      width: 200,
      height: 20,
      pageWidth: 595.28,
      pageHeight: 841.89,
      pageNumber: 1,
      signatureRole: "client",
    });
    expect(snapshot[1]).toMatchObject({
      pageNumber: 2,
      pageWidth: 612,
      pageHeight: 792,
    });
  });

  it("normalizes missing geometry and signature role for legacy template rows", () => {
    const snapshot = toFieldsSchemaSnapshot(legacyFields);

    expect(snapshot[0]).toMatchObject({
      pdfFieldName: "client_name",
      pageNumber: 1,
      x: null,
      y: null,
      width: null,
      height: null,
      pageWidth: null,
      pageHeight: null,
      signatureRole: "client",
    });
    expect(snapshot[1]?.signatureRole).toBe("client");
  });

  it("parses a legacy snapshot without geometry or signatureRole as client", () => {
    const parsed = parseFieldsSchemaSnapshot(legacyFields);

    expect(parsed?.map((field) => field.pdfFieldName)).toEqual([
      "client_name",
      "Signature1",
    ]);
    expect(parsed?.[0]).toMatchObject({
      x: null,
      y: null,
      width: null,
      height: null,
      pageWidth: null,
      pageHeight: null,
      pageNumber: 1,
      signatureRole: "client",
    });
    expect(parsed?.[1]?.signatureRole).toBe("client");
  });

  it("parses a snapshot that includes multi-page geometry", () => {
    const parsed = parseFieldsSchemaSnapshot(geometryFields);

    expect(parsed).toHaveLength(3);
    expect(parsed?.[0]?.pageNumber).toBe(1);
    expect(parsed?.[1]?.pageNumber).toBe(2);
    expect(parsed?.[1]?.pageWidth).toBe(612);
    expect(parsed?.[1]?.pageHeight).toBe(792);
    expect(parsed?.[2]?.fieldType).toBe("signature_area");
  });

  it("freezes and parses organization signature roles", () => {
    const snapshot = toFieldsSchemaSnapshot([
      {
        pdfFieldName: "OrgSig",
        valueKey: "org_signature",
        fieldType: "signature_area",
        isRequired: true,
        sortOrder: 1,
        pageNumber: 1,
        signatureRole: "organization",
      },
      {
        pdfFieldName: "ClientSig",
        valueKey: "client_signature",
        fieldType: "signature_area",
        isRequired: true,
        sortOrder: 2,
        pageNumber: 1,
        signatureRole: "client",
      },
    ]);

    expect(snapshot.map((field) => field.signatureRole)).toEqual([
      "organization",
      "client",
    ]);
    expect(hasOrganizationSignatureFields(snapshot)).toBe(true);

    const parsed = parseFieldsSchemaSnapshot(snapshot);
    expect(parsed?.[0]?.signatureRole).toBe("organization");
  });

  it("rejects a tampered stored snapshot", () => {
    expect(parseFieldsSchemaSnapshot([{ valueKey: "x" }])).toBeNull();
  });
});

describe("resolveSignatureRole", () => {
  it("treats null and undefined as client", () => {
    expect(resolveSignatureRole(null)).toBe("client");
    expect(resolveSignatureRole(undefined)).toBe("client");
    expect(resolveSignatureRole("client")).toBe("client");
    expect(resolveSignatureRole("organization")).toBe("organization");
  });
});
