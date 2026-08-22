import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/server/db";

vi.mock("server-only", () => ({}));

const sendEmail = vi.fn();
const isEmailConfigured = vi.fn();
vi.mock("@/server/email/send", () => ({
  sendEmail,
  isEmailConfigured,
}));

const { sendFormRequestInvitation } = await import("@/server/email/invitation");

const invitationInput = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  recipientEmail: "client@example.com",
  formRequestId: "22222222-2222-4222-8222-222222222222",
};

function createInvitationDb() {
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
          limit: vi.fn().mockResolvedValue([
            {
              invitationSubjectSnapshot: "Formulier van Praktijk De Linde",
              invitationBodySnapshot: "Beste Ada Lovelace",
              invitationSentAt: null,
            },
          ]),
        })),
      })),
    })),
  } as unknown as Pick<Database, "insert" | "update" | "select">;
}

describe("sendFormRequestInvitation", () => {
  const db = createInvitationDb();

  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    sendEmail.mockResolvedValue({ messageId: "msg_invite" });
  });

  it("skips sending when email is not configured", async () => {
    isEmailConfigured.mockReturnValue(false);

    const result = await sendFormRequestInvitation(db, invitationInput);

    expect(result).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends from stored snapshots and logs invitation mail", async () => {
    const result = await sendFormRequestInvitation(db, invitationInput);

    expect(result).toEqual({ messageId: "msg_invite" });
    expect(sendEmail).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        to: "client@example.com",
        subject: "Formulier van Praktijk De Linde",
        formRequestId: invitationInput.formRequestId,
        emailKind: "invitation",
      }),
    );
  });
});
