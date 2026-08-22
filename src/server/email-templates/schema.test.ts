import { describe, expect, it } from "vitest";
import {
  parseOrganizationEmailTemplateKind,
  parseUpsertOrganizationEmailTemplate,
  placeholdersForKind,
  readOrganizationEmailTemplateFormFields,
} from "@/server/email-templates/schema";

describe("parseUpsertOrganizationEmailTemplate", () => {
  it("accepts a valid invitation template", () => {
    expect(
      parseUpsertOrganizationEmailTemplate({
        kind: "intake_invitation",
        subjectTemplate: "  Formulier van {{organizationName}}  ",
        bodyTemplate: "Beste {{recipientName}},\n\n{{formUrl}}",
      }),
    ).toEqual({
      success: true,
      data: {
        kind: "intake_invitation",
        subjectTemplate: "Formulier van {{organizationName}}",
        bodyTemplate: "Beste {{recipientName}},\n\n{{formUrl}}",
      },
    });
  });

  it("rejects empty subject and body", () => {
    expect(
      parseUpsertOrganizationEmailTemplate({
        kind: "intake_confirmation",
        subjectTemplate: "   ",
        bodyTemplate: "Tekst",
      }),
    ).toEqual({
      success: false,
      error: "Vul een onderwerp in (maximaal 200 tekens).",
    });

    expect(
      parseUpsertOrganizationEmailTemplate({
        kind: "intake_confirmation",
        subjectTemplate: "Onderwerp",
        bodyTemplate: "   ",
      }),
    ).toEqual({
      success: false,
      error: "Vul een berichttekst in.",
    });
  });

  it("rejects unknown kind", () => {
    expect(
      parseUpsertOrganizationEmailTemplate({
        kind: "unknown_kind",
        subjectTemplate: "Onderwerp",
        bodyTemplate: "Tekst",
      }),
    ).toEqual({
      success: false,
      error: "Onbekend e-mailsjabloon.",
    });
  });

  it("rejects subject longer than 200 characters", () => {
    expect(
      parseUpsertOrganizationEmailTemplate({
        kind: "contract_invitation",
        subjectTemplate: "x".repeat(201),
        bodyTemplate: "Tekst",
      }),
    ).toEqual({
      success: false,
      error: "Vul een onderwerp in (maximaal 200 tekens).",
    });
  });
});

describe("parseOrganizationEmailTemplateKind", () => {
  it("accepts known kinds and rejects others", () => {
    expect(parseOrganizationEmailTemplateKind("contract_confirmation")).toBe(
      "contract_confirmation",
    );
    expect(parseOrganizationEmailTemplateKind("nope")).toBeNull();
    expect(parseOrganizationEmailTemplateKind(null)).toBeNull();
  });
});

describe("readOrganizationEmailTemplateFormFields", () => {
  it("reads form fields as strings", () => {
    const formData = new FormData();
    formData.set("kind", "intake_invitation");
    formData.set("subjectTemplate", "Onderwerp");
    formData.set("bodyTemplate", "Body");

    expect(readOrganizationEmailTemplateFormFields(formData)).toEqual({
      kind: "intake_invitation",
      subjectTemplate: "Onderwerp",
      bodyTemplate: "Body",
    });
  });
});

describe("placeholdersForKind", () => {
  it("returns invitation placeholders for invitation kinds", () => {
    expect(placeholdersForKind("intake_invitation")).toEqual([
      "organizationName",
      "recipientName",
      "formUrl",
      "expiresAt",
      "ttlDays",
    ]);
    expect(placeholdersForKind("contract_invitation")).toEqual([
      "organizationName",
      "recipientName",
      "formUrl",
      "expiresAt",
      "ttlDays",
    ]);
  });

  it("returns confirmation placeholders for confirmation kinds", () => {
    expect(placeholdersForKind("intake_confirmation")).toEqual([
      "organizationName",
      "recipientName",
    ]);
    expect(placeholdersForKind("contract_confirmation")).toEqual([
      "organizationName",
      "recipientName",
    ]);
  });
});
