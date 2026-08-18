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
- Clerk Organizations (session + `src/proxy.ts`; no user sync yet)
- pdf-lib
- zod

## Principles

- Server-first: default to Server Components and server-side logic.
- Security by default: no secrets in the repository, no real personal data in demo or test data.
- Dutch UI copy; English code, file names, and technical identifiers.
- Timezone: `Europe/Amsterdam`.
- Keep the foundation small. Do not add unused infrastructure or speculative features.

See [database.md](./database.md) for the V1 data model.
See [auth.md](./auth.md) and [security.md](./security.md) for Clerk mapping and tenant rules.
