import Link from "next/link";
import { ClientForm } from "@/components/client-form";
import { requireDashboardContext } from "@/server/auth/guard";

export default async function NewClientPage() {
  await requireDashboardContext();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/dashboard/clients" className="hover:underline">
            Cliënten
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Nieuwe cliënt</h1>
        <p className="mt-1 text-neutral-600">
          Alleen naam en e-mailadres zijn verplicht. Dit is geen dossier.
        </p>
      </div>
      <ClientForm submitLabel="Cliënt opslaan" cancelHref="/dashboard/clients" />
    </section>
  );
}
