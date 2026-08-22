import Link from "next/link";
import { ArchiveTemplateButton } from "@/components/archive-template-button";
import { DeleteTemplateButton } from "@/components/delete-template-button";
import { RestoreTemplateButton } from "@/components/restore-template-button";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/datetime";
import { requireDashboardContext } from "@/server/auth/guard";
import {
  listArchivedTemplates,
  listTemplates,
} from "@/server/templates/service";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const tenant = await requireDashboardContext();
  const { view } = await searchParams;
  const showArchived = view === "archived";
  const templates = showArchived
    ? await listArchivedTemplates(tenant)
    : await listTemplates(tenant);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sjablonen</h1>
          <p className="mt-1 text-neutral-600">
            Bestaande PDF-formulieren. Formulierendesk ontwerpt of bewerkt geen
            PDF&apos;s.
          </p>
        </div>
        {!showArchived ? (
          <Link
            href="/dashboard/templates/new"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            PDF uploaden
          </Link>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-neutral-200 text-sm">
        <Link
          href="/dashboard/templates"
          className={
            !showArchived
              ? "border-b-2 border-neutral-900 px-3 py-2 font-medium text-neutral-950"
              : "px-3 py-2 text-neutral-600 hover:text-neutral-950"
          }
        >
          Actief
        </Link>
        <Link
          href="/dashboard/templates?view=archived"
          className={
            showArchived
              ? "border-b-2 border-neutral-900 px-3 py-2 font-medium text-neutral-950"
              : "px-3 py-2 text-neutral-600 hover:text-neutral-950"
          }
        >
          Archief
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-neutral-600">
          {showArchived
            ? "Geen gearchiveerde sjablonen."
            : "Nog geen sjablonen in deze praktijk."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">Naam</th>
                <th className="px-4 py-3 font-medium">Formuliertype</th>
                <th className="px-4 py-3 font-medium">Inhoudsversie</th>
                <th className="px-4 py-3 font-medium">Toegevoegd</th>
                <th className="px-4 py-3 font-medium">Acties</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr
                  key={template.id}
                  className="border-b border-neutral-100 last:border-0 align-top"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/templates/${template.id}`}
                      className="font-medium text-neutral-950 hover:underline"
                    >
                      {template.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {DOCUMENT_CATEGORY_LABELS[template.category]}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-700">
                    {template.sha256.slice(0, 12)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatDateTime(template.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {showArchived ? (
                      <div className="flex flex-col gap-3">
                        <RestoreTemplateButton templateId={template.id} />
                        <DeleteTemplateButton
                          templateId={template.id}
                          templateName={template.name}
                        />
                      </div>
                    ) : (
                      <ArchiveTemplateButton templateId={template.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
