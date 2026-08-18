"use client";

import { archiveClientAction } from "@/server/clients/actions";

export function ArchiveClientButton({ clientId }: { clientId: string }) {
  return (
    <form
      action={archiveClientAction}
      onSubmit={(event) => {
        if (!window.confirm("Deze cliënt archiveren?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <button
        type="submit"
        className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
      >
        Archiveren
      </button>
    </form>
  );
}
