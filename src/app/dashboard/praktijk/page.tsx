import Link from "next/link";
import { OrganizationSignatureForm } from "@/components/organization-signature-form";
import { requireDashboardContext } from "@/server/auth/guard";
import { isBlobConfigured } from "@/server/env";
import { getOrganizationSignatureProfile } from "@/server/organizations/service";

export default async function PraktijkPage() {
  const tenant = await requireDashboardContext();
  const profile = await getOrganizationSignatureProfile(tenant);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Praktijk</h1>
        <p className="mt-1 text-neutral-600">
          Beheer de organisatiehandtekening voor contracten. Deze handtekening
          wordt bij afronding op documenten geplaatst wanneer een sjabloon daar
          om vraagt.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm font-medium text-neutral-800">Organisatie</p>
        <p className="mt-1 text-sm text-neutral-700">{profile.organizationName}</p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-semibold tracking-tight">E-mailsjablonen</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Beheer de standaardteksten voor intake- en contractmails van deze
          organisatie.
        </p>
        <Link
          href="/dashboard/praktijk/e-mail"
          className="mt-3 inline-flex text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700"
        >
          E-mailsjablonen beheren
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Organisatiehandtekening</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Eén handtekening per praktijk: PNG, naam en optioneel functie.
          </p>
        </div>

        {profile.hasSignature ? (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-sm font-medium text-neutral-800">Huidige handtekening</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dashboard/praktijk/handtekening"
              alt="Opgeslagen organisatiehandtekening"
              className="mt-3 max-h-28 max-w-xs border border-neutral-200 bg-white object-contain p-2"
            />
            <dl className="mt-3 space-y-1 text-sm text-neutral-700">
              <div>
                <dt className="inline text-neutral-500">Naam: </dt>
                <dd className="inline">{profile.signerName ?? "—"}</dd>
              </div>
              <div>
                <dt className="inline text-neutral-500">Functie: </dt>
                <dd className="inline">{profile.signerTitle ?? "—"}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Er is nog geen organisatiehandtekening opgeslagen.
          </p>
        )}

        <OrganizationSignatureForm
          storageConfigured={isBlobConfigured()}
          hasSignature={profile.hasSignature}
          defaultValues={{
            signerName: profile.signerName ?? "",
            signerTitle: profile.signerTitle ?? "",
          }}
        />
      </div>
    </section>
  );
}
