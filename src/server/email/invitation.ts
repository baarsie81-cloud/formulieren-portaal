import "server-only";

import { eq } from "drizzle-orm";
import type { DocumentCategory } from "@/lib/constants";
import type { Database } from "@/server/db";
import { formRequests } from "@/server/db/schema";
import { sendEmail, isEmailConfigured } from "@/server/email/send";
import type { SendEmailResult } from "@/server/email/schema";
import {
  buildInvitationTemplateContext,
  getDefaultEmailTemplate,
  invitationTemplateKindForCategory,
  renderEmailTemplate,
  renderedEmailFromSnapshot,
  resolveOrganizationEmailTemplate,
} from "@/server/email/templates";

export type FormRequestInvitationInput = {
  organizationId: string;
  organizationName: string;
  recipientEmail: string;
  recipientName: string;
  formRequestId: string;
  formUrl: string;
  expiresAt: Date;
  documentCategory: DocumentCategory;
};

export function buildFormRequestInvitationEmail(input: FormRequestInvitationInput) {
  const templateKind = invitationTemplateKindForCategory(input.documentCategory);

  return renderEmailTemplate(
    getDefaultEmailTemplate(templateKind),
    buildInvitationTemplateContext(input),
  );
}

async function persistInvitationSnapshots(
  db: Pick<Database, "update">,
  formRequestId: string,
  snapshots: {
    subject: string;
    text: string;
  },
) {
  await db
    .update(formRequests)
    .set({
      invitationSubjectSnapshot: snapshots.subject,
      invitationBodySnapshot: snapshots.text,
    })
    .where(eq(formRequests.id, formRequestId));
}

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

  const content =
    request?.invitationSubjectSnapshot && request.invitationBodySnapshot
      ? renderedEmailFromSnapshot(
          request.invitationSubjectSnapshot,
          request.invitationBodySnapshot,
        )
      : await (async () => {
          const templateKind = invitationTemplateKindForCategory(
            input.documentCategory,
          );
          const template = await resolveOrganizationEmailTemplate(
            db,
            input.organizationId,
            templateKind,
          );
          const rendered = renderEmailTemplate(
            template,
            buildInvitationTemplateContext(input),
          );

          await persistInvitationSnapshots(db, input.formRequestId, rendered);

          return rendered;
        })();

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

  if (!request?.invitationSentAt) {
    await markInvitationSent(db, input.formRequestId, sentAt);
  }

  return delivery;
}
