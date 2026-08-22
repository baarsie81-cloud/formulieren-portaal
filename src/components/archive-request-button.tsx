"use client";

import { archiveFormRequestAction } from "@/server/forms/actions";

export function ArchiveRequestButton({ requestId }: { requestId: string }) {
  return (
    <form
      action={archiveFormRequestAction}
      onSubmit={(event) => {
        if (!window.confirm("Dit verzoek archiveren?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
      >
        Archiveren
      </button>
    </form>
  );
}
