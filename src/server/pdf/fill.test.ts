import { PDFDocument, PDFCheckBox, PDFTextField } from "pdf-lib";
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
});
