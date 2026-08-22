import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/server/db";

vi.mock("server-only", () => ({}));

const sendEmail = vi.fn();
const isEmailConfigured = vi.fn();
vi.mock("@/server/email/send", () => ({
  sendEmail,
  isEmailConfigured,
}));

const resolveOrganizationEmailTemplate = vi.fn();
const renderedEmailFromSnapshot = vi.fn();
vi.mock("@/server/email/templates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/email/templates")>();
  return {
    ...actual,
    resolveOrganizationEmailTemplate,
    renderedEmailFromSnapshot,
  };
});

const {
  buildFormRequestInvitationEmail,
  sendFormRequestInvitation,
} = await import("@/server/email/invitation");

const {
  confirmationTemplateKindForCategory,
  invitationTemplateKindForCategory,
} = await import("@/server/email/templates");

const {
  sendFormCompletionClientEmail,
  sendFormCompletionNotifications,
} = await import("@/server/email/confirmation");

const invitationInput = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationName: "Praktijk De Linde",
  recipientEmail: "client@example.com",
  recipientName: "Ada Lovelace",
  formRequestId: "22222222-2222-4222-8222-222222222222",
  formUrl: "https://formulierendesk.nl/f/abc123token",
  expiresAt: new Date("2026-09-02T10:00:00.000Z"),
  documentCategory: "intake" as const,
};

function createInvitationDb(requestRow: {
  invitationSubjectSnapshot?: string | null;
  invitationBodySnapshot?: string | null;
  invitationSentAt?: Date | null;
}) {
  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  }));

  return {
    db: {
      insert: vi.fn(),
      update,
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([requestRow]),
          })),
        })),
      })),
    } as unknown as Pick<Database, "insert" | "update" | "select">,
    update,
  };
}

function createConfirmationDb() {
  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    })),
  }));

  return {
    db: {
      insert: vi.fn(),
      update,
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ email: "staff@praktijk.nl" }]),
          })),
        })),
      })),
    } as unknown as Pick<Database, "insert" | "update" | "select">,
    update,
  };
}

describe("buildFormRequestInvitationEmail", () => {
  it("builds Dutch invitation content with organization name and secure link", () => {
    const content = buildFormRequestInvitationEmail(invitationInput);

    expect(content.subject).toBe("Formulier van Praktijk De Linde");
    expect(content.text).toContain("Praktijk De Linde");
    expect(content.text).toContain("https://formulierendesk.nl/f/abc123token");
    expect(content.text).toContain("14 dagen geldig");
    expect(content.html).toContain("Formulier openen");
    expect(content.html).toContain("https://formulierendesk.nl/f/abc123token");
  });

  it("uses contract defaults for contract requests", () => {
    const content = buildFormRequestInvitationEmail({
      ...invitationInput,
      documentCategory: "contract",
    });

    expect(content.subject).toBe("Contractformulier van Praktijk De Linde");
    expect(content.text).toContain("contractformulier");
  });
});

describe("mailflow template kinds", () => {
  it("maps intake and contract categories to the correct template kinds", () => {
    expect(invitationTemplateKindForCategory("intake")).toBe("intake_invitation");
    expect(invitationTemplateKindForCategory("contract")).toBe("contract_invitation");
    expect(confirmationTemplateKindForCategory("intake")).toBe("intake_confirmation");
    expect(confirmationTemplateKindForCategory("contract")).toBe("contract_confirmation");
  });

  it("loads organization templates by kind", async () => {
    const { resolveOrganizationEmailTemplate: resolveActual } =
      await vi.importActual<typeof import("@/server/email/templates")>(
        "@/server/email/templates",
      );

    const select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([
            {
              subjectTemplate: "Contract {{organizationName}}",
              bodyTemplate: "Beste {{recipientName}}",
            },
          ]),
        })),
      })),
    }));
    const db = { select } as unknown as Pick<Database, "select">;

    const template = await resolveActual(
      db,
      invitationInput.organizationId,
      "contract_invitation",
    );

    expect(template.kind).toBe("contract_invitation");
    expect(template.subjectTemplate).toBe("Contract {{organizationName}}");
  });
});

