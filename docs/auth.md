# Auth

Clerk Organizations is the identity layer. The database stores local projections keyed by Clerk IDs. This phase does **not** sync users or organizations automatically.

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

Use only on the server (`src/server/auth/session.ts`).

- `requireAuth()` — requires a signed-in Clerk user. Returns `clerkUserId`. Throws `AuthError` 401 otherwise.
- `requireOrganization()` — requires a signed-in user **and** an active Clerk organization. Returns `clerkUserId`, `clerkOrganizationId`, and `role`. Throws 401 without a user, 403 without an organization or with an unknown role.

`organization_id` (our UUID) is **not** taken from the request body. After a later sync step, resolve it with `organizationByClerkId(clerkOrganizationId)` and then scope every query.

## Proxy

Next.js 16 uses `src/proxy.ts` (replacement for `middleware.ts`). `clerkMiddleware()` attaches the session. `/api/*` is protected with `auth.protect()` when Clerk keys are present.

The public homepage stays reachable. There is no dashboard or sign-in UI in this phase; Clerk Account Portal can host sign-in when keys are configured.

If Clerk keys are missing (local build without secrets), the proxy is a no-op so `pnpm build` does not require credentials.
