import { readAndClearFormSignedCookie } from "@/server/forms/cookie";

export const dynamic = "force-dynamic";

export default async function FormSignedPage() {
  const recipientName = await readAndClearFormSignedCookie();

  if (!recipientName) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Geen actieve bevestiging</h1>
        <p className="text-neutral-600">
          Deze pagina is alleen beschikbaar direct na het afronden van een formulier.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Formulier afgerond</h1>
        <p className="mt-2 text-neutral-600">
          Dank je, {recipientName}. Je handtekening is ontvangen. De praktijk heeft het
          definitieve document ontvangen. Je kunt dit venster sluiten.
        </p>
      </div>
    </section>
  );
}
