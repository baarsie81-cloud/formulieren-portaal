import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/server/db";
import { EmailError } from "@/server/errors";

vi.mock("server-only", () => ({}));

const deliverEmail = vi.fn();
vi.mock("@/server/email/client", () => ({
  deliverEmail,
}));

const getServerEnv = vi.fn();
const isEmailConfigured = vi.fn();
vi.mock("@/server/env", () => ({
  getServerEnv,
  isEmailConfigured,
}));

const { sendEmail } = await import("@/server/email/send");

describe("sendEmail", () => {
  const insert = vi.fn(() => ({
    values: vi.fn().mockResolvedValue(undefined),
  }));
  const db = { insert } as unknown as Pick<Database, "insert">;

  beforeEach(() => {
    vi.clearAllMocks();
    isEmailConfigured.mockReturnValue(true);
    getServerEnv.mockReturnValue({
      EMAIL_FROM: "Formulierendesk <noreply@formulierendesk.nl>",
    });
    deliverEmail.mockResolvedValue({ messageId: "msg_123" });
  });

  it("throws when email is not configured", async () => {
    isEmailConfigured.mockReturnValue(false);

    await expect(
      sendEmail(db, {
        organizationId: "11111111-1111-4111-8111-111111111111",
        to: "client@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
      }),
    ).rejects.toBeInstanceOf(EmailError);

    expect(deliverEmail).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("validates recipient email before sending", async () => {
    await expect(
      sendEmail(db, {
        organizationId: "11111111-1111-4111-8111-111111111111",
        to: "not-an-email",
        subject: "Test",
        html: "<p>Hi</p>",
      }),
    ).rejects.toThrow();

    expect(deliverEmail).not.toHaveBeenCalled();
  });

  it("sends via Resend and logs a sent email event", async () => {
    const result = await sendEmail(db, {
      organizationId: "11111111-1111-4111-8111-111111111111",
      to: "Client@Example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
      formRequestId: "22222222-2222-4222-8222-222222222222",
    });

    expect(result).toEqual({ messageId: "msg_123" });
    expect(deliverEmail).toHaveBeenCalledWith({
      from: "Formulierendesk <noreply@formulierendesk.nl>",
      to: "client@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
      replyTo: undefined,
    });
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
