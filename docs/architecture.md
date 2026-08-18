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

## Document templates (V1 product decision)

Formulierendesk ondersteunt **uitsluitend** professioneel ontworpen PDF-documenten met bestaande **AcroForm**-velden. Dit is een definitieve V1-productkeuze, geen tijdelijke beperking.

### Buiten Formulierendesk (klant / ontwerper)

De PDF wordt **buiten** Formulierendesk gemaakt en voorbereid, bijvoorbeeld met:

- Microsoft Word
- Adobe InDesign
- Adobe Acrobat Pro

Daarna moet de PDF **interactieve AcroForm-velden** bevatten (tekst, keuzevak, handtekeninggebied, enz.). Formulierendesk tekent, converteert of ontwerpt die velden niet.

### In Formulierendesk (workflow)

1. PDF uploaden naar Formulierendesk.
2. Bestaande AcroForm-velden **uitlezen** (pdf-lib).
3. Velden koppelen aan de workflow (`pdf_field_name` → `value_key`, type, verplicht, volgorde).
4. Gegevens invullen via de beveiligde cliëntlink (bestaande AcroForm-velden).
5. Later (andere fase): ondertekenen, definitief audit-PDF genereren.

De SHA-256 van de opgeslagen PDF-bytes is de inhoudsversie. Template-PDF’s zijn onwijzigbaar na upload. Een nieuwe versie is een nieuw sjabloon (archiveer het oude).

Private object storage (Vercel Blob) bewaart het bestand. De database bewaart pathname (`blob_key`) en hash, niet de bytes.

### V1 vereiste: AcroForm

- **AcroForm is verplicht.** Een PDF zonder invulbare AcroForm-velden voldoet niet aan V1.
- Upload van zo’n PDF wordt **afgewezen** met een duidelijke melding aan de medewerker (geen stille acceptatie, geen automatische conversie).
- Velden worden **niet** in Formulierendesk aangemaakt; `document_fields` komt alleen uit wat in het PDF staat.

### Formulierendesk is wél verantwoordelijk voor

- Veilige opslag (private Blob, tenant-scoped paden)
- Workflow rondom het PDF
- Veldmapping (bestaande AcroForm → workflow-sleutels)
- Invullen van bestaande AcroForm-velden via de publieke tokenlink
- Ondertekenen (latere fase)
- Auditdocument (definitief PDF + hash, latere fase)

### Formulierendesk is níet verantwoordelijk voor

- Ontwerp of layout van het PDF
- Nieuwe velden tekenen of plaatsen
- PDF-editor, formulierbouwer, drag/drop designer
- Automatische PDF-conversie (bijv. platte PDF → AcroForm)
- Alternatieve veldmapping buiten AcroForm om

## Application (phase 5)

Staff dashboard at `/dashboard`. Domain workflows so far:

1. Sign in with Clerk and select a Clerk organization (practice).
2. `requireTenant()` projects that organization, user, and membership into Postgres.
3. Add and manage clients for that organization only.
4. Upload an existing professionally designed PDF with AcroForm fields as a **document template**.
5. Map the PDF’s existing AcroForm fields (`pdf_field_name` → `value_key` / type). The PDF itself is not edited.
6. Create a **form request** for one client and one template. A high-entropy token is generated; only `token_hash` is stored.
7. The client opens `/f/[token]`, starts a form session (httpOnly nonce cookie), fills the existing AcroForm fields, and saves values. Submitting the fill prepares signing (next phase).

Not in this phase: signing, final audit-PDF generation, reminders, or sending e-mail.

See [database.md](./database.md) for the V1 data model.
See [auth.md](./auth.md) and [security.md](./security.md) for Clerk mapping and tenant rules.
