import "server-only";

import type { EmailKind } from "@/lib/constants";
import type { Database } from "@/server/db";
import { emailEvents } from "@/server/db/schema";

export type LogEmailSentEventInput = {
  organizationId: string;
  providerMessageId: string;
  recipientEmail: string;
  formRequestId?: string;
  reminderDeliveryId?: string;
  emailKind?: EmailKind;
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
    emailKind: input.emailKind,
    recipientEmail: input.recipientEmail,
    occurredAt: input.occurredAt ?? new Date(),
  });
}
