import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import { requireDashboardContext } from "@/server/auth/guard";
import { listClients } from "@/server/clients/service";

export default async function ClientsPage() {
  const tenant = await requireDashboardContext();
  const clientList = await listClients(tenant);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cliënten</h1>
          <p className="mt-1 text-neutral-600">
            Minimale gegevens om formulieren later te kunnen adresseren.
          </p>
        </div>
        <Link
          href="/dashboard/clients/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Cliënt toevoegen
        </Link>
      </div>

      {clientList.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-neutral-600">
          Nog geen cliënten in deze praktijk.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">Naam</th>
                <th className="px-4 py-3 font-medium">E-mailadres</th>
                <th className="px-4 py-3 font-medium">Telefoon</th>
                <th className="px-4 py-3 font-medium">Toegevoegd</th>
              </tr>
            </thead>
            <tbody>
              {clientList.map((client) => (
                <tr key={client.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className="font-medium text-neutral-950 hover:underline"
                    >
                      {client.displayName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{client.email}</td>
                  <td className="px-4 py-3 text-neutral-700">{client.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatDateTime(client.createdAt)}
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