describe("sendFormRequestInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue({ messageId: "msg_invite" });
    resolveOrganizationEmailTemplate.mockResolvedValue({
      kind: "intake_invitation",
      subjectTemplate: "Nieuw {{organizationName}}",
      bodyTemplate: "Hallo {{recipientName}} {{formUrl}}",
    });
    renderedEmailFromSnapshot.mockReturnValue({
      subject: "Opgeslagen onderwerp",
      text: "Opgeslagen body",
      html: "<p>Opgeslagen body</p>",
    });
  });

  it("skips sending when email is not configured", async () => {
    isEmailConfigured.mockReturnValue(false);
    const { db } = createInvitationDb({});

    const result = await sendFormRequestInvitation(db, invitationInput);

    expect(result).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("persists snapshots and sends exclusively from rendered content", async () => {
    const { db, update } = createInvitationDb({});

    await sendFormRequestInvitation(db, invitationInput);

    expect(resolveOrganizationEmailTemplate).toHaveBeenCalledWith(
      db,
      invitationInput.organizationId,
      "intake_invitation",
    );
    expect(update).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(db, {
      organizationId: invitationInput.organizationId,
      to: "client@example.com",
      subject: "Nieuw Praktijk De Linde",
      html: expect.stringContaining("Hallo Ada Lovelace"),
      text: expect.stringContaining("https://formulierendesk.nl/f/abc123token"),
      formRequestId: invitationInput.formRequestId,
      emailKind: "invitation",
    });
  });

  it("keeps invitation snapshots unchanged when organization templates change", async () => {
    const { db } = createInvitationDb({
      invitationSubjectSnapshot: "Opgeslagen onderwerp",
      invitationBodySnapshot: "Opgeslagen body",
    });

    await sendFormRequestInvitation(db, invitationInput);

    expect(resolveOrganizationEmailTemplate).not.toHaveBeenCalled();
    expect(renderedEmailFromSnapshot).toHaveBeenCalledWith(
      "Opgeslagen onderwerp",
      "Opgeslagen body",
    );
    expect(sendEmail).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        subject: "Opgeslagen onderwerp",
        text: "Opgeslagen body",
        emailKind: "invitation",
      }),
    );
  });
});

describe("sendFormCompletionClientEmail", () => {
  const clientInput = {
    organizationId: invitationInput.organizationId,
    organizationName: invitationInput.organizationName,
    recipientEmail: invitationInput.recipientEmail,
    recipientName: invitationInput.recipientName,
    formRequestId: invitationInput.formRequestId,
    documentCategory: "contract" as const,
    clientConfirmationSentAt: null,
    confirmationSubjectSnapshot: null,
    confirmationBodySnapshot: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue({ messageId: "msg_client" });
    resolveOrganizationEmailTemplate.mockResolvedValue({
      kind: "contract_confirmation",
      subjectTemplate: "Contract klaar — {{organizationName}}",
      bodyTemplate: "Beste {{recipientName}}",
    });
  });

  it("uses the contract confirmation template for contract requests", async () => {
    const { db } = createConfirmationDb();

    await sendFormCompletionClientEmail(db, clientInput);

    expect(resolveOrganizationEmailTemplate).toHaveBeenCalledWith(
      db,
      clientInput.organizationId,
      "contract_confirmation",
    );
    expect(sendEmail).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        emailKind: "confirmation",
        subject: "Contract klaar — Praktijk De Linde",
      }),
    );
  });

  it("does not send duplicate client confirmation mail", async () => {
    const { db } = createConfirmationDb();

    const result = await sendFormCompletionClientEmail(db, {
      ...clientInput,
      clientConfirmationSentAt: new Date("2026-08-22T10:00:00.000Z"),
    });

    expect(result).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("sendFormCompletionNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue({ messageId: "msg_done" });
    resolveOrganizationEmailTemplate.mockResolvedValue({
      kind: "intake_confirmation",
      subjectTemplate: "Bevestiging — {{organizationName}}",
      bodyTemplate: "Beste {{recipientName}}",
    });
  });

  it("still sends staff mail without email_kind", async () => {
    const { db } = createConfirmationDb();

    await sendFormCompletionNotifications(db, {
      organizationId: invitationInput.organizationId,
      organizationName: invitationInput.organizationName,
      recipientEmail: invitationInput.recipientEmail,
      recipientName: invitationInput.recipientName,
      formRequestId: invitationInput.formRequestId,
      createdByUserId: "33333333-3333-4333-8333-333333333333",
      documentCategory: "intake",
      clientConfirmationSentAt: null,
      confirmationSubjectSnapshot: null,
      confirmationBodySnapshot: null,
      dashboardOrigin: "https://formulierendesk.nl",
    });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(
      1,
      db,
      expect.objectContaining({ emailKind: "confirmation" }),
    );
    expect(sendEmail).toHaveBeenNthCalledWith(
      2,
      db,
      expect.objectContaining({
        to: "staff@praktijk.nl",
      }),
    );
    expect(sendEmail.mock.calls[1]?.[1]).not.toHaveProperty("emailKind");
  });
});

describe("logEmailSentEvent email_kind", () => {
  it("stores email_kind on sent events", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const db = {
      insert: vi.fn(() => ({ values })),
    } as unknown as Pick<Database, "insert">;

    const { logEmailSentEvent: logEvent } = await import("@/server/email/events");

    await logEvent(db, {
      organizationId: invitationInput.organizationId,
      providerMessageId: "msg_123",
      recipientEmail: "client@example.com",
      formRequestId: invitationInput.formRequestId,
      emailKind: "invitation",
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        emailKind: "invitation",
        eventType: "sent",
      }),
    );
  });
});
