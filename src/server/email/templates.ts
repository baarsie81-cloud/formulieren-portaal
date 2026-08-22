import "server-only";

import { and, eq } from "drizzle-orm";
import {
  FORM_REQUEST_TTL_DAYS,
  type DocumentCategory,
  type OrganizationEmailTemplateKind,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/datetime";
import type { Database } from "@/server/db";
import { organizationEmailTemplates } from "@/server/db/schema";

export type EmailTemplateContext = Record<string, string>;

export type ResolvedEmailTemplate = {
  kind: OrganizationEmailTemplateKind;
  subjectTemplate: string;
  bodyTemplate: string;
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

export function invitationTemplateKindForCategory(
  category: DocumentCategory,
): OrganizationEmailTemplateKind {
  return category === "contract" ? "contract_invitation" : "intake_invitation";
}

export function confirmationTemplateKindForCategory(
  category: DocumentCategory,
): OrganizationEmailTemplateKind {
  return category === "contract" ? "contract_confirmation" : "intake_confirmation";
}

export function getDefaultEmailTemplate(
  kind: OrganizationEmailTemplateKind,
): Pick<ResolvedEmailTemplate, "subjectTemplate" | "bodyTemplate"> {
  switch (kind) {
    case "intake_invitation":
      return {
        subjectTemplate: "Formulier van {{organizationName}}",
        bodyTemplate: [
          "Beste {{recipientName}},",
          "",
          "{{organizationName}} heeft een beveiligd formulier voor u klaargezet.",
          "Via onderstaande link kunt u het formulier invullen en ondertekenen:",
          "",
          "{{formUrl}}",
          "",
          "De link is {{ttlDays}} dagen geldig (tot {{expiresAt}}).",
          "Deel deze link niet met anderen.",
          "",
          "Met vriendelijke groet,",
          "{{organizationName}}",
        ].join("\n"),
      };
    case "contract_invitation":
      return {
        subjectTemplate: "Contractformulier van {{organizationName}}",
        bodyTemplate: [
          "Beste {{recipientName}},",
          "",
          "{{organizationName}} heeft een beveiligd contractformulier voor u klaargezet.",
          "Via onderstaande link kunt u het contract invullen en ondertekenen:",
          "",
          "{{formUrl}}",
          "",
          "De link is {{ttlDays}} dagen geldig (tot {{expiresAt}}).",
          "Deel deze link niet met anderen.",
          "",
          "Met vriendelijke groet,",
          "{{organizationName}}",
        ].join("\n"),
      };
    case "intake_confirmation":
      return {
        subjectTemplate: "Bevestiging ondertekening — {{organizationName}}",
        bodyTemplate: [
          "Beste {{recipientName}},",
          "",
          "{{organizationName}} bevestigt dat uw formulier succesvol is ontvangen en ondertekend.",
          "U hoeft verder niets te doen.",
          "",
          "Met vriendelijke groet,",
          "{{organizationName}}",
        ].join("\n"),
      };
    case "contract_confirmation":
      return {
        subjectTemplate: "Bevestiging contractondertekening — {{organizationName}}",
        bodyTemplate: [
          "Beste {{recipientName}},",
          "",
          "{{organizationName}} bevestigt dat uw contract succesvol is ontvangen en ondertekend.",
          "U hoeft verder niets te doen.",
          "",
          "Met vriendelijke groet,",
          "{{organizationName}}",
        ].join("\n"),
      };
  }
}

export async function resolveOrganizationEmailTemplate(
  db: Pick<Database, "select">,
  organizationId: string,
  kind: OrganizationEmailTemplateKind,
): Promise<ResolvedEmailTemplate> {
  const [row] = await db
    .select({
      subjectTemplate: organizationEmailTemplates.subjectTemplate,
      bodyTemplate: organizationEmailTemplates.bodyTemplate,
    })
    .from(organizationEmailTemplates)
    .where(
      and(
        eq(organizationEmailTemplates.organizationId, organizationId),
        eq(organizationEmailTemplates.kind, kind),
      ),
    )
    .limit(1);

  if (row) {
    return {
      kind,
      subjectTemplate: row.subjectTemplate,
      bodyTemplate: row.bodyTemplate,
    };
  }

  return {
    kind,
    ...getDefaultEmailTemplate(kind),
  };
}

export function substituteEmailTemplate(
  template: string,
  context: EmailTemplateContext,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in context)) {
      return match;
    }

    return context[key] ?? "";
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function snapshotTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      if (/^https?:\/\//.test(paragraph)) {
        return `<p><a href="${escapeHtml(paragraph)}">Formulier openen</a></p>`;
      }

      return `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`;
    })
    .join("");
}

export function renderEmailTemplate(
  template: Pick<ResolvedEmailTemplate, "subjectTemplate" | "bodyTemplate">,
  context: EmailTemplateContext,
): RenderedEmail {
  const subject = substituteEmailTemplate(template.subjectTemplate, context);
  const text = substituteEmailTemplate(template.bodyTemplate, context);

  return {
    subject,
    text,
    html: snapshotTextToHtml(text),
  };
}

export function buildInvitationTemplateContext(input: {
  organizationName: string;
  recipientName: string;
  formUrl: string;
  expiresAt: Date;
}): EmailTemplateContext {
  return {
    organizationName: input.organizationName.trim(),
    recipientName: input.recipientName.trim(),
    formUrl: input.formUrl,
    expiresAt: formatDateTime(input.expiresAt),
    ttlDays: String(FORM_REQUEST_TTL_DAYS),
  };
}

export function buildConfirmationTemplateContext(input: {
  organizationName: string;
  recipientName: string;
}): EmailTemplateContext {
  return {
    organizationName: input.organizationName.trim(),
    recipientName: input.recipientName.trim(),
  };
}

export function renderedEmailFromSnapshot(
  subjectSnapshot: string,
  bodySnapshot: string,
): RenderedEmail {
  return {
    subject: subjectSnapshot,
    text: bodySnapshot,
    html: snapshotTextToHtml(bodySnapshot),
  };
}
