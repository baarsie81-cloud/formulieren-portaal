# Formulieren Portaal

Beveiligd beheer van cliëntformulieren.

## Vereisten

- Node.js 24 (zie `.nvmrc`)
- [pnpm](https://pnpm.io)

## Lokaal starten

1. Kopieer de omgevingsvariabelen:

   ```bash
   cp .env.example .env.local
   ```

2. Installeer dependencies:

   ```bash
   pnpm install
   ```

3. Start de development server:

   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000). Het dashboard staat op `/dashboard` (Clerk-organisatie + `DATABASE_URL` vereist). PDF-sjablonen vereisen daarnaast een private Vercel Blob-store (`BLOB_READ_WRITE_TOKEN`). Publieke cliëntlinks staan op `/f/[token]`.

## Scripts

| Script | Beschrijving |
| --- | --- |
| `pnpm dev` | Start de development server |
| `pnpm build` | Maak een productiebuild |
| `pnpm lint` | Draai ESLint |
| `pnpm typecheck` | Controleer TypeScript (`tsc --noEmit`) |
| `pnpm test` | Draai Vitest |

Zet echte secrets alleen in `.env.local`. Commit geen geheimen en geen echte persoonsgegevens.

Zie [docs/architecture.md](docs/architecture.md) voor stack en architectuurprincipes.
