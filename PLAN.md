# Fiat Lux — Postais de Aniversário — Implementation Plan

> **For the executor (Sonnet 5):** This document is self-contained. Read it fully before
> writing code. The `design-system/` folder is the **visual source of truth** — open the files
> it references and match them exactly. Do **not** invent UI; port what already exists. When a
> value (color, size, position, text) is given here, use it verbatim. Build in the order of the
> **Phases** section; each phase has **acceptance criteria** — do not move on until they pass.

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
  **csv-parse** (import), **xlsx** (optional .xlsx import), **dayjs** (+ utc/timezone plugins).
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
   │  │  └─ seed-data/FFL-SociosAtivos.csv   (copy of the church CSV)
   │  ├─ assets/
   │  │  ├─ postal-template.html             (copy of the automation template)
   │  │  └─ fundo-postal-aniv.png            (copy of the background)
   │  └─ src/
   │     ├─ server.ts
   │     ├─ config.ts
   │     ├─ db.ts                            (Prisma client singleton)
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
   │     ├─ jobs/scheduler.ts
   │     └─ seed.ts
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
runtime (offline support + GDPR). Focus style: `outline:none; border-color:#c69a2e;
box-shadow:0 0 0 3px rgba(198,154,46,.16)`.

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

## 9. CSV importer (`apps/api/src/seed.ts` + members import endpoint)

Source: `apps/api/prisma/seed-data/FFL-SociosAtivos.csv`. **No header row.** Fields may contain
commas inside quotes — **you MUST use a real CSV parser** (`csv-parse`), never `split(',')`.

**Column mapping (index → field):**

| Idx | Raw example | Field | Cleaning rule |
|---|---|---|---|
| 0 | `1` | (seq) | Running counter → `internalId = 'FFL-' + String(n).padStart(3,'0')`. |
| 1 | `"194,416,232"` | `nif` | Strip non-digits → `194416232`. If not exactly 9 digits (e.g. `???`, `????`, empty) → `null`. |
| 2 | `ABRAÃO BARROS TAVARES` | `profaneName` | `trim()` then **UPPERCASE**. Required — skip row if empty. |
| 3 | `"966,750,406  "` | `phoneNumber` | Strip non-digits → `966750406`. If 9 digits → format `+351 966 750 406`. Junk (`???`)/empty → `null`. |
| 4 | `abraaott@gmail.com` / `Não tem ` | `email` | `trim()`. If empty **or** equals `"não tem"` (case-insensitive, ignoring surrounding spaces) → `null`. |
| 5 | `23-09-1968` / ` 29-04-1959` | `birthDate` | `trim()`, parse `DD-MM-YYYY` → ISO `YYYY-MM-DD`. Empty/invalid → `null`. Set `birthMonth`/`birthDay` when present. |
| 6 | `BAHALIHÁ` / `` | `mysticName` | `trim()`. Empty → `null`. |
| 7 | `2969` / `Sócio Recente` / `` | `memberNumber` | `trim()`. Empty → `null`. Store the raw string. |

Notes:
- The file has rows numbered up to 140 but ~139 lines — just import every valid line and use a
  running counter for `internalId`. Don't rely on column 0 being contiguous.
- After cleaning, `channelOf` decides the channel (don't store it — derive it).
- Seed only runs when `SEED_ON_EMPTY=true` **and** the `Member` table is empty.
- Also expose `POST /api/members/import` (multipart CSV, optionally XLSX via `xlsx`) that runs the
  same cleaner — used later to refresh the list. Return a summary `{ created, updated, skipped }`.
  Match existing members by `nif` (when present) else by `profaneName`.

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
  - `POST /api/members` → create (auto-generate `internalId` if blank via `FFL-###` next number).
  - `GET  /api/members/:id`
  - `PUT  /api/members/:id`
  - `DELETE /api/members/:id`
  - `GET  /api/members/:id/postcard.pdf` → streams the rendered PDF (for the per-row download).
  - `POST /api/members/import` → bulk CSV/XLSX import.
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
- **Service worker** via `vite-plugin-pwa` (Workbox): precache the app shell; runtime
  **network-first** for `/api`. Add a `push` event handler that calls `showNotification(title,
  { body, icon })`, and a `notificationclick` handler that focuses/opens the app.
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
# server.ts on boot: prisma migrate deploy -> seed if empty -> serve ./public + /api -> start cron
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
`build`, `gen:vapid` (`node -e` using `web-push`), `migrate`, `seed`.

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
- **Phase 1 — DB + seed.** Prisma schema + `init` migration; CSV cleaner; copy CSV into seed-data.
  ✅ Fresh boot imports 140 members; spot-check: NIF `194416232`, phone `+351 966 750 406`,
  ISABEL's birthDate `1968-06-18`, `"Não tem"` → null email, `???` → null. Channels derive correctly.
- **Phase 2 — Postcard PDF.** Copy template + PNG into `assets`; base64 inline; date formatter;
  Puppeteer render; `GET /api/members/:id/postcard.pdf`.
  ✅ THARYH's PDF visually matches `Postal Aniversario THARYH.pdf` (names, positions, colors, date).
- **Phase 3 — Members.** CRUD + search API; Sócios page (table/cards, modal, delete, PDF button);
  import endpoint.
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

1. Use a **real CSV parser** — the data has commas inside quoted fields.
2. **Idempotency**: `SendLog @@unique([memberId, year])` — check before sending.
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
