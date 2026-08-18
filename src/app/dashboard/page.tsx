import Link from "next/link";
import { requireDashboardContext } from "@/server/auth/guard";
import { countClients } from "@/server/clients/service";

export default async function DashboardPage() {
  const tenant = await requireDashboardContext();
  const clientCount = await countClients(tenant);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overzicht</h1>
        <p className="mt-1 text-neutral-600">
          Welkom, {tenant.userDisplayName}. Je werkt in {tenant.organizationName}.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <p className="text-sm text-neutral-500">Cliënten</p>
        <p className="mt-1 text-3xl font-semibold">{clientCount}</p>
        <div className="mt-4 flex gap-3 text-sm">
          <Link href="/dashboard/clients" className="text-neutral-900 underline">
            Cliënten bekijken
          </Link>
          <Link href="/dashboard/clients/new" className="text-neutral-900 underline">
            Cliënt toevoegen
          </Link>
        </div>
      </div>
    </section>
  );
}
