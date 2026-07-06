# Fiat Lux — Postais de Aniversário — Implementation Plan

> **For the executor (Sonnet 5):** This document is self-contained. Read it fully before
> writing code. The `design-system/` folder is the **visual source of truth** — open the files
> it references and match them exactly. Do **not** invent UI; port what already exists. When a
> value (color, size, position, text) is given here, use it verbatim. Build in the order of the
> **Phases** section; each phase has **acceptance criteria** — do not move on until they pass.

---

## CURRENT STATUS (read this first if picking up mid-build)

**Phases 0–8 are done, working, and verified** (typecheck clean + exercised live in a real
browser via claude-in-chrome — not just "written"). **Phase 9 (Dockerize + deploy) is in
progress. Phase 10 (final verify) has not started.**

What exists right now, concretely:
- Full monorepo at the repo root: `apps/api` (Fastify), `apps/web` (React/Vite), `packages/shared`.
- SQLite DB seeded with the real 140 members (`apps/api/prisma/dev.db` locally — gitignored;
  `apps/api/prisma/seed.sql` is the committed, regenerable seed artifact, see §9).
- Members CRUD, postcard PDF generation (visually verified against the church's reference PDF),
  Agendamentos scheduling (idempotent daily job, mark-sent, resend), Settings (SMTP encrypted at
  rest, test-email), push notifications (VAPID, subscribe/notify, graceful failure handling),
  Dashboard (stat tiles + monthly chart + recent sends), PWA basics (manifest, generated icons,
  minimal service worker, installable).
- Local dev servers run via `pnpm --filter @ffl/api exec tsx watch src/server.ts` (port 3000) and
  `pnpm --filter @ffl/web exec vite` (port 5173) — both were confirmed healthy as of this note.
- Every "found during build" deviation from the original plan is called out inline below as an
  **Implementation note** or **Decision** — read those; they document real gotchas (Prisma 7's
  driver-adapter requirement, a Fastify empty-JSON-body bug, an accent-insensitive search bug,
  the dropped Workbox/vite-plugin-pwa dependency, the skipped font self-hosting) that would
  otherwise resurface if re-derived from scratch.

**What's next (Phase 9, in progress):** the user just provisioned a fresh OVH VPS (Debian, Docker
pre-installed) and pointed `ffl.pt` at it via DNS A record. An SSH MCP server (`ssh-mcp`) was
added to the project's `.mcp.json` to reach it — **credentials live only in `.mcp.json`
(gitignored), not repeated here.** That MCP server needs a session reload to become available
(added mid-session; MCP servers load at session start). Once available: build the Docker
artifacts below (Dockerfile, compose files, Caddyfile), then use SSH to actually deploy to the
VPS and verify `https://ffl.pt` end to end — this plan was written to be tested for real, not
just written and hoped about.

**Task list note:** a task-tracking list (11 tasks, one per phase) existed in the conversation
this was written from. If it's not visible after a session restart, treat the phase list in
§15 below as the authoritative to-do — recreate tasks #1–8 as completed and #9–10 as the
remaining work.

---

## 0. What we are building (context)

The **Fraternidade Fiat Lux** church sends a birthday postcard to each member on their birthday.
Today it's manual (edit a Word file → export PDF → email). We are automating it with a small
**mobile-first PWA** (used mainly on iPhone) that:

1. Stores all members in a database.
2. **Automatically emails** the postcard on a member's birthday (if they have an e-mail).
3. Shows **phone-only** members (no e-mail) as a **manual "send by WhatsApp"** list — the admin
   downloads the PDF and sends it by hand (there is **no** automated WhatsApp sending).
4. Has 4 pages: **Dashboard**, **Sócios** (members CRUD), **Agendamentos** (scheduling),
   **Definições** (settings).
5. Sends a **push notification** to registered devices whenever a postcard is emailed.
6. Has editable **SMTP** settings.
7. Deploys to a fresh **OVH VPS** via Docker, served at **https://ffl.pt** with automatic HTTPS.
8. Imports **140 real members** from the church's spreadsheet on first boot.

### Locked decisions (already agreed with the product owner)

| Topic | Decision | Consequence for you |
|---|---|---|
| Login | **No app login in v1** | Build an auth **seam** (one guard function all `/api` routes call) that currently returns `true`. Real login is added later without touching routes. Also ship a **commented-out Caddy Basic-Auth** block as an optional stopgap. |
| Domain / TLS | **ffl.pt** on OVH | Caddy provides automatic HTTPS. Hostname must be a single config value, not hardcoded everywhere. |
| Phone-only members | **Include manual WhatsApp channel** | ~half the members have no e-mail; they must appear in a manual list with a PDF download. |
| Initial data | **Import the 140 members** | Build a robust CSV cleaner (see §9) and seed on first boot. |

### Hard rules — do not get these wrong

- **Do NOT reuse `design-system/support.js`** — it is a proprietary preview runtime ("DCLogic").
  The `.dc.html` files are only a **visual reference**. Reimplement everything in real React.
- Members' data is **PII** (names, NIF tax-IDs, phones, birthdates). Never log it in full; never
  return the SMTP password from the API.
- Birthday matching is by **month + day only** (ignore year).
- Postcard sends must be **idempotent** — never email the same member twice in the same year.
- All date/time "today" logic uses timezone **Europe/Lisbon**.
- The PWA and push require **HTTPS** — only fully testable once ffl.pt is live.

---

## 1. Tech stack (use exactly this)

- **Monorepo**: pnpm workspaces → `apps/api`, `apps/web`, `packages/shared`.
- **Backend** (`apps/api`): Node 22, TypeScript, **Fastify 5**, **Prisma 6 + SQLite**,
  **node-cron**, **nodemailer**, **web-push**, **puppeteer**, **pino** (logs), **zod**,
  **dayjs** (+ utc/timezone plugins). *No CSV/XLSX library ships in the app* — the 140-member
  seed is generated once, offline, as plain SQL (see §9).
- **Frontend** (`apps/web`): React 18, TypeScript, **Vite 5**, **react-router-dom 6**,
  **@tanstack/react-query 5**, **react-hook-form** + **zod** + **@hookform/resolvers**,
  **vite-plugin-pwa** (Workbox).
- **Shared** (`packages/shared`): zod schemas + inferred TS types imported by both sides.
- **Deploy**: one multi-stage **Docker** image (Fastify serves the built SPA **and** the API
  **and** runs the cron in-process); **docker-compose** with a **Caddy** service for TLS;
  data on a named volume.

**Package manager**: pnpm. Enable via `corepack enable`.

---

## 2. Monorepo layout

