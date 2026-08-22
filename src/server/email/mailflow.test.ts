import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/server/db";
import { EmailError } from "@/server/errors";

vi.mock("server-only", () => ({}));

const sendEmail = vi.fn();
const isEmailConfigured = vi.fn();
vi.mock("@/server/email/send", () => ({
  sendEmail,
  isEmailConfigured,
}));

const { sendFormRequestInvitation } = await import("@/server/email/invitation");
const {
  sendFormCompletionClientEmail,
  sendFormCompletionNotifications,
} = await import("@/server/email/confirmation");

const invitationInput = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  recipientEmail: "client@example.com",
  formRequestId: "22222222-2222-4222-8222-222222222222",
};

function createInvitationDb(requestRow: {
  invitationSubjectSnapshot?: string | null;
  invitationBodySnapshot?: string | null;
  invitationSentAt?: Date | null;
}) {
  return {
    insert: vi.fn(),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([requestRow]),
        })),
      })),
    })),
  } as unknown as Pick<Database, "insert" | "update" | "select">;
}

function createConfirmationDb() {
  return {
    insert: vi.fn(),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{ email: "staff@praktijk.nl" }]),
        })),
      })),
    })),
  } as unknown as Pick<Database, "insert" | "update" | "select">;
}

describe("sendFormRequestInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue({ messageId: "msg_invite" });
  });

  it("sends exclusively from stored invitation snapshots", async () => {
    const db = createInvitationDb({
      invitationSubjectSnapshot: "Opgeslagen onderwerp",
      invitationBodySnapshot: "Opgeslagen body",
    });

    await sendFormRequestInvitation(db, invitationInput);

    expect(sendEmail).toHaveBeenCalledWith(db, {
      organizationId: invitationInput.organizationId,
      to: invitationInput.recipientEmail,
      subject: "Opgeslagen onderwerp",
      text: "Opgeslagen body",
      html: expect.stringContaining("Opgeslagen body"),
      formRequestId: invitationInput.formRequestId,
      emailKind: "invitation",
    });
  });

  it("throws when invitation snapshots are missing", async () => {
    const db = createInvitationDb({
      invitationSubjectSnapshot: null,
      invitationBodySnapshot: null,
    });

    await expect(sendFormRequestInvitation(db, invitationInput)).rejects.toBeInstanceOf(
      EmailError,
    );
  });
});

describe("sendFormCompletionClientEmail", () => {
  const clientInput = {
    organizationId: invitationInput.organizationId,
    organizationName: "Praktijk De Linde",
    recipientEmail: invitationInput.recipientEmail,
    recipientName: "Ada Lovelace",
    formRequestId: invitationInput.formRequestId,
    documentCategory: "intake" as const,
    clientConfirmationSentAt: null,
    confirmationSubjectSnapshot: "Opgeslagen bevestiging",
    confirmationBodySnapshot: "Bedankt Ada",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue({ messageId: "msg_client" });
  });

  it("uses the stored confirmation snapshot at finalize", async () => {
    const db = createConfirmationDb();

    await sendFormCompletionClientEmail(db, clientInput);

    expect(sendEmail).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        subject: "Opgeslagen bevestiging",
        text: "Bedankt Ada",
        emailKind: "confirmation",
      }),
    );
  });

  it("does not send duplicate confirmation mail on retry", async () => {
    const db = createConfirmationDb();

    const result = await sendFormCompletionClientEmail(db, {
      ...clientInput,
      clientConfirmationSentAt: new Date("2026-08-22T10:00:00.000Z"),
    });

    expect(result).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("throws when confirmation snapshots are missing", async () => {
    const db = createConfirmationDb();

    await expect(
      sendFormCompletionClientEmail(db, {
        ...clientInput,
        confirmationSubjectSnapshot: null,
        confirmationBodySnapshot: null,
      }),
    ).rejects.toBeInstanceOf(EmailError);
  });
});

describe("sendFormCompletionNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue({ messageId: "msg_done" });
  });

  it("still sends staff mail without email_kind", async () => {
    const db = createConfirmationDb();

    await sendFormCompletionNotifications(db, {
      organizationId: invitationInput.organizationId,
      organizationName: "Praktijk De Linde",
      recipientEmail: invitationInput.recipientEmail,
      recipientName: "Ada Lovelace",
      formRequestId: invitationInput.formRequestId,
      createdByUserId: "33333333-3333-4333-8333-333333333333",
      documentCategory: "intake",
      clientConfirmationSentAt: null,
      confirmationSubjectSnapshot: "Bevestiging",
      confirmationBodySnapshot: "Bedankt",
      dashboardOrigin: "https://formulierendesk.nl",
    });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[1]?.[1]).not.toHaveProperty("emailKind");
  });
});

describe("logEmailSentEvent email_kind", () => {
  it("stores email_kind on sent events", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const db = {
      insert: vi.fn(() => ({ values })),
    } as unknown as Pick<Database, "insert">;

    const { logEmailSentEvent } = await import("@/server/email/events");

    await logEmailSentEvent(db, {
      organizationId: invitationInput.organizationId,
      providerMessageId: "msg_123",
      recipientEmail: invitationInput.recipientEmail,
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
