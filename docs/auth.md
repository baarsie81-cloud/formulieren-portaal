# Auth

Clerk Organizations is the identity layer. The database stores local projections keyed by Clerk IDs.

## Mapping

```
Clerk organization.id
        ↓
    organizations.clerk_organization_id

Clerk user.id
        ↓
users.clerk_user_id
```

Helpers: `organizationByClerkId()` and `userByClerkId()` in `src/server/db/clerk-mapping.ts`.

Clerk organization roles map to app roles:

| Clerk | App |
| --- | --- |
| `org:admin` | `admin` |
| `org:member` | `member` |

## Server helpers

Use only on the server.

- `requireAuth()` — requires a signed-in Clerk user. Returns `clerkUserId`. Throws `AuthError` 401 otherwise.
- `requireOrganization()` — requires a signed-in user **and** an active Clerk organization. Returns `clerkUserId`, `clerkOrganizationId`, and `role`. Throws 401 without a user, 403 without an organization or with an unknown role.
- `requireTenant()` — calls `requireOrganization()`, then upserts the local organization, user, and membership. Returns those IDs plus `organizationId` (our UUID) and `userId`. Deduped per request with React `cache()`.
- `requireDashboardContext()` — `requireTenant()` with redirects: 401 → `/sign-in`, 403 → `/select-organization`.

`organization_id` (our UUID) is **not** taken from the request body, query string, or client component. Resolve it only via `requireTenant()`.

Tenant sync is lazy (on dashboard use), not via Clerk webhooks. Clerk remains the source of membership. Personal Clerk accounts are hidden (`hidePersonal`); this product is organization-only.

Archived local organizations are rejected (403).

## Proxy

Next.js 16 uses `src/proxy.ts` (replacement for `middleware.ts`). `clerkMiddleware()` attaches the session.

Public routes: `/`, `/sign-in`, `/sign-up`. Everything else, including `/dashboard` and `/select-organization`, requires a signed-in user when Clerk keys are present. An organization is required only in the dashboard layout, not on `/select-organization`.

Public form-token links (later) must be added to the public matcher. They must look up `token_hash`, not list by organization.

If Clerk keys are missing (local build without secrets), the proxy is a no-op so `pnpm build` does not require credentials.
