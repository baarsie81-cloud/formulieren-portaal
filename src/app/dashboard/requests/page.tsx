import Link from "next/link";
import { FORM_REQUEST_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/datetime";
import { requireDashboardContext } from "@/server/auth/guard";
import { listFormRequests } from "@/server/forms/service";

export default async function RequestsPage() {
  const tenant = await requireDashboardContext();
  const requests = await listFormRequests(tenant);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verzoeken</h1>
          <p className="mt-1 text-neutral-600">
            Beveiligde cliëntlinks om een bestaand PDF-formulier in te vullen.
          </p>
        </div>
        <Link
          href="/dashboard/requests/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Link maken
        </Link>
      </div>

      {requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-10 text-center text-neutral-600">
          Nog geen verzoeken in deze praktijk.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 font-medium">Cliënt</th>
                <th className="px-4 py-3 font-medium">Sjabloon</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aangemaakt</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/requests/${request.id}`}
                      className="font-medium text-neutral-950 hover:underline"
                    >
                      {request.recipientName}
                    </Link>
                    <p className="text-neutral-600">{request.recipientEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{request.templateName}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {FORM_REQUEST_STATUS_LABELS[request.status]}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatDateTime(request.createdAt)}
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
