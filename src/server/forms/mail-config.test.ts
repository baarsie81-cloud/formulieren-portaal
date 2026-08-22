import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getClient = vi.fn();
vi.mock("@/server/clients/service", () => ({ getClient }));

const getTemplate = vi.fn();
vi.mock("@/server/templates/service", () => ({ getTemplate }));

const resolveOrganizationEmailTemplate = vi.fn();
vi.mock("@/server/email/templates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/email/templates")>();
  return {
    ...actual,
    resolveOrganizationEmailTemplate,
  };
});

const getDb = vi.fn(() => ({}));
vi.mock("@/server/db", () => ({ getDb }));

const {
  buildRequestMailSnapshots,
  loadRequestMailDefaults,
} = await import("@/server/forms/mail-config");
const {
  confirmationTemplateKindForCategory,
  getDefaultEmailTemplate,
  invitationTemplateKindForCategory,
} = await import("@/server/email/templates");

const tenant = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationName: "Praktijk De Linde",
  userId: "33333333-3333-4333-8333-333333333333",
  clerkOrganizationId: "org_demo",
  clerkUserId: "user_demo",
  userDisplayName: "Demo User",
  role: "admin" as const,
};

describe("loadRequestMailDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads intake invitation and confirmation concepts", async () => {
    getClient.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      displayName: "Ada Lovelace",
      archivedAt: null,
    });
    getTemplate.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      status: "active",
      category: "intake",
    });
    resolveOrganizationEmailTemplate.mockImplementation(
      async (_db, _orgId, kind: string) => ({
        kind,
        subjectTemplate: `Subject ${kind}`,
        bodyTemplate: `Body ${kind}`,
      }),
    );

    const defaults = await loadRequestMailDefaults(tenant, {
      clientId: "22222222-2222-4222-8222-222222222222",
      templateId: "44444444-4444-4444-8444-444444444444",
    });

    expect(defaults.documentCategory).toBe("intake");
    expect(defaults.invitationKind).toBe("intake_invitation");
    expect(defaults.confirmationKind).toBe("intake_confirmation");
    expect(defaults.invitationSubject).toBe("Subject intake_invitation");
    expect(defaults.confirmationSubject).toBe("Subject intake_confirmation");
  });

  it("loads contract invitation and confirmation concepts", async () => {
    getClient.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      displayName: "Ada Lovelace",
      archivedAt: null,
    });
    getTemplate.mockResolvedValue({
      id: "44444444-4444-4444-8444-444444444444",
      status: "active",
      category: "contract",
    });
    resolveOrganizationEmailTemplate.mockImplementation(
      async (_db, _orgId, kind: string) => ({
        kind,
        subjectTemplate: getDefaultEmailTemplate(kind as never).subjectTemplate,
        bodyTemplate: getDefaultEmailTemplate(kind as never).bodyTemplate,
      }),
    );

    const defaults = await loadRequestMailDefaults(tenant, {
      clientId: "22222222-2222-4222-8222-222222222222",
      templateId: "44444444-4444-4444-8444-444444444444",
    });

    expect(defaults.documentCategory).toBe("contract");
    expect(defaults.invitationKind).toBe("contract_invitation");
    expect(defaults.confirmationKind).toBe("contract_confirmation");
    expect(defaults.invitationSubject).toContain("Contractformulier");
    expect(defaults.confirmationSubject).toContain("contractondertekening");
  });
});

describe("buildRequestMailSnapshots", () => {
  const baseInput = {
    organizationName: "Praktijk De Linde",
    recipientName: "Ada Lovelace",
    formUrl: "https://formulierendesk.nl/f/token",
    expiresAt: new Date("2026-09-02T10:00:00.000Z"),
  };

  it("stores rendered invitation and confirmation snapshots at request create", () => {
    const snapshots = buildRequestMailSnapshots({
      ...baseInput,
      documentCategory: "intake",
      invitationSubject: "Formulier van {{organizationName}}",
      invitationBody: "Beste {{recipientName}},\n\n{{formUrl}}",
      confirmationSubject: "Bevestiging — {{organizationName}}",
      confirmationBody: "Beste {{recipientName}}, bedankt.",
    });

    expect(snapshots.confirmationKind).toBe("intake_confirmation");
    expect(snapshots.invitationSubjectSnapshot).toBe("Formulier van Praktijk De Linde");
    expect(snapshots.invitationBodySnapshot).toContain("Ada Lovelace");
    expect(snapshots.invitationBodySnapshot).toContain("https://formulierendesk.nl/f/token");
    expect(snapshots.confirmationSubjectSnapshot).toBe(
      "Bevestiging — Praktijk De Linde",
    );
    expect(snapshots.confirmationBodySnapshot).toContain("Ada Lovelace");
  });

  it("keeps request snapshots unchanged when org templates change later", () => {
    const original = buildRequestMailSnapshots({
      ...baseInput,
      documentCategory: "intake",
      invitationSubject: "Oud onderwerp",
      invitationBody: "Oude uitnodiging",
      confirmationSubject: "Oude bevestiging",
      confirmationBody: "Oude tekst",
    });

    const changedDefaults = buildRequestMailSnapshots({
      ...baseInput,
      documentCategory: "intake",
      invitationSubject: getDefaultEmailTemplate("intake_invitation").subjectTemplate,
      invitationBody: getDefaultEmailTemplate("intake_invitation").bodyTemplate,
      confirmationSubject: getDefaultEmailTemplate("intake_confirmation").subjectTemplate,
      confirmationBody: getDefaultEmailTemplate("intake_confirmation").bodyTemplate,
    });

    expect(original.invitationSubjectSnapshot).toBe("Oud onderwerp");
    expect(original.confirmationBodySnapshot).toBe("Oude tekst");
    expect(changedDefaults.invitationSubjectSnapshot).not.toBe(
      original.invitationSubjectSnapshot,
    );
  });

  it("maps the four template kinds for intake and contract", () => {
    expect(invitationTemplateKindForCategory("intake")).toBe("intake_invitation");
    expect(confirmationTemplateKindForCategory("intake")).toBe("intake_confirmation");
    expect(invitationTemplateKindForCategory("contract")).toBe("contract_invitation");
    expect(confirmationTemplateKindForCategory("contract")).toBe("contract_confirmation");

    const contractSnapshots = buildRequestMailSnapshots({
      ...baseInput,
      documentCategory: "contract",
      invitationSubject: getDefaultEmailTemplate("contract_invitation").subjectTemplate,
      invitationBody: getDefaultEmailTemplate("contract_invitation").bodyTemplate,
      confirmationSubject: getDefaultEmailTemplate("contract_confirmation").subjectTemplate,
      confirmationBody: getDefaultEmailTemplate("contract_confirmation").bodyTemplate,
    });

    expect(contractSnapshots.confirmationKind).toBe("contract_confirmation");
    expect(contractSnapshots.invitationSubjectSnapshot).toContain("Contractformulier");
  });
});
