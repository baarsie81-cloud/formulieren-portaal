"use client";

import { useState } from "react";

export function CopyFormLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="form-link" className="text-sm font-medium text-neutral-800">
        Beveiligde cliëntlink
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="form-link"
          readOnly
          value={url}
          className="w-full rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 font-mono text-xs"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {copied ? "Gekopieerd" : "Kopiëren"}
        </button>
      </div>
      <p className="text-sm text-neutral-600">
        Deze ruwe link is alleen kort zichtbaar na aanmaken. De ruwe token wordt niet opgeslagen.
      </p>
    </div>
  );
}
