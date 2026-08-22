"use client";

import { restoreTemplateAction } from "@/server/templates/actions";

export function RestoreTemplateButton({ templateId }: { templateId: string }) {
  return (
    <form action={restoreTemplateAction}>
      <input type="hidden" name="templateId" value={templateId} />
      <button
        type="submit"
        className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
      >
        Herstellen
      </button>
    </form>
  );
}
