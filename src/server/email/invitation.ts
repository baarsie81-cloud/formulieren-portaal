import "server-only";

import { eq } from "drizzle-orm";
import type { Database } from "@/server/db";
import { formRequests } from "@/server/db/schema";
import { sendEmail, isEmailConfigured } from "@/server/email/send";
import type { SendEmailResult } from "@/server/email/schema";
import { renderedEmailFromSnapshot } from "@/server/email/templates";
import { EmailError } from "@/server/errors";

export type FormRequestInvitationInput = {
  organizationId: string;
  recipientEmail: string;
  formRequestId: string;
};

async function markInvitationSent(
  db: Pick<Database, "update">,
  formRequestId: string,
  sentAt: Date,
) {
  await db
    .update(formRequests)
    .set({ invitationSentAt: sentAt })
    .where(eq(formRequests.id, formRequestId));
}

export async function sendFormRequestInvitation(
  db: Pick<Database, "insert" | "update" | "select">,
  input: FormRequestInvitationInput,
): Promise<SendEmailResult | null> {
  if (!isEmailConfigured()) {
    return null;
  }

  const [request] = await db
    .select({
      invitationSubjectSnapshot: formRequests.invitationSubjectSnapshot,
      invitationBodySnapshot: formRequests.invitationBodySnapshot,
      invitationSentAt: formRequests.invitationSentAt,
    })
    .from(formRequests)
    .where(eq(formRequests.id, input.formRequestId))
    .limit(1);

  if (
    !request?.invitationSubjectSnapshot ||
    !request.invitationBodySnapshot
  ) {
    throw new EmailError("Invitation mail snapshots are missing");
  }

  const content = renderedEmailFromSnapshot(
    request.invitationSubjectSnapshot,
    request.invitationBodySnapshot,
  );

  const sentAt = new Date();
  const delivery = await sendEmail(db, {
    organizationId: input.organizationId,
    to: input.recipientEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    formRequestId: input.formRequestId,
    emailKind: "invitation",
  });

  if (!request.invitationSentAt) {
    await markInvitationSent(db, input.formRequestId, sentAt);
  }

  return delivery;
}
