import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { extractPdfFields, toValueKey } from "@/server/pdf/fields";

describe("toValueKey", () => {
  it("slugifies PDF field names into stable keys", () => {
    expect(toValueKey("topmostSubform[0].Page1[0].Naam[0]")).toBe(
      "topmostsubform_0_page1_0_naam_0",
    );
    expect(toValueKey("  ")).toBe("field");
    expect(toValueKey("12naam")).toBe("field_12naam");
  });
});

describe("extractPdfFields", () => {
  it("maps existing AcroForm fields and does not invent fields", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const form = pdf.getForm();

    const name = form.createTextField("client_name");
    name.addToPage(page, { x: 50, y: 700, width: 200, height: 20 });
    name.enableRequired();

    const notes = form.createTextField("notes");
    notes.enableMultiline();
    notes.addToPage(page, { x: 50, y: 400, width: 300, height: 80 });

    const consent = form.createCheckBox("consent");
    consent.addToPage(page, { x: 50, y: 300, width: 12, height: 12 });

    form.createButton("print").addToPage("Print", page, {
      x: 50,
      y: 50,
      width: 80,
      height: 20,
    });

    const bytes = await pdf.save();
    const extracted = await extractPdfFields(bytes);

    expect(extracted.pageCount).toBe(1);
    expect(extracted.fields.map((field) => field.pdfFieldName)).toEqual([
      "client_name",
      "notes",
      "consent",
    ]);
    expect(extracted.fields[0]).toMatchObject({
      valueKey: "client_name",
      fieldType: "text",
      isRequired: true,
      pageNumber: 1,
    });
    expect(extracted.fields[1]?.fieldType).toBe("textarea");
    expect(extracted.fields[2]?.fieldType).toBe("checkbox");
    expect(extracted.fields[0]?.width).toBeGreaterThan(0);
    expect(extracted.fields[0]?.height).toBeGreaterThan(0);
    expect(extracted.fields[0]?.x).not.toBeNull();
    expect(extracted.fields[0]?.y).not.toBeNull();
  });

  it("returns no fields for a PDF without a form", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const extracted = await extractPdfFields(await pdf.save());

    expect(extracted.pageCount).toBe(1);
    expect(extracted.fields).toEqual([]);
  });
});
