import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const writeUserAuditEvent = vi.fn();
vi.mock("@/server/audit/log", () => ({ writeUserAuditEvent }));

const getDefaultEmailTemplate = vi.fn();
vi.mock("@/server/email/templates", () => ({
  getDefaultEmailTemplate,
}));

const insert = vi.fn();
const select = vi.fn();
const deleteFn = vi.fn();
const transaction = vi.fn();

vi.mock("@/server/db", () => ({
  getDb: vi.fn(() => ({
    select,
    insert,
    delete: deleteFn,
    transaction,
  })),
}));

const {
  listOrganizationEmailTemplates,
  resetOrganizationEmailTemplate,
  upsertOrganizationEmailTemplate,
} = await import("@/server/email-templates/service");
const { NotFoundError } = await import("@/server/errors");

const tenant = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationName: "Praktijk De Linde",
  userId: "33333333-3333-4333-8333-333333333333",
  clerkOrganizationId: "org_demo",
  clerkUserId: "user_demo",
  userDisplayName: "Demo User",
  role: "admin" as const,
};

describe("listOrganizationEmailTemplates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDefaultEmailTemplate.mockImplementation((kind: string) => ({
      subjectTemplate: `Default subject ${kind}`,
      bodyTemplate: `Default body ${kind}`,
    }));
  });

  it("merges database rows with defaults for all four kinds", async () => {
    select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: "tmpl-1",
            kind: "intake_invitation",
            subjectTemplate: "Custom subject",
            bodyTemplate: "Custom body",
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ]),
      }),
    });

    const templates = await listOrganizationEmailTemplates(tenant);

    expect(templates).toHaveLength(4);
    expect(templates[0]).toMatchObject({
      kind: "intake_invitation",
      subjectTemplate: "Custom subject",
      bodyTemplate: "Custom body",
      isCustomized: true,
      id: "tmpl-1",
    });
    expect(templates[1]).toMatchObject({
      kind: "contract_invitation",
      subjectTemplate: "Default subject contract_invitation",
      isCustomized: false,
      id: null,
    });
    expect(templates.map((item) => item.kind)).toEqual([
      "intake_invitation",
      "contract_invitation",
      "intake_confirmation",
      "contract_confirmation",
    ]);
  });
});

describe("upsertOrganizationEmailTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts within the tenant organization and writes an audit event", async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: "tmpl-2",
        kind: "intake_confirmation",
        subjectTemplate: "Bevestiging",
        bodyTemplate: "Body",
        updatedAt: new Date("2026-02-01T00:00:00.000Z"),
        organizationId: tenant.organizationId,
      },
    ]);
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    insert.mockReturnValue({ values });

    transaction.mockImplementation(async (callback) =>
      callback({
        insert,
      }),
    );

    const result = await upsertOrganizationEmailTemplate(tenant, {
      kind: "intake_confirmation",
      subjectTemplate: "Bevestiging",
      bodyTemplate: "Body",
    });

    expect(values).toHaveBeenCalledWith({
      organizationId: tenant.organizationId,
      kind: "intake_confirmation",
      subjectTemplate: "Bevestiging",
      bodyTemplate: "Body",
    });
    expect(writeUserAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenant,
        action: "organization.email_template_updated",
        entityType: "organization_email_template",
        entityId: "tmpl-2",
        metadata: { kind: "intake_confirmation" },
      }),
    );
    expect(result.isCustomized).toBe(true);
    expect(result.subjectTemplate).toBe("Bevestiging");
  });
});

describe("resetOrganizationEmailTemplate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDefaultEmailTemplate.mockReturnValue({
      subjectTemplate: "Default subject",
      bodyTemplate: "Default body",
    });
  });

  it("deletes the org-scoped row and returns defaults", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "tmpl-3" }]);
    const where = vi.fn().mockReturnValue({ returning });
    deleteFn.mockReturnValue({ where });

    transaction.mockImplementation(async (callback) =>
      callback({
        delete: deleteFn,
      }),
    );

    const result = await resetOrganizationEmailTemplate(
      tenant,
      "contract_invitation",
    );

    expect(writeUserAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "organization.email_template_reset",
        entityId: "tmpl-3",
        metadata: { kind: "contract_invitation" },
      }),
    );
    expect(result).toMatchObject({
      kind: "contract_invitation",
      subjectTemplate: "Default subject",
      bodyTemplate: "Default body",
      isCustomized: false,
      id: null,
    });
  });

  it("throws NotFoundError when no customized template exists", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    deleteFn.mockReturnValue({ where });

    transaction.mockImplementation(async (callback) =>
      callback({
        delete: deleteFn,
      }),
    );

    await expect(
      resetOrganizationEmailTemplate(tenant, "intake_invitation"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
