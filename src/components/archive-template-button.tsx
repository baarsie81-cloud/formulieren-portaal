"use client";

import { archiveTemplateAction } from "@/server/templates/actions";

export function ArchiveTemplateButton({ templateId }: { templateId: string }) {
  return (
    <form
      action={archiveTemplateAction}
      onSubmit={(event) => {
        if (!window.confirm("Dit sjabloon archiveren?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="templateId" value={templateId} />
      <button
        type="submit"
        className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
      >
        Archiveren
      </button>
    </form>
  );
}
