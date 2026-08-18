"use client";

import { rotateFormRequestTokenAction } from "@/server/forms/actions";

export function RotateLinkButton({ requestId }: { requestId: string }) {
  return (
    <form
      action={rotateFormRequestTokenAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Een nieuwe link maken? De oude link en open sessies stoppen dan meteen.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
      >
        Nieuwe link maken
      </button>
    </form>
  );
}
