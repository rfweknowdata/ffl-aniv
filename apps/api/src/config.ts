import 'dotenv/config';
import { z } from 'zod';

const boolFromEnv = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? defaultValue : v === 'true'));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  APP_URL: z.string().min(1, 'APP_URL is required'),
  TZ: z.string().default('Europe/Lisbon'),

  DATA_DIR: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY is required'),

  VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID_PUBLIC_KEY is required'),
  VAPID_PRIVATE_KEY: z.string().min(1, 'VAPID_PRIVATE_KEY is required'),
  VAPID_SUBJECT: z.string().default('mailto:admin@ffl.pt'),

  SEND_HOUR: z.coerce.number().int().min(0).max(23).default(8),
  SEED_ON_EMPTY: boolFromEnv(true),

  PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration — see above for details.');
}

const env = parsed.data;

/**
 * better-sqlite3 (and the Prisma driver adapter wrapping it) take a plain filesystem path,
 * not Prisma's traditional "file:" datasource URL — Prisma 7 removed schema-level `url` on
 * SQLite datasources (see prisma/schema.prisma), so the app must strip the prefix itself.
 */
function sqliteUrlToPath(databaseUrl: string): string {
  return databaseUrl.startsWith('file:') ? databaseUrl.slice('file:'.length) : databaseUrl;
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  appUrl: env.APP_URL,
  timezone: env.TZ,
  dataDir: env.DATA_DIR ?? '.',
  databaseUrl: env.DATABASE_URL,
  sqlitePath: sqliteUrlToPath(env.DATABASE_URL),
  encryptionKey: env.ENCRYPTION_KEY,
  vapidPublicKey: env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: env.VAPID_PRIVATE_KEY,
  vapidSubject: env.VAPID_SUBJECT,
  sendHour: env.SEND_HOUR,
  seedOnEmpty: env.SEED_ON_EMPTY,
  puppeteerExecutablePath: env.PUPPETEER_EXECUTABLE_PATH || undefined,
} as const;
