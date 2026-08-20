import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  extractPdfFields,
  extractPdfPageSizes,
  toValueKey,
} from "@/server/pdf/fields";

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
    const { width: pageWidth, height: pageHeight } = page.getSize();

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
      pageWidth,
      pageHeight,
    });
    expect(extracted.fields[1]?.fieldType).toBe("textarea");
    expect(extracted.fields[2]?.fieldType).toBe("checkbox");
    expect(extracted.fields[0]?.width).toBeGreaterThan(0);
    expect(extracted.fields[0]?.height).toBeGreaterThan(0);
    expect(extracted.fields[0]?.x).not.toBeNull();
    expect(extracted.fields[0]?.y).not.toBeNull();
  });

  it("captures geometry and page sizes across multiple pages", async () => {
    const pdf = await PDFDocument.create();
    const page1 = pdf.addPage([595.28, 841.89]);
    const page2 = pdf.addPage([612, 792]);
    const form = pdf.getForm();

    form.createTextField("name_p1").addToPage(page1, {
      x: 50,
      y: 700,
      width: 200,
      height: 20,
    });
    form.createTextField("city_p2").addToPage(page2, {
      x: 40,
      y: 500,
      width: 180,
      height: 24,
    });

    const extracted = await extractPdfFields(await pdf.save());

    expect(extracted.pageCount).toBe(2);
    expect(extracted.fields).toHaveLength(2);
    expect(extracted.fields[0]).toMatchObject({
      pdfFieldName: "name_p1",
      pageNumber: 1,
      pageWidth: 595.28,
      pageHeight: 841.89,
    });
    expect(extracted.fields[0]?.x).not.toBeNull();
    expect(extracted.fields[0]?.y).not.toBeNull();
    expect(extracted.fields[0]?.width).toBeGreaterThan(0);
    expect(extracted.fields[0]?.height).toBeGreaterThan(0);
    expect(extracted.fields[1]).toMatchObject({
      pdfFieldName: "city_p2",
      pageNumber: 2,
      pageWidth: 612,
      pageHeight: 792,
    });
    expect(extracted.fields[1]?.x).not.toBeNull();
    expect(extracted.fields[1]?.y).not.toBeNull();
    expect(extracted.fields[1]?.width).toBeGreaterThan(0);
    expect(extracted.fields[1]?.height).toBeGreaterThan(0);
  });

  it("returns no fields for a PDF without a form", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const extracted = await extractPdfFields(await pdf.save());

    expect(extracted.pageCount).toBe(1);
    expect(extracted.fields).toEqual([]);
  });
});

describe("extractPdfPageSizes", () => {
  it("returns one size entry per page", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595.28, 841.89]);
    pdf.addPage([612, 792]);

    const sizes = await extractPdfPageSizes(await pdf.save());

    expect(sizes).toEqual([
      { pageNumber: 1, width: 595.28, height: 841.89 },
      { pageNumber: 2, width: 612, height: 792 },
    ]);
  });
});