```
ffl-aniv/
├─ PLAN.md                      (this file)
├─ README.md                    (deploy + ops docs — you write this in Phase 9)
├─ package.json                 (root; workspace scripts)
├─ pnpm-workspace.yaml
├─ .env.example
├─ .gitignore                   (node_modules, dist, *.db, .env, /data)
├─ Dockerfile
├─ docker-compose.yml
├─ docker-compose.dev.yml       (adds Mailpit for local email testing)
├─ Caddyfile
├─ design-system/               (KEEP as-is — reference only)
├─ packages/
│  └─ shared/
│     ├─ package.json
│     ├─ tsconfig.json
│     └─ src/
│        ├─ index.ts
│        ├─ member.ts           (zod schema + types)
│        ├─ settings.ts
│        ├─ send.ts
│        └─ channel.ts          (channelOf + labels — shared by both sides)
└─ apps/
   ├─ api/
   │  ├─ package.json
   │  ├─ tsconfig.json
   │  ├─ prisma/
   │  │  ├─ schema.prisma
   │  │  ├─ migrations/
   │  │  └─ seed.sql                          (generated ONCE offline from the church CSV — §9; run on first boot if DB empty)
   │  ├─ scripts/
   │  │  └─ generate-seed.mjs                 (one-off, NOT deployed — (re)builds prisma/seed.sql)
   │  ├─ seed-source/
   │  │  └─ FFL-SociosAtivos.csv              (original church CSV — reference/audit only)
   │  ├─ assets/
   │  │  ├─ postal-template.html             (copy of the automation template)
   │  │  └─ fundo-postal-aniv.png            (copy of the background)
   │  └─ src/
   │     ├─ server.ts
   │     ├─ config.ts
   │     ├─ db.ts                            (Prisma client singleton)
   │     ├─ bootSeed.ts                      (runs prisma/seed.sql via the sqlite3 CLI if Member table is empty)
   │     ├─ plugins/auth.ts
   │     ├─ lib/{channel.ts,dates.ts,crypto.ts,logger.ts,errors.ts}
   │     ├─ modules/
   │     │  ├─ members/{routes.ts,service.ts}
   │     │  ├─ sends/{routes.ts,service.ts}
   │     │  ├─ postcard/{render.ts}
   │     │  ├─ mail/{service.ts}
   │     │  ├─ push/{routes.ts,service.ts}
   │     │  ├─ settings/{routes.ts,service.ts}
   │     │  └─ dashboard/{routes.ts,service.ts}
   │     └─ jobs/scheduler.ts
   └─ web/
      ├─ package.json
      ├─ vite.config.ts
      ├─ index.html
      ├─ public/                             (icons, manifest, self-hosted fonts)
      └─ src/
         ├─ main.tsx
         ├─ App.tsx                          (router + Layout)
         ├─ theme.ts                         (design tokens — §7)
         ├─ api/{client.ts,hooks.ts}
         ├─ components/{Layout.tsx,Sidebar.tsx,TopBar.tsx,Card.tsx,ChannelBadge.tsx,
         │              Button.tsx,Modal.tsx,ConfirmDialog.tsx,Toast.tsx,StatTile.tsx,
         │              SearchInput.tsx,EmptyState.tsx}
         ├─ features/
         │  ├─ dashboard/DashboardPage.tsx
         │  ├─ members/{MembersPage.tsx,MemberModal.tsx}
         │  ├─ scheduling/AgendamentosPage.tsx
         │  └─ settings/SettingsPage.tsx
         └─ pwa/{register.ts,push.ts}
```

---

## 3. Environment variables (`.env.example`)

```dotenv
NODE_ENV=production
PORT=3000
APP_URL=https://ffl.pt
TZ=Europe/Lisbon

# SQLite lives on the mounted volume
DATA_DIR=/data
DATABASE_URL=file:/data/app.db

# AES-256-GCM key for encrypting the SMTP password at rest (32 bytes, base64).
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=

# Web Push (VAPID). Generate with: pnpm gen:vapid  (script in root package.json)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@ffl.pt

# Default hour (0-23, Europe/Lisbon) for the daily job if Settings has none yet
SEND_HOUR=8

# Import the 140 members on first boot if the DB is empty
SEED_ON_EMPTY=true

# In Docker we use the distro Chromium instead of downloading one
PUPPETEER_SKIP_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

`config.ts` loads these with `dotenv` and validates them with a zod schema; throw on missing
required keys (`ENCRYPTION_KEY`, `VAPID_*`, `DATABASE_URL`). Locally (dev) `PUPPETEER_SKIP_DOWNLOAD`
should be unset so puppeteer uses its bundled Chromium.

---

## 4. Database — Prisma schema (`apps/api/prisma/schema.prisma`)

> **Implementation note (found during Phase 0/1 build):** the installed Prisma major version was
> **7.x**, which changed the connection wiring from what older Prisma docs/tutorials describe:
> - `datasource db { url = env("DATABASE_URL") }` is **no longer valid** — schema.prisma's
>   `datasource` block only has `provider = "sqlite"`, nothing else.
> - `prisma generate` emits **readable TypeScript source** into `apps/api/src/generated/prisma/`
>   (not a prebuilt package under `node_modules/@prisma/client`). Import `PrismaClient` from
>   `./generated/prisma/client.js` (note the `.js` extension even though the source is `.ts` —
>   NodeNext ESM convention), not from `@prisma/client`.
> - The generated `PrismaClient` constructor now **requires a driver adapter** — there is no more
>   implicit "reads `DATABASE_URL` and connects" behavior baked into the client itself. For SQLite
>   we use `@prisma/adapter-better-sqlite3` (wraps the native `better-sqlite3` package):
>   ```ts
>   import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
>   import { PrismaClient } from './generated/prisma/client.js';
>   const adapter = new PrismaBetterSqlite3({ url: sqlitePath }); // plain fs path, NOT "file:..."
>   export const prisma = new PrismaClient({ adapter });
>   ```
>   **Important:** the adapter wants a **plain filesystem path** (`./prisma/dev.db`), not Prisma's
>   traditional `file:./prisma/dev.db` URL — strip the `file:` prefix yourself (see `config.ts`).
> - `prisma migrate dev` / `prisma migrate deploy` still work as before, but they now read the
>   connection string from a root-level **`prisma.config.ts`** (auto-generated by `prisma init`):
>   ```ts
>   import "dotenv/config";
>   import { defineConfig } from "prisma/config";
>   export default defineConfig({
>     schema: "prisma/schema.prisma",
>     migrations: { path: "prisma/migrations" },
>     datasource: { url: process.env["DATABASE_URL"] },
>   });
>   ```
>   This file **does** use the `file:...` URL form (that's a separate, CLI-only code path from the
>   runtime driver adapter above) — keep `DATABASE_URL` in `.env` as `file:...` everywhere; only
>   the runtime adapter needs the prefix stripped, and `config.ts` does that conversion in one place.
> - `apps/api/package.json`'s `build` script must still run `prisma generate` (it regenerates
>   `src/generated/prisma/`, which is gitignored — treat it like `dist/`, not checked-in source).
>   **Order matters: `prisma generate` must run *before* `tsc`**, not after — `tsc` needs those
>   generated files to already exist to resolve imports like `./generated/prisma/client.js`.
>   This bit during the Docker deploy (Phase 9): it worked locally by accident because the
>   generated client was already sitting on disk from earlier manual `prisma generate` runs, but
>   failed on a genuinely fresh checkout (no prior generate) with a wall of `Cannot find module
>   './generated/prisma/client.js'` plus a cascade of "implicit any" errors on anything whose
>   type depended on it. `build`/`dev`/`typecheck` all now run `prisma generate` first.
>
> If a later Prisma version changes this again, trust what `prisma init`/`prisma generate` actually
> produce over this note or over older Prisma tutorials.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }

model Member {
  id           String    @id @default(cuid())
  internalId   String    @unique            // "FFL-001"
  profaneName  String                        // stored UPPERCASE, required
  mysticName   String?
  birthDate    String?                       // ISO "YYYY-MM-DD"
  birthMonth   Int?                          // derived from birthDate for fast querying
  birthDay     Int?                          // derived from birthDate
  nif          String?                       // 9 digits, cleaned
  phoneNumber  String?                       // "+351 9XX XXX XXX"
  email        String?
  memberNumber String?                       // church's own number ("2969" / "Sócio Recente")
  notes        String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  sends        SendLog[]
  @@index([birthMonth, birthDay])
}

model SendLog {
  id        String   @id @default(cuid())
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  memberId  String
  year      Int
  channel   String                           // "email" | "whatsapp"
  status    String                           // "sent" | "failed" | "pending_manual" | "skipped"
  sentAt    DateTime?
  error     String?
  createdAt DateTime @default(now())
  @@unique([memberId, year])                 // idempotency — one row per member per year
  @@index([year, status])
}

model Settings {
  id            Int     @id @default(1)       // single row, always id=1
  smtpHost      String?
  smtpPort      Int?
  smtpSecure    Boolean @default(true)        // true=SSL(465), false=STARTTLS(587)
  smtpUser      String?
  smtpPassword  String?                        // AES-256-GCM ciphertext, never returned raw
  fromName      String  @default("Fraternidade Fiat Lux")
  fromEmail     String?
  replyTo       String?
  sendHour      Int     @default(8)            // 0-23, Europe/Lisbon
  pushEnabled   Boolean @default(false)
  updatedAt     DateTime @updatedAt
}

model PushSubscription {
  id        String   @id @default(cuid())
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
}
```

