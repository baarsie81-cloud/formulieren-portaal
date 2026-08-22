import "server-only";

import type { Database } from "@/server/db";
import { getServerEnv, isEmailConfigured } from "@/server/env";
import { EmailError } from "@/server/errors";
import { deliverEmail } from "@/server/email/client";
import { logEmailSentEvent } from "@/server/email/events";
import {
  sendEmailInputSchema,
  type SendEmailInput,
  type SendEmailResult,
} from "@/server/email/schema";

export { isEmailConfigured };

function requireEmailFrom(): string {
  const from = getServerEnv().EMAIL_FROM;

  if (!from) {
    throw new EmailError("EMAIL_FROM is not set");
  }

  return from;
}

export async function sendEmail(
  db: Pick<Database, "insert">,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    throw new EmailError("Email is not configured");
  }

  const parsed = sendEmailInputSchema.parse(input);
  const delivery = await deliverEmail({
    from: requireEmailFrom(),
    to: parsed.to,
    subject: parsed.subject,
    html: parsed.html,
    text: parsed.text,
    replyTo: parsed.replyTo,
  });

  await logEmailSentEvent(db, {
    organizationId: parsed.organizationId,
    providerMessageId: delivery.messageId,
    recipientEmail: parsed.to,
    formRequestId: parsed.formRequestId,
    reminderDeliveryId: parsed.reminderDeliveryId,
    emailKind: parsed.emailKind,
  });

  return delivery;
}
