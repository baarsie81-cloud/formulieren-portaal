import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/server/db";

vi.mock("server-only", () => ({}));

const { logEmailSentEvent } = await import("@/server/email/events");

describe("logEmailSentEvent", () => {
  it("inserts a sent email event", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const db = {
      insert: vi.fn(() => ({ values })),
    } as unknown as Pick<Database, "insert">;

    const occurredAt = new Date("2026-08-19T09:00:00.000Z");

    await logEmailSentEvent(db, {
      organizationId: "11111111-1111-4111-8111-111111111111",
      providerMessageId: "msg_123",
      recipientEmail: "client@example.com",
      formRequestId: "22222222-2222-4222-8222-222222222222",
      occurredAt,
    });

    expect(values).toHaveBeenCalledWith({
      organizationId: "11111111-1111-4111-8111-111111111111",
      formRequestId: "22222222-2222-4222-8222-222222222222",
      reminderDeliveryId: undefined,
      providerMessageId: "msg_123",
      eventType: "sent",
      recipientEmail: "client@example.com",
      occurredAt,
    });
  });
});
