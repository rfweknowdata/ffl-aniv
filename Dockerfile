# syntax=docker/dockerfile:1

# ---------- build ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
# Let Puppeteer download its own tested Chromium build here (needs unzip to extract it).
# We tried the distro `chromium` package first (smaller image, no download) but it crashes
# with an unresolved SIGTRAP in crashpad's init on this VPS's kernel/container combo —
# not fixable via --no-sandbox/--disable-dev-shm-usage/seccomp=unconfined/SYS_PTRACE/
# --single-process (all tried). Puppeteer's own bundled build is the well-supported path.
RUN apt-get update && apt-get install -y --no-install-recommends unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @ffl/shared build \
 && pnpm --filter @ffl/web build \
 && pnpm --filter @ffl/api build

RUN pnpm deploy --filter @ffl/api --prod /prod/api

# ---------- runtime ----------
FROM node:22-bookworm-slim
ENV NODE_ENV=production

# Chromium's shared library dependencies (same set the distro `chromium` package pulls in) —
# installed without the package itself since we run Puppeteer's own downloaded binary instead.
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-liberation ca-certificates tini \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
      libpangocairo-1.0-0 libgtk-3-0 libx11-xcb1 libxss1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /root/.cache/puppeteer /root/.cache/puppeteer
COPY --from=build /prod/api ./
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/apps/api/assets ./assets
COPY --from=build /app/apps/web/dist ./public
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && mkdir -p /data

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
