#!/usr/bin/env node
// One-off script — NOT part of the deployed app, never imported by it, never copied into
// the Docker image. Run manually (`pnpm gen:seed` from the repo root) to (re)generate
// apps/api/prisma/seed.sql from the church's CSV. See PLAN.md §9.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_ROOT = path.resolve(__dirname, '..');
const CSV_PATH = path.join(API_ROOT, 'seed-source', 'FFL-SociosAtivos.csv');
const OUT_PATH = path.join(API_ROOT, 'prisma', 'seed.sql');

// Generous per-month day ceiling — just a sanity check against garbage input, not a
// real calendar (leap years don't matter here: we only ever compare month+day, no year math).
const MONTH_MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  return value === null || value === undefined ? 'NULL' : String(value);
}

function cleanNif(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.length === 9 ? digits : null;
}

function cleanPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length !== 9) return null;
  return `+351 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
}

function cleanEmail(raw) {
  const v = (raw || '').trim();
  if (!v || v.toLowerCase() === 'não tem') return null;
  return v;
}

function cleanBirthDate(raw) {
  const v = (raw || '').trim();
  const m = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > MONTH_MAX_DAY[month - 1]) return null;
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { iso, month, day };
}

function cleanTrimOrNull(raw) {
  const v = (raw || '').trim();
  return v ? v : null;
}

const csvText = readFileSync(CSV_PATH, 'utf-8');
const rows = parse(csvText, { relax_column_count: true, skip_empty_lines: true });

// Match the exact convention the Prisma better-sqlite3 adapter itself uses when it writes
// a Date (see @prisma/adapter-better-sqlite3's mapArg: toISOString().replace('Z','+00:00')),
// so seeded rows are byte-for-byte consistent with rows the running app creates later.
const now = new Date().toISOString().replace('Z', '+00:00');

const lines = ['BEGIN TRANSACTION;'];
let written = 0;
let skipped = 0;

for (const row of rows) {
  const profaneName = cleanTrimOrNull(row[2])?.toUpperCase() ?? null;
  if (!profaneName) {
    skipped++;
    continue;
  }
  written++;
  const internalId = `FFL-${String(written).padStart(3, '0')}`;
  const nif = cleanNif(row[1]);
  const phoneNumber = cleanPhone(row[3]);
  const email = cleanEmail(row[4]);
  const birth = cleanBirthDate(row[5]);
  const mysticName = cleanTrimOrNull(row[6]);
  const memberNumber = cleanTrimOrNull(row[7]);

  const values = [
    sqlString(internalId), // id (reuse internalId — see PLAN.md §9.1)
    sqlString(internalId), // internalId
    sqlString(profaneName),
    sqlString(mysticName),
    sqlString(birth?.iso ?? null),
    sqlNumber(birth?.month ?? null),
    sqlNumber(birth?.day ?? null),
    sqlString(nif),
    sqlString(phoneNumber),
    sqlString(email),
    sqlString(memberNumber),
    sqlString(null), // notes — nothing in the source CSV maps to this
    sqlString(now), // createdAt
    sqlString(now), // updatedAt
  ];

  lines.push(
    `INSERT INTO Member (id, internalId, profaneName, mysticName, birthDate, birthMonth, birthDay, nif, phoneNumber, email, memberNumber, notes, createdAt, updatedAt) VALUES (${values.join(',')});`,
  );
}

lines.push('COMMIT;');
writeFileSync(OUT_PATH, lines.join('\n') + '\n', 'utf-8');

console.log(`Generated ${OUT_PATH}`);
console.log(`  ${written} member(s) written, ${skipped} row(s) skipped (no profaneName).`);
