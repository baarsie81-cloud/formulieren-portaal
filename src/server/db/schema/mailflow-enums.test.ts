import { describe, expect, it } from "vitest";
import {
  DOCUMENT_CATEGORIES,
  EMAIL_KINDS,
  ORGANIZATION_EMAIL_TEMPLATE_KINDS,
} from "@/lib/constants";
import {
  documentCategoryEnum,
  emailKindEnum,
  organizationEmailTemplateKindEnum,
} from "@/server/db/schema/enums";

describe("mailflow schema enums", () => {
  it("keeps document_category aligned with Drizzle enum", () => {
    expect(documentCategoryEnum.enumValues).toEqual([...DOCUMENT_CATEGORIES]);
  });

  it("keeps organization_email_template_kind aligned with Drizzle enum", () => {
    expect(organizationEmailTemplateKindEnum.enumValues).toEqual([
      ...ORGANIZATION_EMAIL_TEMPLATE_KINDS,
    ]);
  });

  it("keeps email_kind aligned with Drizzle enum", () => {
    expect(emailKindEnum.enumValues).toEqual([...EMAIL_KINDS]);
  });
});
