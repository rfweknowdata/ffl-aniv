# syntax=docker/dockerfile:1

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
 && pnpm --filter @ffl/api build

RUN pnpm deploy --filter @ffl/api --prod /prod/api

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
COPY --from=build /app/apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/apps/api/assets ./assets
COPY --from=build /app/apps/web/dist ./public
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && mkdir -p /data

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
