# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A birthday-postcard automation app for the Fraternidade Fiat Lux church: a daily job finds
members whose birthday is today, generates a PDF postcard (Puppeteer-rendered HTML template),
and e-mails it automatically — or, for phone-only members, surfaces a manual "send via
WhatsApp" item with a PDF download. Deployed and live at https://ffl.pt.

Read `PLAN.md` before touching data model, deployment, or anything Prisma/Docker-related — it
documents every real gotcha hit during the build (Prisma 7 driver-adapter quirks, the
Puppeteer/Chromium Docker crash and fix, build-script ordering, accent-insensitive search, the
channel derivation rule, etc.) with the reasoning, not just the fix. `README.md` has the
step-by-step deploy/redeploy/backup runbook for the live VPS.

## Commands

Monorepo via pnpm workspaces (`apps/*`, `packages/*`). Node >= 22, pnpm 9 (`corepack enable`).

```
pnpm install
pnpm --filter @ffl/shared build   # must build shared types before first run

pnpm dev                          # api + web in parallel
pnpm dev:api                      # Fastify API only, http://localhost:3000
pnpm dev:web                      # Vite dev server, http://localhost:5173 (proxies /api)

pnpm build                        # shared -> web -> api, in that order (order matters)
pnpm typecheck                    # tsc --noEmit across all packages (runs `prisma generate` first for api)

pnpm migrate                      # prisma migrate dev   (apps/api)
pnpm migrate:deploy                # prisma migrate deploy (used by the Docker entrypoint)
pnpm gen:vapid                    # print a fresh VAPID keypair for push
pnpm gen:seed                     # regenerate apps/api/prisma/seed.sql from apps/api/seed-source/*.csv (one-off, not run in prod)
```

There is no test suite and no lint config in this repo currently — don't invent `pnpm test` or
`pnpm lint` invocations; the `lint` script in the root `package.json` is a no-op today (no
package defines a `lint` script yet).

Local SMTP testing without a real mail server: `docker compose -f docker-compose.yml -f
docker-compose.dev.yml up mailpit`, then point Definições (Settings) at host `mailpit` port
`1025` with "Ligação segura" off. Mailpit's UI is at `http://localhost:8025`.

### Prisma 7 gotcha (read before touching the schema)

- No `url` in the `datasource` block (`apps/api/prisma/schema.prisma`) — Prisma 7 removed it for SQLite.
- The generated client is TypeScript *source*, output to `apps/api/src/generated/prisma/` (gitignored). Anything that imports it must run `prisma generate` first — that's why `dev`/`build`/`typecheck` in `apps/api/package.json` all run `prisma generate &&` before the real command. **Do not reorder these** — running `tsc` before `prisma generate` builds fine locally (stale generated client left on disk) but fails on a fresh clone/Docker build with `Cannot find module './generated/prisma/client.js'`.
- Uses the `@prisma/adapter-better-sqlite3` driver adapter, which takes a plain filesystem path, not a `file:` URL — `config.ts`'s `sqliteUrlToPath()` strips the prefix from `DATABASE_URL` before handing it to the adapter.
- `prisma.config.ts` (project root of `apps/api`) is required for the Prisma CLI to work at all under Prisma 7, and must be copied into the Docker runtime image alongside `dist/` and `prisma/`.

## Architecture

### Monorepo layout

- `packages/shared` — zod schemas + plain TS types/helpers imported by both apps for end-to-end type safety (`Member`, `Settings`, `Send`, `Push`, `Dashboard` shapes, date/channel helpers). Change a shape here first when a field needs to flow through both API and UI.
- `apps/api` — Fastify 5 + Prisma 7/SQLite + Puppeteer + Nodemailer + web-push + node-cron. Also serves the built web SPA and runs the cron scheduler in-process (single container, no separate worker/cron service).
- `apps/web` — React 19 + Vite + TanStack Query + react-hook-form/zod. Hand-written service worker for PWA/push (no Workbox/vite-plugin-pwa — that was tried and dropped, see PLAN.md).

### Backend (`apps/api/src`)

```
server.ts            Fastify bootstrap: custom error handler (respects native statusCode
                      instead of blanket-500ing), mounts /api routes behind requireAuth,
                      serves apps/web's build as static SPA + SPA fallback in production
config.ts            zod-validated env — the single source of truth for all config/env reads
bootSeed.ts           runs prisma/seed.sql via better-sqlite3 directly if Member table is empty
plugins/auth.ts       no-op guard today — the seam for adding real login later
lib/                  channelOf-adjacent helpers, tz (todayInTz/toTz, Europe/Lisbon-aware),
                      accent-insensitive search (lib/search.ts), AES-256-GCM crypto for the
                      SMTP password at rest, logger, errors (AppError)
modules/
  members/            CRUD + search + import
  sends/               computes Hoje/Próximos/Enviados from real SendLog rows; runDailyJob();
                       markSent/resend with server-side isBirthdayDue() re-validation
  postcard/render.ts   fills the HTML template, Puppeteer -> PDF (own bundled Chromium, see below)
  mail/                Nodemailer transport built from Settings; sendPostcard(); test-connection
  push/                subscribe/unsubscribe; notifyAll(payload)
  settings/            get/update (never returns the SMTP password); VAPID public-key endpoint
  dashboard/           aggregate stats for the dashboard page
jobs/scheduler.ts      node-cron daily job at Settings.sendHour (Europe/Lisbon) + startup catch-up
```

**Channel rule** (`packages/shared/src/channel.ts`, ported verbatim from the original prototype
`design-system/Canvas.dc.html`): email present -> automatic e-mail; else phone present ->
manual WhatsApp; else no channel. This is the single source of truth for both the daily job and
the UI — don't reimplement it inline elsewhere.

**Daily job idempotency**: `SendLog` has `@@unique([memberId, year])`. The job finds members
whose birth month+day is today, skips any with an existing `SendLog` for `(member, currentYear)`,
and only then sends/logs — safe to re-run on restart or a missed day.

**Postcard rendering**: Puppeteer uses its **own downloaded Chromium build**, not a distro
package — this was a deliberate fix for an unresolved SIGTRAP crash under Docker on the
production VPS (see PLAN.md/README.md Troubleshooting). Don't reintroduce
`PUPPETEER_SKIP_DOWNLOAD`/a distro `chromium` install without re-reading that history.

### Frontend (`apps/web/src`)

`theme.ts` holds the exact design tokens ported from `design-system/Canvas.dc.html` (gold
`#c69a2e`/`#a67c00`, background `#f6f3ee`, 760px mobile breakpoint — sidebar collapses to a
drawer + table becomes cards below it). `features/*` are per-page (dashboard, members,
scheduling, settings), each with its own `api.ts` (TanStack Query hooks against the shared zod
types) alongside the page component. `pwa/` handles service worker registration and the push
subscription flow (subscribe with the VAPID public key from `/api/settings/vapid`, POST to
`/api/push/subscribe`).

iOS constraint worth remembering when touching push: Web Push only works on iPhone after
"Add to Home Screen" (iOS 16.4+) over HTTPS — a normal Safari tab never prompts for permission.
This is an Apple platform limitation, not something fixable in this codebase.

### Deployment

Single multi-stage `Dockerfile` (build shared -> web -> api, `pnpm deploy` to prune to
production deps) plus `docker-compose.yml` (`app` + Caddy for automatic HTTPS) — see `README.md`
for the full runbook (DNS, `.env` secrets generation, first boot/seeding, redeploy, backups,
optional Basic-Auth stopgap). The entrypoint (`docker-entrypoint.sh`) always runs
`prisma migrate deploy` on container start.
