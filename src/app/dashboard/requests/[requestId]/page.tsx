import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelRequestButton } from "@/components/cancel-request-button";
import { CopyFormLink } from "@/components/copy-form-link";
import { RotateLinkButton } from "@/components/rotate-link-button";
import { DOCUMENT_FIELD_TYPE_LABELS, FORM_REQUEST_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/datetime";
import { requireDashboardContext } from "@/server/auth/guard";
import { NotFoundError } from "@/server/errors";
import { readCreatedTokenCookie } from "@/server/forms/cookie";
import { getPublicOrigin, publicFormUrl } from "@/server/forms/request-meta";
import { parseFieldsSchemaSnapshot } from "@/server/forms/snapshot";
import { getFormRequest } from "@/server/forms/service";
import { asFieldValueMap } from "@/server/forms/values";

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ email?: string }>;
}) {
  const tenant = await requireDashboardContext();
  const { requestId } = await params;
  const { email: emailParam } = await searchParams;

  let detail;

  try {
    detail = await getFormRequest(tenant, requestId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const rawToken = await readCreatedTokenCookie(detail.request.id);
  const origin = await getPublicOrigin();
  const snapshot = parseFieldsSchemaSnapshot(detail.document.fieldsSchemaSnapshot) ?? [];
  const values = asFieldValueMap(detail.document.fieldValues);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/dashboard/requests" className="hover:underline">
            Verzoeken
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{detail.request.recipientName}</h1>
        <p className="mt-1 text-neutral-600">
          {detail.request.recipientEmail} · {detail.templateName} ·{" "}
          {FORM_REQUEST_STATUS_LABELS[detail.request.status]}
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Aangemaakt {formatDateTime(detail.request.createdAt)} · Geldig tot{" "}
          {formatDateTime(detail.request.expiresAt)}
        </p>
      </div>

      {emailParam === "failed" ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          Het formulierverzoek is aangemaakt, maar de uitnodigingsmail kon niet worden verstuurd. Gebruik
          onderstaande link om de cliënt handmatig uit te nodigen.
        </p>
      ) : null}

      {rawToken ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <CopyFormLink url={publicFormUrl(origin, rawToken)} />
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          {detail.hasActiveToken ? (
            <p>
              Er is een actieve cliëntlink. De ruwe URL is niet opnieuw op te vragen; maak een nieuwe
              link als de oude kwijt is.
            </p>
          ) : (
            <p>Er is geen actieve cliëntlink meer.</p>
          )}
        </div>
      )}

      {detail.fillSubmitted && !detail.isFinalized ? (
        <p className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
          De cliënt heeft de gegevens ingediend en kan nu ondertekenen.
        </p>
      ) : null}

      {detail.isFinalized ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p>Dit formulier is definitief ondertekend.</p>
          <p className="mt-1 font-mono text-xs">
            SHA-256: {detail.document.finalPdfSha256}
          </p>
          <Link
            href={`/dashboard/requests/${detail.request.id}/final`}
            className="mt-3 inline-block font-medium underline"
          >
            Definitief audit-PDF downloaden
          </Link>
        </div>
      ) : null}

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-semibold tracking-tight">Ingevulde velden</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Waarden uit de bestaande AcroForm. Handtekeningvelden worden ingevuld bij ondertekenen.
        </p>
        {snapshot.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">Geen veldmapping opgeslagen.</p>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm">
            {snapshot.map((field) => (
              <div key={field.valueKey}>
                <dt className="font-medium text-neutral-800">
                  {field.valueKey}{" "}
                  <span className="font-normal text-neutral-500">
                    ({DOCUMENT_FIELD_TYPE_LABELS[field.fieldType]})
                  </span>
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-neutral-700">
                  {field.fieldType === "signature_area"
                    ? detail.isFinalized
                      ? "Ondertekend in definitief document"
                      : "Nog niet ondertekend"
                    : formatStoredValue(values[field.valueKey])}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <Link
          href={`/dashboard/requests/${detail.request.id}/preview`}
          className="mt-4 inline-block text-sm text-neutral-900 underline"
        >
          Ingevuld PDF bekijken (concept)
        </Link>
      </div>

      {detail.canCancel || detail.canRotateToken ? (
        <div className="flex flex-wrap gap-3">
          {detail.canRotateToken ? <RotateLinkButton requestId={detail.request.id} /> : null}
          {detail.canCancel ? <CancelRequestButton requestId={detail.request.id} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function formatStoredValue(value: string | boolean | undefined): string {
  if (value === undefined || value === "") {
    return "—";
  }

  if (value === true) {
    return "Ja";
  }

  if (value === false) {
    return "Nee";
  }

  return value;
}
