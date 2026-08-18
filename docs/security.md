# Security

## Tenant isolation

- The active organization always comes from the **server-side Clerk session** (`auth().orgId`).
- Never trust `organization_id`, `orgId`, or similar values from a request body, query string, or client component.
- Resolve our UUID with `requireTenant()` / `requireDashboardContext()`. Pass that `organizationId` into every query.
- Every tenant query must be scoped: `organization_id` plus row `id` (see the database unique `(organization_id, id)` keys). Client lookups use `clientInOrganization(organizationId, clientId)`. Template lookups use `templateInOrganization(organizationId, templateId)`.
- Missing or cross-tenant clients, templates, or form requests are `NotFoundError` (404). Do not reveal that a row exists in another tenant.
- Public token links look up `token_hash` → one request. They must not list by organization. Raw tokens are never stored.
- Public form sessions bind a nonce cookie to that token. IP is stored as HMAC (`ip_hash`), never raw. Do not put field values in audit metadata.

## Database access

- Import `getDb()` only from server code (`src/server/**`, Server Components, Server Actions, Route Handlers).
- `getDb()` creates the pool lazily. Importing the module during build does not connect.
- Missing `DATABASE_URL` throws only when `getDb()` is called.
- The client bundle must not import `src/server/db` or `src/server/env` (`server-only`).

## Auth errors

`AuthError` is 401 (not signed in) or 403 (no active organization / unsupported role). Callers should turn that into an HTTP response or redirect; do not leak whether a row exists in another tenant.

## Object storage

- Template PDFs live in a **private** Vercel Blob store. Public blob URLs must never be rendered in the UI.
- Pathnames are `{organization_id}/templates/{template_id}/{sha256}.pdf`. Construction uses UUIDs + hex SHA-256 only.
- Before `get()`, verify the stored `blob_key` equals that canonical path for the tenant row.
- Serve template files only from `/dashboard/templates/[templateId]/file` after `requireDashboardContext()`. Filled previews go through `/dashboard/requests/[requestId]/preview` (staff) or `/f/[token]/preview` (valid token + session cookie). Re-hash template bytes and compare to `sha256` before filling.
- `BLOB_READ_WRITE_TOKEN` is server-only (local). On Vercel, OIDC + `BLOB_STORE_ID` may be used instead.

## Secrets

- Real values live in `.env.local` or the host environment. Never commit them.
- `CLERK_SECRET_KEY`, `DATABASE_URL`, and `BLOB_READ_WRITE_TOKEN` are server-only.
- `HMAC_SECRET` (optional; falls back to `CLERK_SECRET_KEY`) is used to HMAC client IPs. It is server-only.

## Audit / PII

- Do not put `field_values`, raw tokens, or client field values in `audit_events.metadata`.
- Client mutations may store `changedFields` (field names only). Template field updates may store `changedCount`, not keys or values.
- Store IP as HMAC (`ip_hash`), never raw IP.
