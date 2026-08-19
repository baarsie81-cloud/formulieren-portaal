import "server-only";

import type { Database } from "@/server/db";
import { emailEvents } from "@/server/db/schema";

export type LogEmailSentEventInput = {
  organizationId: string;
  providerMessageId: string;
  recipientEmail: string;
  formRequestId?: string;
  reminderDeliveryId?: string;
  occurredAt?: Date;
};

export async function logEmailSentEvent(
  db: Pick<Database, "insert">,
  input: LogEmailSentEventInput,
) {
  await db.insert(emailEvents).values({
    organizationId: input.organizationId,
    formRequestId: input.formRequestId,
    reminderDeliveryId: input.reminderDeliveryId,
    providerMessageId: input.providerMessageId,
    eventType: "sent",
    recipientEmail: input.recipientEmail,
    occurredAt: input.occurredAt ?? new Date(),
  });
}
