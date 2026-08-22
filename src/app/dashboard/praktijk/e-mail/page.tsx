import Link from "next/link";
import { EmailTemplateForm } from "@/components/email-template-form";
import {
  ORGANIZATION_EMAIL_TEMPLATE_KIND_LABELS,
  type OrganizationEmailTemplateKind,
} from "@/lib/constants";
import { requireDashboardContext } from "@/server/auth/guard";
import { listOrganizationEmailTemplates } from "@/server/email-templates/service";

type EmailTemplatesPageProps = {
  searchParams: Promise<{
    saved?: string;
    reset?: string;
  }>;
};

export default async function EmailTemplatesPage({
  searchParams,
}: EmailTemplatesPageProps) {
  const tenant = await requireDashboardContext();
  const templates = await listOrganizationEmailTemplates(tenant);
  const params = await searchParams;
  const savedKind = parseKindParam(params.saved);
  const resetKind = parseKindParam(params.reset);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/dashboard/praktijk" className="hover:text-neutral-900">
            Praktijk
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-neutral-800">E-mailsjablonen</span>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          E-mailsjablonen
        </h1>
        <p className="mt-1 text-neutral-600">
          Beheer de standaardteksten voor uitnodigingen en bevestigingen van
          deze organisatie. Plain text alleen — geen HTML-editor.
        </p>
        <p className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          Wijzigingen gelden voor nieuwe verzoeken. Bestaande verzoeken blijven
          ongewijzigd door opgeslagen snapshots.
        </p>
      </div>

      {savedKind ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          role="status"
        >
          “{ORGANIZATION_EMAIL_TEMPLATE_KIND_LABELS[savedKind]}” is opgeslagen.
          Nieuwe verzoeken gebruiken deze tekst.
        </p>
      ) : null}

      {resetKind ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          role="status"
        >
          “{ORGANIZATION_EMAIL_TEMPLATE_KIND_LABELS[resetKind]}” is hersteld
          naar de standaardtekst.
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        {templates.map((template) => (
          <EmailTemplateForm
            key={template.kind}
            kind={template.kind}
            label={template.label}
            isCustomized={template.isCustomized}
            defaultValues={{
              subjectTemplate: template.subjectTemplate,
              bodyTemplate: template.bodyTemplate,
            }}
          />
        ))}
      </div>
    </section>
  );
}

function parseKindParam(
  value: string | undefined,
): OrganizationEmailTemplateKind | null {
  if (!value) {
    return null;
  }

  if (value in ORGANIZATION_EMAIL_TEMPLATE_KIND_LABELS) {
    return value as OrganizationEmailTemplateKind;
  }

  return null;
}
