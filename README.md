# Postais Fiat Lux

Automates the Fraternidade Fiat Lux's birthday postcard: a daily job finds members whose
birthday is today, generates the postcard PDF, and e-mails it automatically (or — for
phone-only members — surfaces a manual "send via WhatsApp" item with a PDF download). See
`PLAN.md` for the full technical plan, data model, and a log of real gotchas hit during the
build (worth reading before touching deployment).

## Stack

Monorepo (pnpm workspaces): `apps/api` (Fastify + Prisma/SQLite + Puppeteer + Nodemailer +
web-push), `apps/web` (React + Vite), `packages/shared` (zod schemas + types used by both).
Ships as a single Docker image; Caddy in front does automatic HTTPS.

## Local development

```
corepack enable
pnpm install
pnpm --filter @ffl/shared build
cp apps/api/.env.example apps/api/.env   # fill in ENCRYPTION_KEY / VAPID_* (see below)
pnpm --filter @ffl/api exec prisma migrate dev
pnpm dev:api     # http://localhost:3000
pnpm dev:web     # http://localhost:5173 (proxies /api to the API above)
```

Generate local secrets:
```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # ENCRYPTION_KEY
pnpm gen:vapid                                                                 # VAPID_PUBLIC/PRIVATE_KEY
```

For testing outgoing e-mail locally without a real SMTP server, run
`docker compose -f docker-compose.yml -f docker-compose.dev.yml up mailpit` and point
Definições at host `mailpit`, port `1025`, "Ligação segura" off. Its web UI is at
`http://localhost:8025`.

## Deploying to a VPS

This has been deployed and verified end-to-end on a Debian 12 OVH VPS. Steps:

1. **DNS**: point an A record at the VPS's public IP.
2. **Server prerequisites**: Docker + the Compose plugin installed; ports 80 and 443 open.
3. **Get the code onto the server** — either `git clone` the repo, or `git pull` if it's already
   there.
4. **Create `.env`** in the repo root (not committed — see `.env.example` for the full list):
   ```
   cp .env.example .env
   # then fill in APP_URL, ENCRYPTION_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY at minimum
   ```
   Generate `ENCRYPTION_KEY` with `openssl rand -base64 32`. Generate VAPID keys with:
   ```
   docker run --rm node:22-bookworm-slim npx --yes web-push generate-vapid-keys
   ```
5. **Edit `Caddyfile`** — replace `ffl.pt` with your actual domain if different.
6. **Build and start**:
   ```
   docker compose up -d --build
   ```
   First boot runs migrations and, if the `Member` table is empty, seeds the 140 members from
   `apps/api/prisma/seed.sql` automatically. Caddy provisions the TLS certificate automatically
   on first request — give it a few seconds after startup.
7. **Verify**: `curl https://yourdomain/api/health` → `{"ok":true}`. Then open the site, go to
   **Definições**, configure real SMTP, and send a test e-mail.
8. **On iPhone**: open the site in Safari → Share → **Add to Home Screen** → open the installed
   app → Definições → **Ativar notificações neste dispositivo**. Web Push on iOS *only* works
   from an installed Home Screen app over HTTPS — a normal Safari tab won't prompt for
   permission at all. This is an Apple platform limitation, not a bug.

### Redeploying after a code change

```
git pull
docker compose up -d --build
```
The `app` container's entrypoint always re-runs `prisma migrate deploy` on boot, so new
migrations apply automatically. The seed only ever runs once (guarded by the `Member` table
being empty), so it's safe to redeploy repeatedly.

### Backups

The entire app's state is the SQLite file on the `app-data` volume — back up
`/var/lib/docker/volumes/<project>_app-data/_data/app.db` (or use `docker compose cp
app:/data/app.db ./backup-$(date +%F).db`).

### Optional: password-gate the whole site

v1 ships with no login (see `PLAN.md` §0 for why, and the built-in "auth seam" for adding real
login later). As a stopgap, `Caddyfile` has a commented-out `basic_auth` block — uncomment it
and set a bcrypt hash (`docker run --rm caddy caddy hash-password --plaintext 'yourpassword'`)
to require a password at the edge for everyone.

## Troubleshooting

- **Puppeteer/Chromium crashes in Docker** (`Trace/breakpoint trap`, SIGTRAP, wall of `dbus`
  errors): this happened with the Debian-packaged `chromium` binary on this specific VPS and
  wasn't fixable via `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`, `--no-zygote`,
  `--single-process`, `seccomp=unconfined`, or `--cap-add=SYS_PTRACE`. The fix already applied:
  the Dockerfile lets Puppeteer download and use its **own** tested Chromium build instead of
  the distro package (see the Dockerfile's build stage). If this somehow resurfaces on a
  different host, that's the area to revisit.
- **`Cannot find module './generated/prisma/client.js'`**: means `prisma generate` didn't run
  before `tsc`. `apps/api/package.json`'s `build`/`dev`/`typecheck` scripts already run
  `prisma generate` first — don't reorder them (see `PLAN.md` §4's implementation note).
