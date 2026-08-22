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
  buildFormRequestInvitationEmail,
  sendFormRequestInvitation,
} = await import("@/server/email/invitation");

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

function createInvitationDb() {
  const requestSelect = {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue([
          {
            invitationSubjectSnapshot: null,
            invitationBodySnapshot: null,
            invitationSentAt: null,
          },
        ]),
      })),
    })),
  };
  const templateSelect = {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue([]),
      })),
    })),
  };

  return {
    insert: vi.fn(),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    select: vi
      .fn()
      .mockReturnValueOnce(requestSelect)
      .mockReturnValueOnce(templateSelect),
  } as unknown as Pick<Database, "insert" | "update" | "select">;
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

  it("does not include form field values or other sensitive client data", () => {
    const content = buildFormRequestInvitationEmail({
      ...invitationInput,
      recipientName: "Jan Jansen",
    });

    const combined = `${content.subject}\n${content.text}\n${content.html}`;

    expect(combined).not.toMatch(/diagnose|medic|telefoon|bsn|geboortedatum/i);
    expect(combined).not.toContain("valueKey");
    expect(combined).not.toContain("field_values");
    expect(combined).not.toContain("06-12345678");
    expect(combined).not.toContain("templateBlobKey");
  });
});

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

  it("sends to the request recipient and links the form request", async () => {
    const result = await sendFormRequestInvitation(db, invitationInput);

    expect(result).toEqual({ messageId: "msg_invite" });
    expect(sendEmail).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        organizationId: invitationInput.organizationId,
        to: "client@example.com",
        subject: "Formulier van Praktijk De Linde",
        formRequestId: invitationInput.formRequestId,
        emailKind: "invitation",
      }),
    );
  });
});
