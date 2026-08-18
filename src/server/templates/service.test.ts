import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { TenantContext } from "@/server/auth/tenant";
import { putPrivatePdf } from "@/server/storage/blob";
import { createTemplate, NO_ACROFORM_FIELDS_MESSAGE } from "@/server/templates/service";

vi.mock("@/server/storage/blob", () => ({
  putPrivatePdf: vi.fn(),
  deletePrivatePdf: vi.fn(),
  getPrivatePdfBytes: vi.fn(),
  assertPdfSha256: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  getDb: vi.fn(),
}));

const tenant: TenantContext = {
  clerkUserId: "user_clerk",
  clerkOrganizationId: "org_clerk",
  role: "admin",
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationName: "Praktijk",
  userId: "22222222-2222-4222-8222-222222222222",
  userDisplayName: "Jan",
};

describe("createTemplate", () => {
  beforeEach(() => {
    vi.mocked(putPrivatePdf).mockReset();
  });

  it("rejects PDFs without AcroForm fields before blob upload", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();

    await expect(
      createTemplate(tenant, { name: "Leeg formulier", description: null }, bytes),
    ).rejects.toMatchObject({
      name: "ValidationError",
      message: NO_ACROFORM_FIELDS_MESSAGE,
    });

    expect(putPrivatePdf).not.toHaveBeenCalled();
  });
});
