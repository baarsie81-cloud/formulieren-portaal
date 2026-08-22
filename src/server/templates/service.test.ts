import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { writeUserAuditEvent, extractPdfFields } = vi.hoisted(() => ({
  writeUserAuditEvent: vi.fn(),
  extractPdfFields: vi.fn(),
}));

vi.mock("@/server/audit/log", () => ({ writeUserAuditEvent }));
vi.mock("@/server/pdf/fields", () => ({ extractPdfFields }));

import type { TenantContext } from "@/server/auth/tenant";
import { getDb } from "@/server/db";
import { deletePrivatePdf, putPrivatePdf } from "@/server/storage/blob";
import {
  archiveTemplate,
  createTemplate,
  deleteTemplate,
  NO_ACROFORM_FIELDS_MESSAGE,
  restoreTemplate,
  TEMPLATE_HAS_FORM_DOCUMENTS_MESSAGE,
  TEMPLATE_NOT_ARCHIVED_MESSAGE,
  updateTemplateMetadata,
} from "@/server/templates/service";
import { PERMANENT_DELETE_CONFIRMATION } from "@/server/templates/schema";

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

const otherOrganizationId = "33333333-3333-4333-8333-333333333333";

const extractedField = {
  pdfFieldName: "client_name",
  valueKey: "client_name",
  fieldType: "text" as const,
  pageNumber: 1,
  x: 10,
  y: 20,
  width: 100,
  height: 20,
  pageWidth: 595,
  pageHeight: 842,
  isRequired: true,
};

describe("createTemplate", () => {
  beforeEach(() => {
    vi.mocked(putPrivatePdf).mockReset();
    vi.mocked(putPrivatePdf).mockResolvedValue(undefined as never);
    extractPdfFields.mockReset();
    writeUserAuditEvent.mockReset();
    vi.mocked(getDb).mockReset();
  });

  it("rejects PDFs without AcroForm fields before blob upload", async () => {
    extractPdfFields.mockResolvedValue({ pageCount: 1, fields: [] });

    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();

    await expect(
      createTemplate(
        tenant,
        { name: "Leeg formulier", description: null, category: "intake" },
        bytes,
      ),
    ).rejects.toMatchObject({
      name: "ValidationError",
      message: NO_ACROFORM_FIELDS_MESSAGE,
    });

    expect(putPrivatePdf).not.toHaveBeenCalled();
  });

  it("persists category and organization id on create", async () => {
    extractPdfFields.mockResolvedValue({
      pageCount: 1,
      fields: [extractedField],
    });

    const templateRow = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organizationId: tenant.organizationId,
      name: "Contractformulier",
      description: null,
      category: "contract" as const,
      status: "active" as const,
    };

    const values = vi.fn((payload: unknown) => {
      if (Array.isArray(payload)) {
        return Promise.resolve();
      }

      return {
        returning: vi.fn().mockResolvedValue([templateRow]),
      };
    });
    const insert = vi.fn().mockReturnValue({ values });
    const transaction = vi.fn(async (callback: (tx: { insert: typeof insert }) => unknown) =>
      callback({ insert }),
    );

    vi.mocked(getDb).mockReturnValue({ transaction } as never);

    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();

    const template = await createTemplate(
      tenant,
      {
        name: "Contractformulier",
        description: null,
        category: "contract",
      },
      bytes,
    );

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: tenant.organizationId,
        name: "Contractformulier",
        category: "contract",
      }),
    );
    expect(values.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        organizationId: tenant.organizationId,
      }),
    );
    expect(
      (values.mock.calls[0]?.[0] as { organizationId: string }).organizationId,
    ).not.toBe(otherOrganizationId);
    expect(template.category).toBe("contract");
    expect(writeUserAuditEvent).toHaveBeenCalled();
  });
});

describe("updateTemplateMetadata", () => {
  beforeEach(() => {
    writeUserAuditEvent.mockReset();
    vi.mocked(getDb).mockReset();
  });

  it("updates category within the tenant organization scope", async () => {
    const existing = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      organizationId: tenant.organizationId,
      name: "Formulier",
      description: null,
      category: "intake" as const,
      status: "active" as const,
    };

    const selectLimit = vi.fn().mockResolvedValue([existing]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    const returning = vi.fn().mockResolvedValue([
      {
        ...existing,
        category: "contract",
      },
    ]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const transaction = vi.fn(async (callback: (tx: { update: typeof update }) => unknown) =>
      callback({ update }),
    );

    vi.mocked(getDb).mockReturnValue({ select, transaction } as never);

    const updated = await updateTemplateMetadata(tenant, existing.id, {
      name: "Formulier",
      description: null,
      category: "contract",
    });

    expect(set).toHaveBeenCalledWith({
      name: "Formulier",
      description: null,
      category: "contract",
    });
    expect(where).toHaveBeenCalled();
    expect(updated.category).toBe("contract");
    expect(writeUserAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenant,
        metadata: { changedFields: ["category"] },
      }),
    );
  });

  it("does not find templates outside the organization scope", async () => {
    const selectLimit = vi.fn().mockResolvedValue([]);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    vi.mocked(getDb).mockReturnValue({ select } as never);

    await expect(
      updateTemplateMetadata(tenant, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", {
        name: "Formulier",
        description: null,
        category: "contract",
      }),
    ).rejects.toMatchObject({
      name: "NotFoundError",
    });

    expect(selectWhere).toHaveBeenCalled();
  });
});

const templateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const blobKey = "org/11111111-1111-4111-8111-111111111111/templates/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf";

