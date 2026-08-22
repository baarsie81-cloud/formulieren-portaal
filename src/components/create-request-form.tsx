"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { DocumentCategory } from "@/lib/constants";
import {
  createFormRequestAction,
  loadRequestMailDefaultsAction,
  type RequestFormState,
} from "@/server/forms/actions";

type RequestMailDefaults = NonNullable<
  Awaited<ReturnType<typeof loadRequestMailDefaultsAction>>
>;

type Option = { id: string; label: string; extra?: string; category?: DocumentCategory };

const initialState: RequestFormState = { error: null };

export function CreateRequestForm({
  clients,
  templates,
  defaultClientId,
  emailEnabled,
}: {
  clients: Option[];
  templates: Option[];
  defaultClientId?: string;
  emailEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(createFormRequestAction, initialState);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [templateId, setTemplateId] = useState("");
  const [mailDefaults, setMailDefaults] = useState<RequestMailDefaults | null>(null);
  const [invitationSubject, setInvitationSubject] = useState("");
  const [invitationBody, setInvitationBody] = useState("");
  const [confirmationSubject, setConfirmationSubject] = useState("");
  const [confirmationBody, setConfirmationBody] = useState("");
  const [mailError, setMailError] = useState<string | null>(null);
  const [loadingMail, startMailTransition] = useTransition();

  useEffect(() => {
    if (!clientId || !templateId) {
      setMailDefaults(null);
      setMailError(null);
      return;
    }

    startMailTransition(async () => {
      const defaults = await loadRequestMailDefaultsAction(clientId, templateId);

      if (!defaults) {
        setMailDefaults(null);
        setMailError("Kon de e-mailconcepten niet laden. Controleer cliënt en sjabloon.");
        return;
      }

      setMailDefaults(defaults);
      setInvitationSubject(defaults.invitationSubject);
      setInvitationBody(defaults.invitationBody);
      setConfirmationSubject(defaults.confirmationSubject);
      setConfirmationBody(defaults.confirmationBody);
      setMailError(null);
    });
  }, [clientId, templateId]);

  const mailReady = Boolean(clientId && templateId && mailDefaults && !loadingMail);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="clientId" className="text-sm font-medium text-neutral-800">
            Cliënt
          </label>
          <select
            id="clientId"
            name="clientId"
            required
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
          >
            <option value="" disabled>
              Kies een cliënt
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.label}
                {client.extra ? ` (${client.extra})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="templateId" className="text-sm font-medium text-neutral-800">
            PDF-sjabloon
          </label>
          <select
            id="templateId"
            name="templateId"
            required
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
          >
            <option value="" disabled>
              Kies een sjabloon
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mailError ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
          {mailError}
        </p>
      ) : null}

      {loadingMail ? (
        <p className="text-sm text-neutral-600">E-mailconcepten laden…</p>
      ) : null}

      {mailReady && mailDefaults ? (
        <section className="flex flex-col gap-4 rounded-md border border-neutral-200 bg-white p-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">Formuliertype</p>
            <p className="mt-1 text-sm text-neutral-700">
              {mailDefaults.documentCategoryLabel}
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                {mailDefaults.documentCategory}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">Uitnodiging</h2>
            <div className="flex flex-col gap-1">
              <label htmlFor="invitationSubject" className="text-sm font-medium text-neutral-800">
                Onderwerp
              </label>
              <input
                id="invitationSubject"
                name="invitationSubject"
                required
                value={invitationSubject}
                onChange={(event) => setInvitationSubject(event.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="invitationBody" className="text-sm font-medium text-neutral-800">
                Bericht
              </label>
              <textarea
                id="invitationBody"
                name="invitationBody"
                required
                rows={8}
                value={invitationBody}
                onChange={(event) => setInvitationBody(event.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-neutral-900">Bevestiging na ondertekening</h2>
            <p className="text-sm text-neutral-600">
              Deze tekst wordt opgeslagen en pas verstuurd nadat de cliënt succesvol heeft getekend.
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirmationSubject" className="text-sm font-medium text-neutral-800">
                Onderwerp
              </label>
              <input
                id="confirmationSubject"
                name="confirmationSubject"
                required
                value={confirmationSubject}
                onChange={(event) => setConfirmationSubject(event.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="confirmationBody" className="text-sm font-medium text-neutral-800">
                Bericht
              </label>
              <textarea
                id="confirmationBody"
                name="confirmationBody"
                required
                rows={6}
                value={confirmationBody}
                onChange={(event) => setConfirmationBody(event.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
              />
            </div>
          </div>
        </section>
      ) : null}

      <p className="text-sm text-neutral-600">
        {emailEnabled
          ? "Na het aanmaken ontvangt de cliënt direct de uitnodiging per e-mail. De bevestiging volgt na ondertekening."
          : "Er wordt een beveiligde link gemaakt; e-mail is nog niet geconfigureerd."}{" "}
        Het PDF-ontwerp blijft ongewijzigd; de cliënt vult de bestaande AcroForm-velden in.
      </p>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending || !mailReady}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Versturen…" : emailEnabled ? "Versturen" : "Link maken"}
        </button>
        <Link href="/dashboard/requests" className="text-sm text-neutral-600 hover:text-neutral-950">
          Annuleren
        </Link>
      </div>
    </form>
  );
}