On startup run `prisma migrate deploy`. Create the initial migration during development with
`prisma migrate dev --name init`.

---

## 5. Shared package (`packages/shared/src`)

Define **one** source of truth for validation and types, imported by both API and web.

- `channel.ts`:
  ```ts
  export type Channel = 'email' | 'whatsapp' | 'none';
  export function channelOf(m: { email?: string | null; phoneNumber?: string | null }): Channel {
    if (m.email && m.email.trim()) return 'email';
    if (m.phoneNumber && m.phoneNumber.trim()) return 'whatsapp';
    return 'none';
  }
  export const channelLabel = (c: Channel) =>
    c === 'email' ? 'E-mail · auto' : c === 'whatsapp' ? 'WhatsApp' : 'Sem contacto';
  export const channelPreview = (c: Channel) =>
    c === 'email' ? 'E-mail (automático)' : c === 'whatsapp' ? 'WhatsApp (manual — PDF)' : 'Sem contacto definido';
  ```
- `member.ts`: `MemberSchema` (zod) — `profaneName` required min 1; everything else optional
  nullable; `birthDate` optional ISO string; `email` optional but must be a valid email when
  present; export `Member`, `MemberInput` types.
- `settings.ts`: `SettingsInput` schema (SMTP fields, sendHour 0-23, identity). The password field
  is write-only; GET returns `{ ...settings, smtpPasswordSet: boolean }` **without** the password.
- `send.ts`: `SendLog` type + `SendStatus`/`SendChannel` unions + the Agendamentos view types.

---

## 6. Design system — how to read it

Open these and reproduce them:

| File | Use it for |
|---|---|
| `design-system/Canvas.dc.html` | **Exact** styles for Sócios + Agendamentos pages, sidebar/drawer, top bar, modal, confirm dialog, toast, badges, buttons. Colors/paddings/radii are inline styles — copy them. The JS at the bottom shows the exact logic (channelOf, date display, filtering, grouping). |
| `design-system/Postal Aniversario.dc.html` | On-screen postcard reference (px units at 794px canvas). |
| `design-system/automation/postal-aniversario.template.html` | **The print/PDF template** (mm + pt units). This is what the server fills and renders to PDF. Copy it into `apps/api/assets/postal-template.html`. |
| `design-system/assets/fundo-postal-aniv.png` | Background (1821×2377). Copy into `apps/api/assets/`. |
| `design-system/uploads/FFL/FFL-SociosAtivos.csv` | The 140 members. Copy into `apps/api/prisma/seed-data/`. |
| `design-system/uploads/FFL/Postal Aniversario THARYH.pdf` | Reference output to compare your generated PDF against. |
| `design-system/README.md` | Original spec (data model, tokens, automation flow). |

---

## 7. Design tokens (`apps/web/src/theme.ts`)

Copy these **exact** values (pulled from `Canvas.dc.html`).

