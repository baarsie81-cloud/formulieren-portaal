# Security

## Tenant isolation

- The active organization always comes from the **server-side Clerk session** (`auth().orgId`).
- Never trust `organization_id`, `orgId`, or similar values from a request body, query string, or client component.
- Every tenant query must be scoped: `organization_id` plus row `id` (see the database unique `(organization_id, id)` keys).
- Public token links (later) look up `token_hash` → one request. They must not list by organization.

## Database access

- Import `getDb()` only from server code (`src/server/**`, Server Components, Server Actions, Route Handlers).
- `getDb()` creates the pool lazily. Importing the module during build does not connect.
- Missing `DATABASE_URL` throws only when `getDb()` is called.
- The client bundle must not import `src/server/db` or `src/server/env` (`server-only`).

## Auth errors

`AuthError` is 401 (not signed in) or 403 (no active organization / unsupported role). Callers should turn that into an HTTP response; do not leak whether a row exists in another tenant.

## Secrets

- Real values live in `.env.local` or the host environment. Never commit them.
- `CLERK_SECRET_KEY` and `DATABASE_URL` are server-only.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is the only Clerk key allowed in the browser.

## Audit / PII

- Do not put `field_values` or raw tokens in `audit_events.metadata`.
- Store IP as HMAC (`ip_hash`), never raw IP.
