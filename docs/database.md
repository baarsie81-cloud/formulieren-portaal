# Database

This phase does **not** connect a live database at build time. Runtime uses `DATABASE_URL`. After Clerk sign-in, `requireTenant()` inserts the organization, user, and membership if they do not exist yet.

The signed final PDF is the primary audit document. These tables are the register and index, not a substitute for that file.

## Principles

- Multi-tenant: every tenant-owned table has `organization_id`.
- Queries must use `organization_id` plus `id`. Unique `(organization_id, id)` exists so child foreign keys can enforce the same tenant.
- Exceptions without `organization_id`: `organizations` (the tenant) and `users` (a person can belong to multiple organizations).
- UUID primary keys. Timestamps are `timestamptz` (UTC). Display in `Europe/Amsterdam`.
- Foreign keys use `ON DELETE RESTRICT`. Do not cascade-delete audit evidence.
- No quote, price, VAT, catalog, or CRM/EPD fields.

## Tables

### `organizations`

Tenant / practice.

- `clerk_organization_id` unique (auth mapping later)
- `name`, `created_at`, `archived_at`

### `users`

Internal staff projection. Not clients.

- `clerk_user_id` unique
- `email`, `display_name`

### `organization_members`

User–organization membership.

- `role`: `admin` | `member`
- unique `(organization_id, user_id)`
- `revoked_at` for soft removal

### `clients`

Minimal addressee. Not a medical record.

- `display_name`, `email`, `phone`, `external_reference`
- unique `(organization_id, email)` while not archived
- name/email may change later; **requests snapshot** recipient fields at send time

### `document_templates`

Fixed PDF templates (not a form builder). The PDF bytes are immutable after upload.

- `blob_key`: private Blob **pathname** `{organization_id}/templates/{template_id}/{sha256}.pdf`
- `sha256`: hex digest of the stored bytes (content version)
- `status` `active` | `archived`
- replacing a PDF is a new template; sent requests snapshot `blob_key` + `sha256` on `form_documents`

### `document_fields`

Technical mapping of existing PDF fields: name, type, optional position, validation.

- belongs to one template via composite FK `(organization_id, document_template_id)`
- unique `(document_template_id, pdf_field_name)`
- `field_type`: `text` | `textarea` | `date` | `checkbox` | `number` | `signature_area`

### `form_requests`

One send-flow to one client. Status unit for the link and reminders.

- snapshots: `recipient_name`, `recipient_email`
- `status`: `sent` | `opened` | `in_progress` | `completed` | `expired` | `cancelled`
- composite FK to `clients`

### `form_documents`

One PDF inside a request. Holds template snapshot, working `field_values`, and **final PDF metadata**.

- `template_blob_key`, `template_sha256`, `fields_schema_snapshot` frozen at send
- `final_pdf_blob_key`, `final_pdf_sha256`, `finalized_at`
- check: `finalized` requires blob key, SHA-256, and timestamp; other statuses require those to be null
- the file itself lives in private object storage; this row is the pointer

### `form_sessions`

Fill session opened via a secure token.

- `nonce_hash`, `ip_hash` (HMAC, not raw IP), `user_agent`

### `signatures`

Append-only visual or typed signature. One per document in V1.

### `acceptances`

Append-only legal agreement. Stores the exact `declaration_text` and `accepted_at`.

### `secure_tokens`

Capability to open the public link. Store **only** `token_hash`, never the raw token.

- unique hash
- at most one active (non-revoked) token per request

### `audit_events`

Append-only domain events. Do not put `field_values` in `metadata`.

### `email_events`

Provider webhook log. Unique `(provider_message_id, event_type)` for idempotent retries.

### `reminder_rules`

Organization defaults: `delay_hours` + `sequence`.

### `reminder_deliveries`

Actual reminder attempts. Unique `(form_request_id, sequence)`.

## Relations

```
organizations 1──* organization_members *──1 users
organizations 1──* clients | document_templates | form_requests | reminder_rules
clients 1──* form_requests
document_templates 1──* document_fields
document_templates 1──* form_documents
form_requests 1──* form_documents | form_sessions | secure_tokens | reminder_deliveries
form_documents 1──0..1 signatures
form_documents 1──0..1 acceptances
form_sessions 1──* signatures | acceptances
secure_tokens 1──* form_sessions
reminder_rules 1──* reminder_deliveries
```

Child rows that belong to a tenant parent use composite foreign keys `(organization_id, parent_id)`.

## Immutable rules

Always append-only (no update/delete): `signatures`, `acceptances`, `audit_events`, `email_events`.

After `form_documents.status = finalized`:

- `field_values`
- `template_blob_key`, `template_sha256`, `fields_schema_snapshot`
- `final_pdf_blob_key`, `final_pdf_sha256`, `finalized_at`
- `status` (must stay `finalized`)

Also frozen from send time on `form_requests`: `recipient_name`, `recipient_email`, `sent_at`, `expires_at`.

Application code must refuse writes after finalize. The first migration also installs database triggers so the database rejects forbidden updates/deletes even if application code is wrong.

Do not regenerate an official PDF after finalize. Serve the stored bytes and compare SHA-256 on download.

## Security

- Derive `organization_id` from the authenticated server session, never from a client body alone.
- Public access: look up `token_hash` → one request. Do not list by organization on the public route.
- Blob paths should be prefixed with `{organization_id}/...`. Never accept a `blob_key` from the client. Downloads go through an authenticated route that re-hashes the bytes and compares them to `sha256`.
- Raw tokens and raw IP addresses are not stored.
- No secrets in the repository. `DATABASE_URL` stays in `.env.local` after Neon is connected.

## Migrations

SQL files live in `src/server/db/migrations`. Generate with `pnpm db:generate`. Do not apply them until Neon is connected.