```ts
export const theme = {
  font: {
    sans: "'Instrument Sans', system-ui, sans-serif",     // UI
    serif: "'Instrument Serif', Georgia, serif",          // headings / org name (italic)
  },
  color: {
    appBg: '#f6f3ee',
    surface: '#ffffff',
    surfaceWarm: '#fffefb',       // sidebar, top bar, modal, header strips
    headerBg: '#fffdf9',
    text: '#2a2621',
    textMuted: '#8a8175',
    textFaint: '#a89f90',
    textSubtle: '#6a6459',
    textSoft: '#4a463f',
    monoFaint: '#b0a794',
    gold: '#c69a2e',              // primary action / accent
    goldBrand: '#a67c00',         // "Fiat Lux" serif wordmark
    goldActive: '#9a7a1e',        // active nav text
    goldMuted: '#6a5a20',         // toast text
    navActiveBg: 'rgba(198,154,46,.15)',
    navHoverBg: 'rgba(198,154,46,.12)',
    focusRing: 'rgba(198,154,46,.16)',
    rowHover: '#faf7f0',
    danger: '#b4463c',
    success: '#1f7a52',
    // borders
    border: '#ece5d8', borderMute: '#e7e1d7', borderInput: '#ded7ca',
    borderCard: '#ebe4d7', borderRow: '#eee6d9',
  },
  channelBadge: {
    email:    { bg: '#eaf1f8', fg: '#3f6b96' },
    whatsapp: { bg: '#e7f4ec', fg: '#1f7a52' },
    none:     { bg: '#f2ede3', fg: '#a89f90' },
  },
  statusBadge: {                  // Agendamentos
    enviado:  { bg: '#eef0ea', fg: '#6f7a5e', accent: '#c8cdbe' },
    hoje:     { bg: '#f6ecc9', fg: '#8a6d12', accent: '#c69a2e' },
    agendado: { bg: '#eaf1f8', fg: '#3f6b96', accent: '#a9c3dd' },
  },
  radius: { sm: 8, md: 9, lg: 10, xl: 14, modal: 16 },
  breakpointPx: 760,              // < 760 → mobile (drawer + cards); ≥ 760 → desktop (sidebar + table)
};
```

Fonts: **self-host** Instrument Sans + Instrument Serif (download the woff2 files into
`apps/web/public/fonts/` and declare `@font-face` in CSS). Do **not** load Google Fonts at
runtime (offline support + GDPR).

> **Decision (Phase 8):** downloading the Instrument Sans/Serif font files requires fetching
> from an external source, which needs the user's explicit go-ahead (file download) — asking
> would have interrupted the build for a purely aesthetic nicety. Shipped instead with the
> fallback stack alone (`'Instrument Sans', system-ui, sans-serif` / `'Instrument Serif',
> Georgia, serif`) — since the Instrument fonts are never actually fetched, every browser
> renders the fallback (system-ui / Georgia), which already reads cleanly at every size used in
> this UI. **If the user wants the exact Instrument look, self-hosting the woff2 files is a
> quick follow-up** — the `@font-face` + `theme.ts` wiring is the only work; no component
> changes needed since they already reference these font-family stacks by name.

Focus style: `outline:none; border-color:#c69a2e; box-shadow:0 0 0 3px rgba(198,154,46,.16)`.

**Portuguese labels** (UI text): Sócios, Agendamentos, Definições, Nome Profano, Nome Místico,
Nascimento, NIF, Telemóvel, E-mail, Canal, Ações, Adicionar sócio, Guardar, Cancelar, Eliminar,
Descarregar PDF, Hoje, Próximos, Enviados, Sem contacto. Date display in tables: `DD/MM/YYYY`.

---

## 8. Postcard rendering (`apps/api/src/modules/postcard/render.ts`)

The postcard is A4, filled from a template with 3 tokens, rendered to PDF by Puppeteer.

**Tokens** (find-and-replace in `apps/api/assets/postal-template.html`):
- `{{nome_profano}}` → member's profane name, **UPPERCASE**, HTML-escaped.
- `{{nome_mistico}}` → mystic name, or empty string `""` if none. The "Nome Místico" label stays
  either way (it's in the template).
- `{{data}}` → formatted date string, e.g. **`18 de Junho de 2026`**.

**Date format** (`lib/dates.ts`): `` `${day} de ${MES} de ${year}` `` where:
- `day` is the member's birth **day**, **NOT zero-padded** (`18`, not `08` → for day 8 it's `8`).
- `MES` = capitalized Portuguese month of the member's birth **month**:
  `['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']`.
- `year` = **current** year (the year the postcard is being sent).
- Also export `MESES_ABBR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']`
  for the Agendamentos day/month tiles.

**Template CSS facts** (already in the template — keep them):
- Page `@page { size: A4; margin: 0 }`; `.postal` is `210mm × 297mm`, serif font
  `"Times New Roman", Times, "Liberation Serif", serif`, `print-color-adjust: exact`.
- Background `img` at `top:0; left:0; width:210mm; height:auto`.
- Names block `left:29.5%; top:15.2%; width:64%`. Label = italic `#cc9900` `21.5pt`; value =
  `#9cc2e5` `16.5pt` letter-spacing `.3px`, `min-height:20pt`, `margin:1.5pt 0 10pt`.
- Blessing `left:8%; top:30.5%; width:84%`, centered italic `#cc9900` `21.5pt`; text (with curly
  quotes): `“Eu Doménico de Roma, rogo a Deus<br>que seja este, mais um ano evolutivo em todos
  os<br>quadrantes da sua vida”`.
- Signoff `right:8.5%; top:42.5%`, right-aligned `#cc9900` `14pt`: line 1 `{{data}}`, line 2 `Namastê`.

**Make the HTML self-contained**: read `fundo-postal-aniv.png`, base64-encode it, and inject it as
`src="data:image/png;base64,…"` replacing the `../assets/...` path. This makes the page portable.

**Render function**:
```ts
// returns a PDF Buffer
async function renderPostcardPdf(member): Promise<Buffer> {
  const html = fillTemplate(member);   // token replace + base64 bg
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
  await browser.close();
  return pdf;
}
```
Launch the browser per request/job and close it (low volume). HTML-escape all member values
(`&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`). Filename for downloads: `Postal <PrimeiroNome>.pdf`.

**Fidelity check**: generate the PDF for ISABEL / THARYH (birth `1968-06-18`) and compare visually
to `design-system/uploads/FFL/Postal Aniversario THARYH.pdf`.

---

## 9. One-time seed data (generated once, offline — NOT an app feature)

**We are deliberately not building a CSV/XLSX importer into the app.** The 140 members are a
one-time historical migration from the church's existing spreadsheet, not a recurring feed.
Building a reusable import feature (upload endpoint, XLSX parsing, create/update matching, error
UI) is real scope for something that likely never runs again — new members from now on are added
one at a time through the Sócios CRUD screen (Phase 3). If the church ever needs another bulk
import later, treat that as a future feature request, not v1.

Instead: **generate the seed once, offline, as plain SQL**, commit it, and run it on first boot.

### 9.1 Generate `apps/api/prisma/seed.sql`

Write `apps/api/scripts/generate-seed.mjs` — checked into the repo for reproducibility, but
**never imported by the running app and never copied into the Docker image**. You run it once
locally (`node apps/api/scripts/generate-seed.mjs`) and commit the SQL file it produces. Re-run it
by hand later only if the source CSV or the Member schema changes before launch.

