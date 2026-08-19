# Email

## Provider

Formulierendesk uses [Resend](https://resend.com) for transactional email. All Resend API calls live in `src/server/email/client.ts`. Application code must call `sendEmail()` from `src/server/email` instead of importing Resend directly.

Production mail is sent from the verified domain `formulierendesk.nl`.

## Environment variables

| Variable | Scope | Description |
| --- | --- | --- |
| `RESEND_API_KEY` | server-only | Resend API key from the Resend dashboard |
| `EMAIL_FROM` | server-only | Sender address, e.g. `Formulierendesk <noreply@formulierendesk.nl>` |

Both variables are required before the app can send email. Use `isEmailConfigured()` to check availability without throwing.

Set real values in `.env.local` or the host environment. Never commit secrets.

## Architecture

```
src/server/email/
  client.ts   — Resend SDK wrapper (internal)
  send.ts     — sendEmail() entry point
  events.ts     — email_events logging helpers
  invitation.ts — form request invitation mail
  confirmation.ts — completion confirmation mails
  schema.ts     — zod validation for send input
  index.ts    — public exports
```

`sendEmail(db, input)`:

1. Validates input with zod
2. Sends through Resend using `EMAIL_FROM`
3. Appends a `sent` row to `email_events` with the provider message id

Delivery, bounce, complaint, and open events will be recorded later via a Resend webhook (not implemented in phase 7.1).

## Security

- `RESEND_API_KEY` and `EMAIL_FROM` are server-only. Do not expose them to the client bundle.
- Import email code only from `src/server/**`, Server Components, Server Actions, or Route Handlers.
- Do not put form field values, raw tokens, or other sensitive client data in email bodies unless a later phase explicitly requires it and documents the retention rules.
- `email_events` stores provider message ids and recipient addresses for audit and support. Treat recipient email as personal data.
- The unique constraint on `(provider_message_id, event_type)` makes webhook retries idempotent.

## Future mailflows (not in phase 7.1)

| Flow | Trigger | Recipient |
| --- | --- | --- |
| Form invitation | Staff creates a form request | Client | Phase 7.2 |
| Fill confirmation | Client submits the form | Client | Not implemented |
| Completion confirmation | Document finalized | Client | Phase 7.3 |
| Staff notification | Document finalized | Organization member | Phase 7.3 |
| Reminder | Reminder rule schedule | Client | Not implemented |

Phase 7.2 sends a form invitation when staff create a form request and email is configured. If sending fails, the form request and token remain unchanged; staff can copy the link from the dashboard.

Phase 7.3 sends a client confirmation and a staff notification after successful finalize. Emails are triggered from the public sign action after `signAndFinalizePublicForm()` completes. If email sending fails, the finalized document remains valid and the client still reaches the completion page. A retry after finalize does not send duplicate mail because signing is rejected once the document is finalized.
