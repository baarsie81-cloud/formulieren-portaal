import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveClientButton } from "@/components/archive-client-button";
import { ClientForm } from "@/components/client-form";
import { DeleteClientButton } from "@/components/delete-client-button";
import { RestoreClientButton } from "@/components/restore-client-button";
import { formatDateTime } from "@/lib/datetime";
import { requireDashboardContext } from "@/server/auth/guard";
import { getClient } from "@/server/clients/service";
import { NotFoundError } from "@/server/errors";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const tenant = await requireDashboardContext();
  const { clientId } = await params;

  let client;

  try {
    client = await getClient(tenant, clientId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const archived = client.archivedAt != null;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">
          <Link
            href={archived ? "/dashboard/clients?view=archived" : "/dashboard/clients"}
            className="hover:underline"
          >
            Cliënten
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {client.displayName}
        </h1>
        <p className="mt-1 text-neutral-600">
          Toegevoegd {formatDateTime(client.createdAt)}
          {archived && client.archivedAt
            ? ` · Gearchiveerd ${formatDateTime(client.archivedAt)}`
            : null}
        </p>
      </div>

      {archived ? (
        <>
          <p className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
            Deze cliënt is gearchiveerd en kan niet meer worden gewijzigd.
          </p>
          <div className="flex flex-wrap gap-3">
            <RestoreClientButton clientId={client.id} />
          </div>
          <DeleteClientButton
            clientId={client.id}
            clientName={client.displayName}
          />
        </>
      ) : (
        <>
          <ClientForm
            clientId={client.id}
            defaultValues={{
              displayName: client.displayName,
              email: client.email,
              phone: client.phone,
              externalReference: client.externalReference,
            }}
            submitLabel="Wijzigingen opslaan"
            cancelHref="/dashboard/clients"
          />
          <div className="flex gap-3">
            <Link
              href={`/dashboard/requests/new?clientId=${client.id}`}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Formulierlink maken
            </Link>
          </div>
          <ArchiveClientButton clientId={client.id} />
        </>
      )}
    </section>
  );
}