The script:

1. Reads `apps/api/seed-source/FFL-SociosAtivos.csv` (copy the church CSV there — no header row).
2. Parses it with a **real CSV parser** (`csv-parse`) — fields contain commas inside quotes, so
   `split(',')` will silently corrupt rows. Add `csv-parse` as a dependency **only** for this
   script (repo-root devDependency, or install it ad hoc) — it must **not** appear in
   `apps/api/package.json`, so it never ends up in the production image. Do **not** hand-type the
   140 rows — script the cleaning so NIFs/phones/dates come out exact.
3. Cleans each row with **exactly** these rules (column mapping, index → field):

   | Idx | Raw example | Field | Cleaning rule |
   |---|---|---|---|
   | 0 | `1` | (seq) | Running counter → `internalId = 'FFL-' + String(n).padStart(3,'0')`. |
   | 1 | `"194,416,232"` | `nif` | Strip non-digits → `194416232`. If not exactly 9 digits (e.g. `???`, `????`, empty) → `NULL`. |
   | 2 | `ABRAÃO BARROS TAVARES` | `profaneName` | `trim()` then **UPPERCASE**. Required — skip the row entirely if empty. |
   | 3 | `"966,750,406  "` | `phoneNumber` | Strip non-digits → `966750406`. If 9 digits → format `+351 966 750 406`. Junk (`???`)/empty → `NULL`. |
   | 4 | `abraaott@gmail.com` / `Não tem ` | `email` | `trim()`. If empty **or** equals `"não tem"` (case-insensitive, ignoring surrounding spaces) → `NULL`. |
   | 5 | `23-09-1968` / ` 29-04-1959` | `birthDate` | `trim()`, parse `DD-MM-YYYY` → ISO `YYYY-MM-DD`. Empty/invalid → `NULL` (and `birthMonth`/`birthDay` → `NULL` too). |
   | 6 | `BAHALIHÁ` / `` | `mysticName` | `trim()`. Empty → `NULL`. |
   | 7 | `2969` / `Sócio Recente` / `` | `memberNumber` | `trim()`. Empty → `NULL`. Store the raw string. |

   The file has rows numbered up to 140 but ~139 lines — import every valid line and use your own
   running counter for `internalId`; don't rely on column 0 being contiguous.

4. For each cleaned row, emits one line:
   ```sql
   INSERT INTO Member (id, internalId, profaneName, mysticName, birthDate, birthMonth, birthDay, nif, phoneNumber, email, memberNumber, notes, createdAt, updatedAt)
   VALUES ('FFL-001','FFL-001','ABRAÃO BARROS TAVARES',NULL,'1968-09-23',9,23,'194416232','+351 966 750 406','abraaott@gmail.com','2969',NULL,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
   ```
   Details that matter:
   - **`id` = the same value as `internalId`** (e.g. `'FFL-001'`). The schema's `id` is just a
     unique string primary key, not required to be a cuid — reusing `internalId` avoids pulling a
     cuid library into a throwaway script. Members created later via the app still get real
     Prisma-generated cuids for `id`; both schemes coexist fine since both are just unique strings.
   - **`createdAt`/`updatedAt`** must be set explicitly (e.g. the generation date, in ISO
     datetime). Raw SQL bypasses Prisma Client's `@default(now())`/`@updatedAt` behavior — those
     are applied by the client library, not something you can rely on for a raw insert.
   - Escape single quotes in text by doubling them (`O'Brien` → `O''Brien`) so the SQL stays valid.
   - After cleaning, `channelOf` (shared package) derives the channel — don't store it.
5. Wraps everything in one transaction and writes `apps/api/prisma/seed.sql`:
   ```sql
   BEGIN TRANSACTION;
   INSERT INTO Member (...) VALUES (...);
   -- … one line per member …
   COMMIT;
   ```

If the Prisma schema's columns change before launch, regenerate this file — don't hand-edit it.

### 9.2 Running the seed on first boot

> **Implementation note (found during Phase 1 build):** don't shell out to a `sqlite3` CLI
> binary — it isn't installed on most dev machines (Windows in particular) and would need
> `apt-get install sqlite3` in the Docker image for no real benefit. `better-sqlite3` is
> **already a dependency** (it's what `@prisma/adapter-better-sqlite3` wraps — see §4's Prisma
> 7 note) and its `Database#exec()` method runs a whole multi-statement SQL script (including
> the `BEGIN TRANSACTION;`/`COMMIT;` wrapper) directly, in-process, with no subprocess and no
> PATH dependency. Add `better-sqlite3` as a **direct** dependency of `@ffl/api` (not just
> transitive) and use it straight from Node — identical code path on Windows dev and Linux prod.

No import endpoint, no CSV/XLSX dependency at runtime. Boot sequence (see §14):

1. `prisma migrate deploy`.
2. `bootSeed.ts` (called from `server.ts` before `app.listen`): if `prisma.member.count()` is
   `0` **and** `SEED_ON_EMPTY=true`, read `prisma/seed.sql` and run it via
   `new Database(sqlitePath).exec(sql)`. Safe to call on every boot — idempotent, a no-op once
   real data exists.
3. Start the Fastify server.

---

## 10. Backend API (Fastify)

Every route is under `/api` and passes through `plugins/auth.ts` (currently a no-op that always
allows — the seam for future login). Serve the built web app for all non-`/api` routes with
`@fastify/static` + SPA fallback to `index.html`. Validate request bodies with the shared zod
schemas. Return JSON. Use pino for logs.

**Endpoints:**

