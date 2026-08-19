import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import { fillAcroForm } from "@/server/pdf/fill";

describe("fillAcroForm", () => {
  it("writes values into existing AcroForm fields and skips signature areas", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const form = pdf.getForm();

    form.createTextField("client_name").addToPage(page, {
      x: 50,
      y: 700,
      width: 200,
      height: 20,
    });
    form.createCheckBox("consent").addToPage(page, {
      x: 50,
      y: 300,
      width: 12,
      height: 12,
    });

    const filled = await fillAcroForm(
      await pdf.save(),
      [
        { pdfFieldName: "client_name", valueKey: "client_name", fieldType: "text" },
        { pdfFieldName: "consent", valueKey: "consent", fieldType: "checkbox" },
        { pdfFieldName: "Signature1", valueKey: "signature1", fieldType: "signature_area" },
      ],
      {
        client_name: "Ada Berg",
        consent: true,
        signature1: "should-not-be-written",
      },
    );

    const filledPdf = await PDFDocument.load(filled);
    const filledForm = filledPdf.getForm();
    const name = filledForm.getField("client_name");
    const consent = filledForm.getField("consent");

    expect(name).toBeInstanceOf(PDFTextField);
    expect(consent).toBeInstanceOf(PDFCheckBox);
    expect((name as PDFTextField).getText()).toBe("Ada Berg");
    expect((consent as PDFCheckBox).isChecked()).toBe(true);
  });

  it("fills a dropdown when the value matches an existing option", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const form = pdf.getForm();
    const dropdown = form.createDropdown("contract_type");
    dropdown.addOptions(["Arbeidsovereenkomst", "Freelance"]);
    dropdown.addToPage(page, { x: 50, y: 700, width: 200, height: 20 });

    const filled = await fillAcroForm(
      await pdf.save(),
      [{ pdfFieldName: "contract_type", valueKey: "contract_type", fieldType: "text" }],
      { contract_type: "Freelance" },
    );

    const filledPdf = await PDFDocument.load(filled);
    const field = filledPdf.getForm().getField("contract_type");

    expect(field).toBeInstanceOf(PDFDropdown);
    expect((field as PDFDropdown).getSelected()).toEqual(["Freelance"]);
  });

  it("fills an option list when the value matches an existing option", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const form = pdf.getForm();
    const optionList = form.createOptionList("start_location");
    optionList.addOptions(["Utrecht", "Amsterdam"]);
    optionList.addToPage(page, { x: 50, y: 700, width: 200, height: 40 });

    const filled = await fillAcroForm(
      await pdf.save(),
      [{ pdfFieldName: "start_location", valueKey: "start_location", fieldType: "text" }],
      { start_location: "Amsterdam" },
    );

    const filledPdf = await PDFDocument.load(filled);
    const field = filledPdf.getForm().getField("start_location");

    expect(field).toBeInstanceOf(PDFOptionList);
    expect((field as PDFOptionList).getSelected()).toEqual(["Amsterdam"]);
  });

  it("fills a radio group when the value matches an existing option", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const form = pdf.getForm();
    const radio = form.createRadioGroup("payment_term");
    radio.addOptionToPage("Maandelijks", page, {
      x: 50,
      y: 700,
      width: 12,
      height: 12,
    });
    radio.addOptionToPage("Per kwartaal", page, {
      x: 50,
      y: 670,
      width: 12,
      height: 12,
    });

    const filled = await fillAcroForm(
      await pdf.save(),
      [{ pdfFieldName: "payment_term", valueKey: "payment_term", fieldType: "text" }],
      { payment_term: "Per kwartaal" },
    );

    const filledPdf = await PDFDocument.load(filled);
    const field = filledPdf.getForm().getField("payment_term");

    expect(field).toBeInstanceOf(PDFRadioGroup);
    expect((field as PDFRadioGroup).getSelected()).toBe("Per kwartaal");
  });

  it("keeps existing text field behavior unchanged", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const form = pdf.getForm();
    form.createTextField("notes").addToPage(page, {
      x: 50,
      y: 700,
      width: 200,
      height: 20,
    });

    const filled = await fillAcroForm(
      await pdf.save(),
      [{ pdfFieldName: "notes", valueKey: "notes", fieldType: "text" }],
      { notes: "Bestaand gedrag blijft werken" },
    );

    const filledPdf = await PDFDocument.load(filled);
    const field = filledPdf.getForm().getField("notes");

    expect(field).toBeInstanceOf(PDFTextField);
    expect((field as PDFTextField).getText()).toBe("Bestaand gedrag blijft werken");
  });
});
