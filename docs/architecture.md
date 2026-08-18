# Architecture

## Stack

- Next.js 16 App Router
- TypeScript (strict)
- React
- Tailwind CSS
- pnpm
- Node.js 24
- ESLint
- Vitest
- Drizzle ORM (schema in `src/server/db`; Neon runtime via lazy `getDb()`)
- Clerk Organizations (session, tenant projection, dashboard)
- pdf-lib
- zod

## Principles

- Server-first: default to Server Components and server-side logic.
- Security by default: no secrets in the repository, no real personal data in demo or test data.
- Dutch UI copy; English code, file names, and technical identifiers.
- Timezone: `Europe/Amsterdam`.
- Keep the foundation small. Do not add unused infrastructure or speculative features.

## Application (phase 3)

Staff dashboard at `/dashboard`. The first domain workflow is **organization + client**:

1. Sign in with Clerk.
2. Select or create a Clerk organization (practice).
3. `requireTenant()` projects that organization, user, and membership into Postgres.
4. Add and manage clients for that organization only.

Not in this phase: sending forms, filling, signing, PDF generation, or export.

See [database.md](./database.md) for the V1 data model.
See [auth.md](./auth.md) and [security.md](./security.md) for Clerk mapping and tenant rules.
