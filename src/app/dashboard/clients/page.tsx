import Link from "next/link";
import { ArchiveClientButton } from "@/components/archive-client-button";
import { DeleteClientButton } from "@/components/delete-client-button";
import { RestoreClientButton } from "@/components/restore-client-button";
import { formatDateTime } from "@/lib/datetime";
import { requireDashboardContext } from "@/server/auth/guard";
import {
  listArchivedClients,
  listClients,
} from "@/server/clients/service";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const tenant = await requireDashboardContext();
  const { view } = await searchParams;
  const showArchived = view === "archived";
  const clientList = showArchived
    ? await listArchivedClients(tenant)
    : await listClients(tenant);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cliënten</h1>
          <p className="mt-1 text-neutral-600">
            Minimale gegevens om formulieren later te kunnen adresseren.
          </p>
        </div>
        {!showArchived ? (
          <Link
            href="/dashboard/clients/new"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Cliënt toevoegen
          </Link>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-neutral-200 text-sm">
        <Link
          href="/dashboard/clients"
          className={
            !showArchived
              ? "border-b-2 border-neutral-900 px-3 py-2 font-medium text-neutral-950"
              : "px-3 py-2 text-neutral-600 hover:text-neutral-950"
          }
        >
          Actief
        </Link>
        <Link
          href="/dashboard/clients?view=archived"
          className={
            showArchived
              ? "border-b-2 border-neutral-900 px-3 py-2 font-medium text-neutral-950"
              : "px-3 py-2 text-neutral-600 hover:text-neutral-950"
          }
        >
          Archief
        </Link>
      </div>

      {clientList.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-neutral-600">
          {showArchived
            ? "Geen gearchiveerde cliënten."
            : "Nog geen cliënten in deze praktijk."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">Naam</th>
                <th className="px-4 py-3 font-medium">E-mailadres</th>
                <th className="px-4 py-3 font-medium">Telefoon</th>
                <th className="px-4 py-3 font-medium">
                  {showArchived ? "Gearchiveerd" : "Toegevoegd"}
                </th>
                <th className="px-4 py-3 font-medium">Acties</th>
              </tr>
            </thead>
            <tbody>
              {clientList.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-neutral-100 last:border-0 align-top"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="font-medium text-neutral-950 hover:underline"
                    >
                      {client.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{client.email}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {client.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatDateTime(
                      showArchived && client.archivedAt
                        ? client.archivedAt
                        : client.createdAt,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {showArchived ? (
                      <div className="flex flex-col gap-3">
                        <RestoreClientButton clientId={client.id} />
                        <DeleteClientButton
                          clientId={client.id}
                          clientName={client.displayName}
                        />
                      </div>
                    ) : (
                      <ArchiveClientButton clientId={client.id} />
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