const activeTemplate = {
  id: templateId,
  organizationId: tenant.organizationId,
  name: "Intake",
  description: null,
  category: "intake" as const,
  status: "active" as const,
  blobKey,
  sha256: "abc123",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const archivedTemplate = {
  ...activeTemplate,
  status: "archived" as const,
};

function mockSelectRows(rows: unknown[]) {
  const whereResult = {
    limit: vi.fn().mockResolvedValue(rows),
    then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };

  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(whereResult),
    }),
  };
}

describe("template lifecycle", () => {
  beforeEach(() => {
    writeUserAuditEvent.mockReset();
    vi.mocked(getDb).mockReset();
    vi.mocked(deletePrivatePdf).mockReset();
    vi.mocked(deletePrivatePdf).mockResolvedValue(undefined as never);
  });

  describe.each([
    ["admin", { ...tenant, role: "admin" as const }],
    ["member", { ...tenant, role: "member" as const }],
  ])("as %s", (_label, actor) => {
    it("archives an active template", async () => {
      const returning = vi.fn().mockResolvedValue([archivedTemplate]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      const update = vi.fn().mockReturnValue({ set });

      vi.mocked(getDb)
        .mockReturnValueOnce({ select: vi.fn(() => mockSelectRows([activeTemplate])) } as never)
        .mockReturnValueOnce({
          transaction: vi.fn(async (cb: (tx: { update: typeof update }) => unknown) =>
            cb({ update }),
          ),
        } as never);

      const result = await archiveTemplate(actor, templateId);

      expect(result.status).toBe("archived");
      expect(writeUserAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "template.archived",
          entityId: templateId,
        }),
      );
    });

    it("restores an archived template", async () => {
      const returning = vi.fn().mockResolvedValue([activeTemplate]);
      const where = vi.fn().mockReturnValue({ returning });
      const set = vi.fn().mockReturnValue({ where });
      const update = vi.fn().mockReturnValue({ set });

      vi.mocked(getDb)
        .mockReturnValueOnce({
          select: vi.fn(() => mockSelectRows([archivedTemplate])),
        } as never)
        .mockReturnValueOnce({
          transaction: vi.fn(async (cb: (tx: { update: typeof update }) => unknown) =>
            cb({ update }),
          ),
        } as never);

      const result = await restoreTemplate(actor, templateId);

      expect(result.status).toBe("active");
      expect(writeUserAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "template.restored",
          entityId: templateId,
        }),
      );
    });

    it("permanently deletes an archived template without form documents", async () => {
      const del = vi
        .fn()
        .mockReturnValueOnce({
          where: vi.fn().mockResolvedValue(undefined),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: templateId }]),
          }),
        });

      vi.mocked(getDb)
        .mockReturnValueOnce({
          select: vi.fn(() => mockSelectRows([archivedTemplate])),
        } as never)
        .mockReturnValueOnce({
          select: vi.fn(() => mockSelectRows([{ value: 0 }])),
        } as never)
        .mockReturnValueOnce({
          transaction: vi.fn(async (cb: (tx: { delete: typeof del }) => unknown) =>
            cb({ delete: del }),
          ),
        } as never);

      const result = await deleteTemplate(
        actor,
        templateId,
        PERMANENT_DELETE_CONFIRMATION,
      );

      expect(result).toEqual({ id: templateId });
      expect(writeUserAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: "template.deleted",
          entityId: templateId,
        }),
      );
      expect(deletePrivatePdf).toHaveBeenCalledWith(blobKey);
    });
  });

  it("blocks permanent delete when form documents exist", async () => {
    vi.mocked(getDb)
      .mockReturnValueOnce({
        select: vi.fn(() => mockSelectRows([archivedTemplate])),
      } as never)
      .mockReturnValueOnce({
        select: vi.fn(() => mockSelectRows([{ value: 1 }])),
      } as never);

    await expect(
      deleteTemplate(tenant, templateId, PERMANENT_DELETE_CONFIRMATION),
    ).rejects.toMatchObject({
      name: "ConflictError",
      message: TEMPLATE_HAS_FORM_DOCUMENTS_MESSAGE,
    });

    expect(deletePrivatePdf).not.toHaveBeenCalled();
  });

  it("blocks permanent delete of an active template", async () => {
    vi.mocked(getDb).mockReturnValueOnce({
      select: vi.fn(() => mockSelectRows([activeTemplate])),
    } as never);

    await expect(
      deleteTemplate(tenant, templateId, PERMANENT_DELETE_CONFIRMATION),
    ).rejects.toMatchObject({
      name: "ConflictError",
      message: TEMPLATE_NOT_ARCHIVED_MESSAGE,
    });
  });

  it("blocks permanent delete with wrong confirmation", async () => {
    await expect(deleteTemplate(tenant, templateId, "verwijderen")).rejects.toMatchObject({
      name: "ValidationError",
    });

    expect(getDb).not.toHaveBeenCalled();
  });

  it("blocks access for a template outside the organization", async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => mockSelectRows([])),
    } as never);

    await expect(archiveTemplate(tenant, templateId)).rejects.toMatchObject({
      name: "NotFoundError",
    });
    await expect(restoreTemplate(tenant, templateId)).rejects.toMatchObject({
      name: "NotFoundError",
    });
    await expect(
      deleteTemplate(tenant, templateId, PERMANENT_DELETE_CONFIRMATION),
    ).rejects.toMatchObject({
      name: "NotFoundError",
    });

    expect(tenant.organizationId).not.toBe(otherOrganizationId);
  });
});