- `GET  /api/health` → `{ ok: true }`
- **Members**
  - `GET  /api/members?query=` → list (search across profaneName, mysticName, email, nif,
    internalId, phoneNumber — same fields as the prototype's filter). Each item includes derived
    `channel`.
    > **Implementation note (found during Phase 3 build):** don't implement this with Prisma's
    > `contains` (SQLite `LIKE`) — it's only case-insensitive for ASCII, so a lowercase, accented
    > query like `"verificação"` won't match a stored `"VERIFICAÇÃO"`. That's a real problem for a
    > dataset that's entirely Portuguese names. With only ~140 members, fetch everything and filter
    > in JS instead, normalizing both sides with `.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()`
    > (see `apps/api/src/lib/search.ts`) — correct and plenty fast at this scale.
  - `POST /api/members` → create (auto-generate `internalId` if blank via `FFL-###` next number).
  - `GET  /api/members/:id`
  - `PUT  /api/members/:id`
  - `DELETE /api/members/:id`
  - `GET  /api/members/:id/postcard.pdf` → streams the rendered PDF (for the per-row download).
- **Sends / scheduling**
  - `GET  /api/sends/agenda` → this year's birthdays grouped `{ hoje[], proximos[], enviados[] }`,
    each item enriched with member, channel, status (from `SendLog`), and day/month tile fields.
  - `POST /api/sends/run` → run the daily job **now** ("enviar agora"). Returns a summary.
  - `POST /api/sends/:memberId/mark-sent` → manual mark (for WhatsApp members): upsert `SendLog`
    (memberId, currentYear) status `sent`, channel `whatsapp`, `sentAt=now`.
  - `POST /api/sends/:memberId/resend` → re-render + re-email (email channel), update `SendLog`.
- **Settings**
  - `GET  /api/settings` → returns settings **without** `smtpPassword`, plus `smtpPasswordSet`
    and the VAPID public key.
  - `PUT  /api/settings` → update; if `smtpPassword` provided, encrypt (AES-256-GCM) before store.
  - `POST /api/settings/test-email` → send a test email to a given address using current SMTP.
- **Push**
  - `GET  /api/push/vapid` → `{ publicKey }`.
  - `POST /api/push/subscribe` → save a `PushSubscription`.
  - `POST /api/push/unsubscribe` → remove by endpoint.
  - `GET  /api/push/devices` → list subscriptions (endpoint host + userAgent + createdAt).
- **Dashboard**
  - `GET  /api/dashboard` → aggregates (see §12).

**Services logic:**

- `lib/crypto.ts`: AES-256-GCM using `ENCRYPTION_KEY`; `encrypt(text)→"iv:tag:cipher"` (base64),
  `decrypt(...)`. Used only for `smtpPassword`.
- `mail/service.ts`: build a nodemailer transport from decrypted Settings
  (`{ host, port, secure, auth:{ user, pass } }`), send with the PDF attached
  (`filename: 'Postal <Nome>.pdf'`, `contentType: 'application/pdf'`). Subject e.g.
  `"Feliz Aniversário 🎉"`, from `"<fromName>" <fromEmail>`. Provide `verifyConnection()`.
- `push/service.ts`: `web-push.setVapidDetails(subject, pub, priv)`; `notifyAll(payload)` loops
  subscriptions, sends, and **deletes** subscriptions that return 404/410 (expired).
- `sends/service.ts` — **`runDailyJob()`**:
  1. `today` in Europe/Lisbon → `(month, day)`, `year`.
  2. Members with `birthMonth===month && birthDay===day`.
  3. For each: if a `SendLog(memberId, year)` exists with status `sent`/`pending_manual` → skip.
     Else `channel = channelOf(member)`:
     - `email`: render PDF → send email → upsert `SendLog` status `sent` (`sentAt=now`) or
       `failed` (+`error`). On success, `push.notifyAll({ title:'Postal enviado 🎉',
       body:'Enviado a <NOME> por e-mail' })`. If a run sends many, you may coalesce into one
       summary notification when count > 5.
     - `whatsapp`: upsert `SendLog` status `pending_manual` (appears in Agendamentos manual list;
       no email). Optional push `"Postal manual pendente para <NOME>"`.
     - `none`: upsert `SendLog` status `skipped`.
  4. Return `{ emailed, pendingManual, skipped, failed }`.
- `jobs/scheduler.ts`: `node-cron.schedule('0 <SEND_HOUR> * * *', runDailyJob, { timezone:
  'Europe/Lisbon' })`. Read `sendHour` from Settings at scheduling time; reschedule when Settings
  change. On server startup, also run a **catch-up**: call `runDailyJob()` once (idempotency makes
  this safe) so a restart on someone's birthday still sends.

---

## 11. Frontend (React + Vite)

Router with a persistent `Layout` (sidebar/drawer + optional mobile top bar). 4 routes:
`/` Dashboard, `/socios` Members, `/agendamentos` Scheduling, `/definicoes` Settings.
Use TanStack Query for all data; react-hook-form + zod for the member and settings forms.

**Responsive (breakpoint 760px)** — reproduce from `Canvas.dc.html`:
- **Desktop (≥760)**: static left sidebar (250px), members shown as a **table**, add button inline.
- **Mobile (<760)**: sidebar becomes a **drawer** (270px, max 82vw) hidden by default, opened from
  a hamburger in a sticky top bar; dim overlay behind; closes on overlay tap, X, or navigation.
  Members shown as **cards**; search full-width; a gold **+** in the top bar adds a member; the
  edit modal is single-column and docks to the bottom (`align-items:flex-end`).
- The switch is driven by `window.innerWidth` and updates live on resize/rotate.

**Components** — port pixel-faithfully from `Canvas.dc.html`:
- `Sidebar`: "Fiat Lux" serif wordmark + "Backoffice · Postais" caption; nav items **Dashboard,
  Sócios (count), Agendamentos (count), Definições** with the active style
  (`bg rgba(198,154,46,.15)`, text `#9a7a1e`, `box-shadow: inset 3px 0 0 #c69a2e`); the
  info note at the bottom about e-mail auto vs WhatsApp manual.
- `ChannelBadge`: pill using `theme.channelBadge` colors; labels from shared `channelLabel`.
- `Modal` (member add/edit): fields **ID Interno, Data de Nascimento, Nome Profano*** (uppercase
  input), **Nome Místico, NIF (mono), Telemóvel, E-mail, Observações** (textarea), and a live
  **channel preview** row (dot color + `channelPreview` text). Save disabled until `profaneName`
  non-empty. Footer Cancelar / Guardar.
- `ConfirmDialog` (delete): "Eliminar sócio?" with the member name, Cancelar / Eliminar (danger).
- `Toast`: bottom-center success toast with a check icon (auto-hide ~2.6s).

**Pages:**
- **Dashboard** (`/`): stat tiles + lists (see §12) in the ivory-gold system. A small
  **12-month sends bar chart** is optional; if you build it, first load the `dataviz` skill and use
  the theme gold as the series color. Keep it simple.
- **Sócios** (`/socios`): header (title + count label like `"140 sócios ativos"` / `"X de 140
  sócios"`), search input (placeholder `"Procurar nome, NIF, e-mail…"`), table (desktop) or cards
  (mobile) with per-row **Descarregar PDF / Editar / Eliminar**. Table columns: Nome Profano
  (+ internalId mono), Nome Místico (serif italic gold), Nascimento, NIF (mono), Telemóvel,
  E-mail (ellipsis), Canal (badge), Ações. Empty state: `"Nenhum sócio corresponde à procura."`.
- **Agendamentos** (`/agendamentos`): subtitle `"Aniversários de <ano> — envios por e-mail são
  automáticos; WhatsApp é manual."` + an **"Enviar agora"** button (calls `POST /api/sends/run`).
  Three sections **Hoje / Próximos / Enviados** (hide empty ones), each row = day/month tile +
  name + sub (mystic · email/phone) + channel badge + status badge; WhatsApp rows get a **PDF**
  button; email rows in Enviados show `Enviado`; today's manual rows get **"Marcar como enviado"**.
- **Definições** (`/definicoes`): 
  - **SMTP** card: host, port, secure (SSL/STARTTLS toggle), user, password (write-only; show
    "configurada" when `smtpPasswordSet`), fromName, fromEmail, replyTo, **sendHour**; buttons
    **Guardar** and **Enviar e-mail de teste** (prompts for a destination address).
  - **Notificações push** card: a **"Ativar notificações neste dispositivo"** button (see §13),
    the VAPID status, and a **device list** (with remove). Explain the iPhone "Add to Home Screen"
    requirement inline.
  - **Igreja/Remetente** identity (church name etc.).

**API client** (`src/api/client.ts`): thin `fetch` wrapper to `/api`, JSON in/out, throws on
non-2xx. `hooks.ts`: query/mutation hooks per resource with cache invalidation.

> **Implementation note (found during Phase 4 build):** for POST/PUT calls with **no** body
> (e.g. `POST /sends/run`, mark-sent, resend), do **not** unconditionally set
> `Content-Type: application/json` — Fastify's default JSON body parser throws
> `FST_ERR_CTP_EMPTY_JSON_BODY` ("Body cannot be empty when content-type is set to
> 'application/json'") if that header is present with an empty body, and it surfaces as a
> confusing 500 unless the server's error handler also respects Fastify-native errors' own
> `statusCode` (see `server.ts`'s `setErrorHandler` — don't blanket-500 everything that isn't
> your own `AppError`). Only attach the JSON content-type header when a body is actually sent.

---

## 12. Dashboard aggregates (`GET /api/dashboard`)

Return everything the first page needs in one call:
```jsonc
{
  "emailsSentThisYear": 0,          // SendLog where year=thisYear, channel=email, status=sent
  "emailsSentAllTime": 0,
  "sentCount": 0,                   // birthdays already passed this year (or logged sent)
  "todayCount": 0,                  // birthdays today
  "upcomingCount": 0,               // birthdays remaining this year
  "pendingManualCount": 0,          // whatsapp pending_manual this year
  "membersTotal": 0,
  "membersWithoutContact": 0,       // channel === none
  "todayBirthdays": [ /* member summaries with channel */ ],
  "upcoming": [ /* next N (e.g. 10) upcoming birthdays: name, date, channel */ ],
  "recentSends": [ /* last N SendLog joined with member: name, channel, status, sentAt */ ],
  "sendsByMonth": [ /* 12 numbers for the optional chart */ ]
}
```

---

## 13. PWA + push (iPhone specifics)

- **Manifest** (`apps/web/public/manifest.webmanifest`): `name: "Postais Fiat Lux"`,
  `short_name: "Postais"`, `display: "standalone"`, `background_color`/`theme_color` ivory-gold,
  `start_url: "/"`, icons **192, 512, and a maskable 512**.
- **iOS meta** in `index.html`: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`,
  `apple-touch-icon`.
- **Service worker** (`apps/web/public/sw.js`, hand-written plain JS, registered unconditionally
  from `main.tsx` on every load — not gated behind the push opt-in):
  > **Implementation note (found during Phase 8 build):** the plan originally called for
  > `vite-plugin-pwa` + Workbox precaching. Dropped in favor of a small hand-written SW instead —
  > this app is genuinely **online-only** (no email/DB access without a connection regardless of
  > what's cached), so an offline app-shell adds real config complexity (asset manifests, cache
  > versioning/invalidation) for a use case that doesn't exist here. A plain SW with `install`
  > (`skipWaiting`) + `activate` (`clients.claim()`) is enough to make the app installable; it
  > also owns the `push`/`notificationclick` handlers (`showNotification`, focus-or-open-window
  > on click). If a future feature genuinely needs offline support, reach for Workbox then.
- **Subscription flow** (`pwa/push.ts`, triggered by the Settings button):
  1. `Notification.requestPermission()`.
  2. `registration.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:
     urlBase64ToUint8Array(vapidPublicKey) })` (fetch key from `/api/push/vapid`).
  3. `POST /api/push/subscribe` with the subscription JSON.
- **iPhone limitation (document this for the user in README):** Web Push on iOS works **only after
  the site is installed to the Home Screen** (Share → "Add to Home Screen") on iOS 16.4+, and only
  over HTTPS. In a normal Safari tab it will not work. Both conditions are met once ffl.pt is live
  and the user installs the PWA.

---

## 14. Docker & deployment

**Dockerfile** (multi-stage; distro Chromium so we don't download one):
```dockerfile
# ---------- build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @ffl/shared build \
 && pnpm --filter @ffl/web build \
 && pnpm --filter @ffl/api exec prisma generate \
 && pnpm --filter @ffl/api build
