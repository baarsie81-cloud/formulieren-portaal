import Link from "next/link";
import { InvalidFormLink } from "@/components/invalid-form-link";
import { PublicFormFill } from "@/components/public-form-fill";
import { PublicFormStart } from "@/components/public-form-start";
import { PUBLIC_FORM_INVALID_MESSAGE } from "@/lib/constants";
import { TokenAccessError } from "@/server/errors";
import { getPublicFormContext } from "@/server/forms/public";
import { parseRawToken } from "@/server/forms/schema";
import { fillableFields } from "@/server/forms/snapshot";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!parseRawToken(token)) {
    return <InvalidFormLink />;
  }

  let context;

  try {
    context = await getPublicFormContext(token);
  } catch (error) {
    if (error instanceof TokenAccessError) {
      return <InvalidFormLink />;
    }

    if (error instanceof Error && error.message === "DATABASE_URL is not set") {
      return (
        <section className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Niet beschikbaar</h1>
          <p className="text-neutral-600">{PUBLIC_FORM_INVALID_MESSAGE}</p>
        </section>
      );
    }

    throw error;
  }

  if (!context.started) {
    return (
      <PublicFormStart
        token={token}
        organizationName={context.organizationName}
        recipientName={context.recipientName}
      />
    );
  }

  if (context.fillSubmitted) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-neutral-500">{context.organizationName}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Gegevens ontvangen</h1>
          <p className="mt-2 text-neutral-600">
            Dank je, {context.recipientName}. Je gegevens zijn opgeslagen. Ondertekenen volgt in een
            volgende stap.
          </p>
        </div>
        <Link href={`/f/${token}/preview`} className="text-sm text-neutral-900 underline">
          Ingevuld PDF bekijken
        </Link>
      </section>
    );
  }

  const fillable = fillableFields(context.snapshot);

  if (fillable.length === 0) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Niets in te vullen</h1>
        <p className="text-neutral-600">
          Dit document heeft alleen een handtekeningveld. Ondertekenen volgt later.
        </p>
      </section>
    );
  }

  return (
    <PublicFormFill
      token={token}
      organizationName={context.organizationName}
      recipientName={context.recipientName}
      snapshot={context.snapshot}
      values={context.values}
    />
  );
}
