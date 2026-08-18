import Link from "next/link";
import { requireDashboardContext } from "@/server/auth/guard";
import { countClients } from "@/server/clients/service";
import { countFormRequests } from "@/server/forms/service";
import { countTemplates } from "@/server/templates/service";

export default async function DashboardPage() {
  const tenant = await requireDashboardContext();
  const [clientCount, templateCount, requestCount] = await Promise.all([
    countClients(tenant),
    countTemplates(tenant),
    countFormRequests(tenant),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overzicht</h1>
        <p className="mt-1 text-neutral-600">
          Welkom, {tenant.userDisplayName}. Je werkt in {tenant.organizationName}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <p className="text-sm text-neutral-500">Sjablonen</p>
          <p className="mt-1 text-3xl font-semibold">{templateCount}</p>
          <div className="mt-4 flex gap-3 text-sm">
            <Link href="/dashboard/templates" className="text-neutral-900 underline">
              Sjablonen bekijken
            </Link>
            <Link href="/dashboard/templates/new" className="text-neutral-900 underline">
              PDF uploaden
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <p className="text-sm text-neutral-500">Verzoeken</p>
          <p className="mt-1 text-3xl font-semibold">{requestCount}</p>
          <div className="mt-4 flex gap-3 text-sm">
            <Link href="/dashboard/requests" className="text-neutral-900 underline">
              Verzoeken bekijken
            </Link>
            <Link href="/dashboard/requests/new" className="text-neutral-900 underline">
              Link maken
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
