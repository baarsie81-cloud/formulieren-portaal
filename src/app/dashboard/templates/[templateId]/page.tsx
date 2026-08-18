import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveTemplateButton } from "@/components/archive-template-button";
import { TemplateFieldsForm } from "@/components/template-fields-form";
import { TemplateMetadataForm } from "@/components/template-metadata-form";
import { formatDateTime } from "@/lib/datetime";
import { requireDashboardContext } from "@/server/auth/guard";
import { NotFoundError } from "@/server/errors";
import { getTemplate, listTemplateFields } from "@/server/templates/service";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const tenant = await requireDashboardContext();
  const { templateId } = await params;

  let template;

  try {
    template = await getTemplate(tenant, templateId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const fields = await listTemplateFields(tenant, template.id);
  const archived = template.status === "archived";

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/dashboard/templates" className="hover:underline">
            Sjablonen
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{template.name}</h1>
        <p className="mt-1 text-neutral-600">
          Toegevoegd {formatDateTime(template.createdAt)}
          {archived ? " · Gearchiveerd" : null}
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm font-medium text-neutral-800">Inhoudsversie (SHA-256)</p>
        <p className="mt-1 break-all font-mono text-xs text-neutral-700">{template.sha256}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Het PDF-bestand is onwijzigbaar. Een nieuwe versie is een nieuw sjabloon.
        </p>
        <Link
          href={`/dashboard/templates/${template.id}/file`}
          className="mt-3 inline-block text-sm text-neutral-900 underline"
        >
          PDF downloaden
        </Link>
      </div>

      {archived ? (
        <p className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
          Dit sjabloon is gearchiveerd en kan niet meer worden gewijzigd.
        </p>
      ) : (
        <>
          <TemplateMetadataForm
            templateId={template.id}
            defaultValues={{
              name: template.name,
              description: template.description,
            }}
          />

          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Veldkoppeling</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Alleen bestaande PDF-velden. Positie komt uit het document; er is geen editor.
              </p>
            </div>
            {fields.length === 0 ? (
              <p className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
                Dit PDF bevat geen invulbare AcroForm-velden. Lever een PDF met bestaande
                formuliervelden aan.
              </p>
            ) : (
              <TemplateFieldsForm templateId={template.id} fields={fields} />
            )}
          </div>

          <ArchiveTemplateButton templateId={template.id} />
        </>
      )}
    </section>
  );
}
