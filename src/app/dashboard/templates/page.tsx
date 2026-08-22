import Link from "next/link";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/datetime";
import { requireDashboardContext } from "@/server/auth/guard";
import { listTemplates } from "@/server/templates/service";

export default async function TemplatesPage() {
  const tenant = await requireDashboardContext();
  const templates = await listTemplates(tenant);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sjablonen</h1>
          <p className="mt-1 text-neutral-600">
            Bestaande PDF-formulieren. Formulierendesk ontwerpt of bewerkt geen PDF&apos;s.
          </p>
        </div>
        <Link
          href="/dashboard/templates/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          PDF uploaden
        </Link>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-neutral-600">
          Nog geen sjablonen in deze praktijk.
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
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-neutral-100 last:border-0">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