RUN pnpm deploy --filter @ffl/api --prod /prod/api   # prune prod deps for the api

# ---------- runtime ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /prod/api ./
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/assets ./assets
COPY --from=build /app/apps/web/dist ./public
EXPOSE 3000
# server.ts on boot: prisma migrate deploy (run separately, see entrypoint) -> bootSeed
# (better-sqlite3 runs prisma/seed.sql in-process if the Member table is empty) -> serve
# ./public + /api -> start cron. seed.sql is generated by apps/api/scripts/generate-seed.mjs
# (§9) and committed to the repo — nothing CSV-related runs at container boot.
ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["node","dist/server.js"]
```
(Exact `COPY` paths depend on your build output; the intent: ship api `dist`, `prisma`,
`assets`, prod `node_modules`, and the web build as `./public`. Fastify serves `./public`.)

**Caddyfile:**
```
ffl.pt {
    reverse_proxy app:3000

    # OPTIONAL PII stopgap until real login exists — uncomment and set a hash
    # (generate: docker run --rm caddy caddy hash-password --plaintext 'YOURPASS'):
    # basic_auth {
    #   admin <BCRYPT_HASH>
    # }
}
# optional: redirect www → apex
www.ffl.pt { redir https://ffl.pt{uri} }
```

**docker-compose.yml:**
```yaml
services:
  app:
    build: .
    env_file: .env
    environment:
      - DATABASE_URL=file:/data/app.db
      - DATA_DIR=/data
    volumes:
      - app-data:/data
    expose: ["3000"]
    restart: unless-stopped
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    depends_on: [app]
    restart: unless-stopped
volumes:
  app-data:
  caddy-data:
  caddy-config:
```

**docker-compose.dev.yml** adds Mailpit (`axllent/mailpit`, ports 1025 SMTP / 8025 UI) so email is
testable locally without a real SMTP server (point Settings at host `mailpit`, port 1025, secure
off).

**Root `package.json` scripts:** `dev` (run api + web with tsx/vite concurrently),
`build`, `gen:vapid` (`node -e` using `web-push`), `migrate`, `gen:seed` (runs
`apps/api/scripts/generate-seed.mjs` to (re)build `prisma/seed.sql` from the CSV — a dev-time
convenience, not something the deployed app ever runs).

**Deploy to OVH (put in README):**
1. Point DNS `ffl.pt` (A/AAAA) at the VPS public IP; open ports 80 and 443 in the OVH firewall.
2. Install Docker + Docker Compose plugin on the VPS.
3. `git clone` the repo; `cp .env.example .env`; fill `ENCRYPTION_KEY`, `VAPID_*` (`pnpm gen:vapid`
   locally or `docker compose run --rm app pnpm gen:vapid`).
4. `docker compose up -d --build`. Caddy auto-provisions the TLS cert for ffl.pt.
5. First boot imports the 140 members. Open https://ffl.pt, go to Definições, set SMTP, send a
   test email. On iPhone: Share → Add to Home Screen → open it → Definições → enable notifications.
6. **Backup**: `docker compose cp app:/data/app.db ./backup-YYYYMMDD.db` (or back up the `app-data`
   volume). The whole app state is that one SQLite file plus the volume.

---

## 15. Phases & acceptance criteria (build in this order)

- **Phase 0 — Scaffold.** Monorepo, pnpm workspaces, TS/eslint/prettier, root scripts, `.env.example`.
  ✅ `pnpm install` clean; `pnpm dev` starts empty api + web; `/api/health` returns `{ok:true}`.
- **Phase 1 — DB + seed.** Prisma schema + `init` migration; copy the CSV into `seed-source/`;
  write + run `generate-seed.mjs` once to produce `prisma/seed.sql`; `bootSeed.ts` runs it on
  first boot via the `sqlite3` CLI when the `Member` table is empty.
  ✅ Fresh boot imports 140 members; spot-check: NIF `194416232`, phone `+351 966 750 406`,
  ISABEL's birthDate `1968-06-18`, `"Não tem"` → null email, `???` → null. Channels derive
  correctly. Restarting the container does not re-run the seed or duplicate rows.
- **Phase 2 — Postcard PDF.** Copy template + PNG into `assets`; base64 inline; date formatter;
  Puppeteer render; `GET /api/members/:id/postcard.pdf`.
  ✅ THARYH's PDF visually matches `Postal Aniversario THARYH.pdf` (names, positions, colors, date).
- **Phase 3 — Members.** CRUD + search API; Sócios page (table/cards, modal, delete, PDF button).
  ✅ Add/edit/delete/search work on desktop and mobile widths; per-row PDF downloads.
- **Phase 4 — Scheduling.** SendLog; `runDailyJob` (idempotent); scheduler; `agenda` endpoint;
  Agendamentos page; "Enviar agora"; mark-sent; resend.
  ✅ Set a member's birthday to today → "Enviar agora" → SendLog `sent`; re-run creates no
  duplicate; groups render Hoje/Próximos/Enviados from real state.
- **Phase 5 — Mail + Settings.** Encrypted SMTP settings; transport; send-with-attachment; test
  button. (Use Mailpit locally.)
  ✅ Save SMTP; test email arrives in Mailpit; a birthday send delivers the PDF; API never returns
  the password.
- **Phase 6 — Push.** VAPID; subscribe/unsubscribe/devices; notify on send; Settings UI + device list.
  ✅ Subscribe from a desktop browser; a send fires a notification; expired subs get pruned.
- **Phase 7 — Dashboard.** Aggregates endpoint + page (tiles, today/upcoming/recent lists, optional chart).
  ✅ Numbers reconcile with the members/sends data.
- **Phase 8 — PWA polish.** Manifest, SW, iOS meta, generated icons, self-hosted fonts.
  ✅ Chrome Lighthouse "installable"; app shell works offline; icons show on install.
- **Phase 9 — Dockerize.** Dockerfile, compose (+Caddy), dev compose (+Mailpit), README deploy docs.
  ✅ `docker compose up --build` serves the app; state persists across `down`/`up`.
- **Phase 10 — Verify.** Full end-to-end pass (§16). Then hand off for the ffl.pt deploy.

Track these with the task tools; mark each phase in-progress/completed as you go.

---

## 16. End-to-end verification

- Seed: 140 members, cleaned fields, correct channels.
- Postcard fidelity vs the reference THARYH PDF.
- Scheduling: birthday-today send → email (Mailpit) + SendLog + push; **no duplicate** on re-run.
- Settings: SMTP save + test email; password never leaves the server.
- Responsive: 760px breakpoint swaps sidebar/table ↔ drawer/cards; drawer opens/closes correctly.
- Docker: builds, runs, persists volume, Caddy TLS (once ffl.pt is live).
- iPhone (post-deploy): Add to Home Screen → enable notifications → receive a real send notification.

---

## 17. Things Sonnet must not skip or guess

1. The **seed-generation script** (`generate-seed.mjs`, run once, offline) must use a real CSV
   parser — the data has commas inside quoted fields. Never hand-transcribe the 140 rows, and
   never ship a CSV/XLSX parser inside the deployed app — there is no import feature in v1.
2. **Idempotency**: `SendLog @@unique([memberId, year])` — check before sending. Same principle
   for the seed: `bootSeed.ts` only runs `seed.sql` when the `Member` table is empty.
3. **Timezone Europe/Lisbon** for the cron and all "today" comparisons.
4. **Encrypt** the SMTP password; **never** return it from the API.
5. Postcard: **inline the PNG as base64**, `printBackground: true`, day **not** zero-padded,
   Portuguese month names, **current** year.
6. Reproduce the **exact** colors/spacing from `Canvas.dc.html`; don't restyle.
7. **Do not** import or depend on `support.js` / the `.dc.html` runtime.
8. Keep the **auth seam** so login can be added later without editing every route.
9. Self-host fonts; no runtime Google Fonts.
10. iPhone push only works as an **installed PWA over HTTPS** — build accordingly, document clearly.
```
