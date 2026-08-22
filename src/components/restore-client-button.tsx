"use client";

import { restoreClientAction } from "@/server/clients/actions";

export function RestoreClientButton({ clientId }: { clientId: string }) {
  return (
    <form action={restoreClientAction}>
      <input type="hidden" name="clientId" value={clientId} />
      <button
        type="submit"
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
      >
        Herstellen
      </button>
    </form>
  );
}
