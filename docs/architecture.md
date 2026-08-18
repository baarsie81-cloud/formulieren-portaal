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
- Vercel Blob (private)

## Principles

- Server-first: default to Server Components and server-side logic.
- Security by default: no secrets in the repository, no real personal data in demo or test data.
- Dutch UI copy; English code, file names, and technical identifiers.
- Timezone: `Europe/Amsterdam`.
- Keep the foundation small. Do not add unused infrastructure or speculative features.

## Application (phase 4)

Staff dashboard at `/dashboard`. Domain workflows so far:

1. Sign in with Clerk and select a Clerk organization (practice).
2. `requireTenant()` projects that organization, user, and membership into Postgres.
3. Add and manage clients for that organization only.
4. Upload an existing professionally designed PDF as a **document template**.
5. Map the PDF’s existing AcroForm fields (`pdf_field_name` → `value_key` / type). The PDF itself is not edited.

The SHA-256 of the stored PDF bytes is the content version. Template PDFs are immutable after upload. A new version is a new template (archive the old one).

Private object storage (Vercel Blob) holds the file. The database stores the pathname (`blob_key`) and hash, not the bytes.

Not in this phase: sending forms, filling, signing, final PDF generation, or export.

This product is **not** a form builder, PDF editor, or form designer.

See [database.md](./database.md) for the V1 data model.
See [auth.md](./auth.md) and [security.md](./security.md) for Clerk mapping and tenant rules.
