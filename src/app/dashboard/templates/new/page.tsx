import Link from "next/link";
import { TemplateUploadForm } from "@/components/template-upload-form";
import { requireDashboardContext } from "@/server/auth/guard";
import { isBlobConfigured } from "@/server/env";

export default async function NewTemplatePage() {
  await requireDashboardContext();

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-neutral-500">
          <Link href="/dashboard/templates" className="hover:underline">
            Sjablonen
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Nieuw sjabloon</h1>
        <p className="mt-1 text-neutral-600">
          Upload een bestaand, professioneel ontworpen PDF-formulier. Velden worden
          uit het PDF gelezen; er is geen formulierbouwer.
        </p>
      </div>
      <TemplateUploadForm storageConfigured={isBlobConfigured()} />
    </section>
  );
}
