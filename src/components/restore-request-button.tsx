"use client";

import { restoreFormRequestAction } from "@/server/forms/actions";

export function RestoreRequestButton({ requestId }: { requestId: string }) {
  return (
    <form action={restoreFormRequestAction}>
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
      >
        Herstellen
      </button>
    </form>
  );
}
