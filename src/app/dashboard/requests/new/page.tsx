import Link from "next/link";
import { CreateRequestForm } from "@/components/create-request-form";
import { requireDashboardContext } from "@/server/auth/guard";
import { listClients } from "@/server/clients/service";
import { isEmailConfigured } from "@/server/email/send";
import { listTemplates } from "@/server/templates/service";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const tenant = await requireDashboardContext();
  const { clientId } = await searchParams;
  const emailEnabled = isEmailConfigured();
  const [clients, templates] = await Promise.all([
    listClients(tenant),
    listTemplates(tenant),
  ]);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/dashboard/requests" className="hover:underline">
            Verzoeken
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Cliëntlink maken</h1>
        <p className="mt-1 text-neutral-600">
          Kies een cliënt en een bestaand PDF-sjabloon.
          {emailEnabled
            ? " De cliënt ontvangt een uitnodiging per e-mail met een beveiligde link."
            : " Er wordt een beveiligde link gemaakt; e-mail is nog niet geconfigureerd."}
        </p>
      </div>

      {clients.length === 0 || templates.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
          {clients.length === 0 ? (
            <>
              Voeg eerst een{" "}
              <Link href="/dashboard/clients/new" className="underline">
                cliënt
              </Link>{" "}
              toe.
            </>
          ) : (
            <>
              Upload eerst een{" "}
              <Link href="/dashboard/templates/new" className="underline">
                PDF-sjabloon
              </Link>{" "}
              met AcroForm-velden.
            </>
          )}
        </p>
      ) : (
        <CreateRequestForm
          emailEnabled={emailEnabled}
          clients={clients.map((client) => ({
            id: client.id,
            label: client.displayName,
            extra: client.email,
          }))}
          templates={templates.map((template) => ({
            id: template.id,
            label: template.name,
          }))}
          defaultClientId={clientId}
        />
      )}
    </section>
  );
}
