import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { loggerOptions, logger } from './lib/logger.js';
import { requireAuth } from './plugins/auth.js';
import { AppError } from './lib/errors.js';
import { bootSeed } from './bootSeed.js';
import { membersRoutes } from './modules/members/routes.js';
import { sendsRoutes } from './modules/sends/routes.js';
import { settingsRoutes } from './modules/settings/routes.js';
import { pushRoutes } from './modules/push/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { startScheduler } from './jobs/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function extractError(err: unknown): { statusCode: number; message: string } {
  if (err && typeof err === 'object') {
    const maybe = err as { statusCode?: unknown; message?: unknown };
    return {
      statusCode: typeof maybe.statusCode === 'number' ? maybe.statusCode : 500,
      message: typeof maybe.message === 'string' ? maybe.message : 'Erro interno',
    };
  }
  return { statusCode: 500, message: 'Erro interno' };
}

export function buildServer() {
  const app = Fastify({ logger: loggerOptions });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof AppError) {
      reply.status(err.statusCode).send({ error: err.message, details: err.details });
      return;
    }
    // Respect Fastify-native errors' own statusCode (body parsing, payload-too-large, etc.)
    // instead of blanket-500ing everything that isn't our own AppError.
    const { statusCode, message } = extractError(err);
    if (statusCode >= 500) {
      request.log.error(err);
      reply.status(statusCode).send({ error: 'Erro interno' });
      return;
    }
    reply.status(statusCode).send({ error: message });
  });

  app.register(
    async (api) => {
      api.addHook('preHandler', requireAuth);
      api.get('/health', async () => ({ ok: true }));
      api.register(membersRoutes, { prefix: '/members' });
      api.register(sendsRoutes, { prefix: '/sends' });
      api.register(settingsRoutes, { prefix: '/settings' });
      api.register(pushRoutes, { prefix: '/push' });
      api.register(dashboardRoutes, { prefix: '/dashboard' });
    },
    { prefix: '/api' },
  );

  if (config.isProduction) {
    const publicDir = path.join(__dirname, '..', 'public');
    app.register(fastifyStatic, { root: publicDir });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api')) {
        reply.status(404).send({ error: 'Not found' });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  return app;
}

async function main() {
  await bootSeed();
  const app = buildServer();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  await startScheduler();
}

process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'Unhandled rejection');
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
