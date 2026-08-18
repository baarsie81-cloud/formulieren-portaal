import { redirect } from "next/navigation";
import { OrganizationPicker } from "@/components/organization-picker";
import { isClerkConfigured } from "@/lib/clerk";
import { AuthError, requireAuth } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function SelectOrganizationPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-neutral-600">Authenticatie is nog niet geconfigureerd.</p>
      </main>
    );
  }

  try {
    await requireAuth();
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/sign-in");
    }

    throw error;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Kies een praktijk</h1>
      <p className="max-w-md text-center text-neutral-600">
        Selecteer of maak een organisatie. Cliëntgegevens horen altijd bij één praktijk.
      </p>
      <OrganizationPicker />
    </main>
  );
}
