"use client";

import { cancelFormRequestAction } from "@/server/forms/actions";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  return (
    <form
      action={cancelFormRequestAction}
      onSubmit={(event) => {
        if (!window.confirm("Dit verzoek annuleren? De cliëntlink stopt dan meteen.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
      >
        Annuleren
      </button>
    </form>
  );
}
