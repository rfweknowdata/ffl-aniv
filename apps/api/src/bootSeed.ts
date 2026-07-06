import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './db.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Runs prisma/seed.sql (generated once, offline — see scripts/generate-seed.mjs and
 * PLAN.md §9) directly against the SQLite file via better-sqlite3, but only when the
 * Member table is genuinely empty. Safe to call on every boot: idempotent, and a no-op
 * once the app has real data.
 */
export async function bootSeed(): Promise<void> {
  if (!config.seedOnEmpty) return;

  const count = await prisma.member.count();
  if (count > 0) {
    logger.info({ count }, 'Members already present — skipping seed');
    return;
  }

  const seedPath = path.join(__dirname, '..', 'prisma', 'seed.sql');
  if (!existsSync(seedPath)) {
    logger.warn(
      { seedPath },
      'No seed.sql found — skipping seed (run `pnpm gen:seed` at the repo root to create it)',
    );
    return;
  }

  logger.info('Member table is empty — running one-time seed...');
  const sql = readFileSync(seedPath, 'utf-8');
  const db = new Database(config.sqlitePath);
  try {
    db.exec(sql);
  } finally {
    db.close();
  }

  const after = await prisma.member.count();
  logger.info({ count: after }, 'Seed complete');
}
