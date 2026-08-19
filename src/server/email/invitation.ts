import "server-only";

import { FORM_REQUEST_TTL_DAYS } from "@/lib/constants";
import { formatDateTime } from "@/lib/datetime";
import type { Database } from "@/server/db";
import { sendEmail, isEmailConfigured } from "@/server/email/send";
import type { SendEmailResult } from "@/server/email/schema";

export type FormRequestInvitationInput = {
  organizationId: string;
  organizationName: string;
  recipientEmail: string;
  recipientName: string;
  formRequestId: string;
  formUrl: string;
  expiresAt: Date;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildFormRequestInvitationEmail(input: FormRequestInvitationInput) {
  const organizationName = input.organizationName.trim();
  const recipientName = input.recipientName.trim();
  const expiresAtLabel = formatDateTime(input.expiresAt);
  const subject = `Formulier van ${organizationName}`;

  const text = [
    `Beste ${recipientName},`,
    "",
    `${organizationName} heeft een beveiligd formulier voor u klaargezet.`,
    "Via onderstaande link kunt u het formulier invullen en ondertekenen:",
    "",
    input.formUrl,
    "",
    `De link is ${FORM_REQUEST_TTL_DAYS} dagen geldig (tot ${expiresAtLabel}).`,
    "Deel deze link niet met anderen.",
    "",
    "Met vriendelijke groet,",
    organizationName,
  ].join("\n");

  const html = [
    `<p>Beste ${escapeHtml(recipientName)},</p>`,
    `<p>${escapeHtml(organizationName)} heeft een beveiligd formulier voor u klaargezet.</p>`,
    "<p>Via onderstaande link kunt u het formulier invullen en ondertekenen:</p>",
    `<p><a href="${escapeHtml(input.formUrl)}">Formulier openen</a></p>`,
    `<p>De link is ${FORM_REQUEST_TTL_DAYS} dagen geldig (tot ${escapeHtml(expiresAtLabel)}).</p>`,
    "<p>Deel deze link niet met anderen.</p>",
    `<p>Met vriendelijke groet,<br>${escapeHtml(organizationName)}</p>`,
  ].join("");

  return { subject, html, text };
}

export async function sendFormRequestInvitation(
  db: Pick<Database, "insert">,
  input: FormRequestInvitationInput,
): Promise<SendEmailResult | null> {
  if (!isEmailConfigured()) {
    return null;
  }

  const content = buildFormRequestInvitationEmail(input);

  return sendEmail(db, {
    organizationId: input.organizationId,
    to: input.recipientEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    formRequestId: input.formRequestId,
  });
}
