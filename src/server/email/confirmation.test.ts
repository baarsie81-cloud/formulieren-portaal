import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/server/db";

vi.mock("server-only", () => ({}));

const sendEmail = vi.fn();
const isEmailConfigured = vi.fn();
vi.mock("@/server/email/send", () => ({
  sendEmail,
  isEmailConfigured,
}));

const {
  buildFormCompletionClientEmail,
  buildFormCompletionStaffEmail,
  sendFormCompletionClientEmail,
  sendFormCompletionNotifications,
  sendFormCompletionStaffEmail,
} = await import("@/server/email/confirmation");

const clientInput = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  organizationName: "Praktijk De Linde",
  recipientEmail: "client@example.com",
  recipientName: "Ada Lovelace",
  formRequestId: "22222222-2222-4222-8222-222222222222",
  documentCategory: "intake" as const,
  clientConfirmationSentAt: null,
  confirmationSubjectSnapshot: "Bevestiging ondertekening — Praktijk De Linde",
  confirmationBodySnapshot: "Beste Ada Lovelace, bedankt.",
};

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

describe("buildFormCompletionClientEmail", () => {
  it("builds client confirmation from stored snapshots", () => {
    const content = buildFormCompletionClientEmail({
      confirmationSubjectSnapshot: clientInput.confirmationSubjectSnapshot,
      confirmationBodySnapshot: clientInput.confirmationBodySnapshot,
    });

    expect(content.subject).toBe("Bevestiging ondertekening — Praktijk De Linde");
    expect(content.text).toContain("Ada Lovelace");
  });
});

describe("buildFormCompletionStaffEmail", () => {
  it("builds Dutch staff notification with client name and dashboard link", () => {
    const content = buildFormCompletionStaffEmail({
      organizationId: clientInput.organizationId,
      organizationName: clientInput.organizationName,
      staffEmail: "staff@praktijk.nl",
      clientName: clientInput.recipientName,
      formRequestId: clientInput.formRequestId,
      dashboardRequestUrl: "https://formulierendesk.nl/dashboard/requests/22222222-2222-4222-8222-222222222222",
    });

    expect(content.subject).toBe("Formulier afgerond — Ada Lovelace");
    expect(content.text).toContain("Ada Lovelace");
    expect(content.text).toContain("https://formulierendesk.nl/dashboard/requests/");
  });
});

describe("sendFormCompletionClientEmail", () => {
  const db = createConfirmationDb();

  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue({ messageId: "msg_client" });
  });

  it("sends stored confirmation snapshots to the client", async () => {
    await sendFormCompletionClientEmail(db, clientInput);

    expect(sendEmail).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        to: "client@example.com",
        subject: clientInput.confirmationSubjectSnapshot,
        text: clientInput.confirmationBodySnapshot,
        emailKind: "confirmation",
      }),
    );
  });
});

describe("sendFormCompletionStaffEmail", () => {
  const db = { insert: vi.fn() } as unknown as Pick<Database, "insert">;

  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue({ messageId: "msg_staff" });
  });

  it("sends to the staff member", async () => {
    await sendFormCompletionStaffEmail(db, {
      organizationId: clientInput.organizationId,
      organizationName: clientInput.organizationName,
      staffEmail: "staff@praktijk.nl",
      clientName: clientInput.recipientName,
      formRequestId: clientInput.formRequestId,
      dashboardRequestUrl: "https://formulierendesk.nl/dashboard/requests/22222222-2222-4222-8222-222222222222",
    });

    expect(sendEmail).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        to: "staff@praktijk.nl",
        formRequestId: clientInput.formRequestId,
      }),
    );
  });
});

describe("sendFormCompletionNotifications", () => {
  const db = createConfirmationDb();

  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue({ messageId: "msg_done" });
  });

  it("sends client and staff notifications after finalize context is available", async () => {
    await sendFormCompletionNotifications(db, {
      ...clientInput,
      createdByUserId: "33333333-3333-4333-8333-333333333333",
      dashboardOrigin: "https://formulierendesk.nl",
    });

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(
      1,
      db,
      expect.objectContaining({ to: "client@example.com" }),
    );
    expect(sendEmail).toHaveBeenNthCalledWith(
      2,
      db,
      expect.objectContaining({ to: "staff@praktijk.nl" }),
    );
  });
});
