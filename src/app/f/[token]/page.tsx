import { InvalidFormLink } from "@/components/invalid-form-link";
import { PublicFormFill } from "@/components/public-form-fill";
import { PublicFormSign } from "@/components/public-form-sign";
import { PublicFormStart } from "@/components/public-form-start";
import { PUBLIC_FORM_INVALID_MESSAGE } from "@/lib/constants";
import { TokenAccessError } from "@/server/errors";
import { getPublicFormContext } from "@/server/forms/public";
import { parseRawToken } from "@/server/forms/schema";

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

  if (context.finalized) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Formulier afgerond</h1>
        <p className="text-neutral-600">
          Dit formulier is al definitief ondertekend. Neem contact op met de praktijk als je
          vragen hebt.
        </p>
      </section>
    );
  }

  if (context.readyForSigning) {
    return (
      <PublicFormSign
        token={token}
        organizationName={context.organizationName}
        recipientName={context.recipientName}
      />
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
