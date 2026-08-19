import "server-only";

import { and, eq } from "drizzle-orm";
import type { Database } from "@/server/db";
import { formRequests, organizations, secureTokens, users } from "@/server/db/schema";
import { sendEmail, isEmailConfigured } from "@/server/email/send";
import type { SendEmailResult } from "@/server/email/schema";
import { parseRawToken } from "@/server/forms/schema";
import { hashSecret } from "@/server/forms/token";

export type FormCompletionEmailContext = {
  organizationId: string;
  organizationName: string;
  recipientEmail: string;
  recipientName: string;
  formRequestId: string;
  createdByUserId: string;
};

export type FormCompletionClientEmailInput = {
  organizationId: string;
  organizationName: string;
  recipientEmail: string;
  recipientName: string;
  formRequestId: string;
};

export type FormCompletionStaffEmailInput = {
  organizationId: string;
  organizationName: string;
  staffEmail: string;
  clientName: string;
  formRequestId: string;
  dashboardRequestUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function loadFormCompletionEmailContext(
  db: Pick<Database, "select">,
  rawToken: string,
): Promise<FormCompletionEmailContext | null> {
  const tokenValue = parseRawToken(rawToken);

  if (!tokenValue) {
    return null;
  }

  const [row] = await db
    .select({
      organizationId: formRequests.organizationId,
      formRequestId: formRequests.id,
      recipientName: formRequests.recipientName,
      recipientEmail: formRequests.recipientEmail,
      createdByUserId: formRequests.createdByUserId,
      organizationName: organizations.name,
    })
    .from(secureTokens)
    .innerJoin(
      formRequests,
      and(
        eq(formRequests.organizationId, secureTokens.organizationId),
        eq(formRequests.id, secureTokens.formRequestId),
      ),
    )
    .innerJoin(organizations, eq(organizations.id, formRequests.organizationId))
    .where(eq(secureTokens.tokenHash, hashSecret(tokenValue)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    recipientEmail: row.recipientEmail,
    recipientName: row.recipientName,
    formRequestId: row.formRequestId,
    createdByUserId: row.createdByUserId,
  };
}

async function loadStaffEmail(
  db: Pick<Database, "select">,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row?.email ?? null;
}

export function buildFormCompletionClientEmail(input: FormCompletionClientEmailInput) {
  const organizationName = input.organizationName.trim();
  const recipientName = input.recipientName.trim();
  const subject = `Bevestiging ondertekening — ${organizationName}`;

  const text = [
    `Beste ${recipientName},`,
    "",
    `${organizationName} bevestigt dat uw formulier succesvol is ontvangen en ondertekend.`,
    "U hoeft verder niets te doen.",
    "",
    "Met vriendelijke groet,",
    organizationName,
  ].join("\n");

  const html = [
    `<p>Beste ${escapeHtml(recipientName)},</p>`,
    `<p>${escapeHtml(organizationName)} bevestigt dat uw formulier succesvol is ontvangen en ondertekend.</p>`,
    "<p>U hoeft verder niets te doen.</p>",
    `<p>Met vriendelijke groet,<br>${escapeHtml(organizationName)}</p>`,
  ].join("");

  return { subject, html, text };
}

export function buildFormCompletionStaffEmail(input: FormCompletionStaffEmailInput) {
  const organizationName = input.organizationName.trim();
  const clientName = input.clientName.trim();
  const subject = `Formulier afgerond — ${clientName}`;

  const text = [
    `Er is een formulier afgerond bij ${organizationName}.`,
    "",
    `Cliënt: ${clientName}`,
    "Het ondertekende formulier is beschikbaar in het dashboard:",
    "",
    input.dashboardRequestUrl,
  ].join("\n");

  const html = [
    `<p>Er is een formulier afgerond bij ${escapeHtml(organizationName)}.</p>`,
    `<p><strong>Cliënt:</strong> ${escapeHtml(clientName)}</p>`,
    "<p>Het ondertekende formulier is beschikbaar in het dashboard:</p>",
    `<p><a href="${escapeHtml(input.dashboardRequestUrl)}">Formulier bekijken</a></p>`,
  ].join("");

  return { subject, html, text };
}

export async function sendFormCompletionClientEmail(
  db: Pick<Database, "insert">,
  input: FormCompletionClientEmailInput,
): Promise<SendEmailResult | null> {
  if (!isEmailConfigured()) {
    return null;
  }

  const content = buildFormCompletionClientEmail(input);

  return sendEmail(db, {
    organizationId: input.organizationId,
    to: input.recipientEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    formRequestId: input.formRequestId,
  });
}

export async function sendFormCompletionStaffEmail(
  db: Pick<Database, "insert">,
  input: FormCompletionStaffEmailInput,
): Promise<SendEmailResult | null> {
  if (!isEmailConfigured()) {
    return null;
  }

  const content = buildFormCompletionStaffEmail(input);

  return sendEmail(db, {
    organizationId: input.organizationId,
    to: input.staffEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    formRequestId: input.formRequestId,
  });
}

export async function sendFormCompletionNotifications(
  db: Pick<Database, "insert" | "select">,
  input: FormCompletionEmailContext & { dashboardOrigin: string },
): Promise<void> {
  if (!isEmailConfigured()) {
    return;
  }

  const dashboardRequestUrl = `${input.dashboardOrigin}/dashboard/requests/${input.formRequestId}`;

  await sendFormCompletionClientEmail(db, {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    formRequestId: input.formRequestId,
  });

  const staffEmail = await loadStaffEmail(db, input.createdByUserId);

  if (!staffEmail) {
    return;
  }

  await sendFormCompletionStaffEmail(db, {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    staffEmail,
    clientName: input.recipientName,
    formRequestId: input.formRequestId,
    dashboardRequestUrl,
  });
}
