import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { formatPostcardDate, parseIsoDate } from '@ffl/shared';
import { config } from '../../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '../../../assets');
const TEMPLATE_PATH = path.join(ASSETS_DIR, 'postal-template.html');
const BG_PATH = path.join(ASSETS_DIR, 'fundo-postal-aniv.png');

let cachedTemplate: string | null = null;
let cachedBgDataUri: string | null = null;

function loadTemplate(): string {
  if (!cachedTemplate) cachedTemplate = readFileSync(TEMPLATE_PATH, 'utf-8');
  return cachedTemplate;
}

function loadBgDataUri(): string {
  if (!cachedBgDataUri) {
    const buf = readFileSync(BG_PATH);
    cachedBgDataUri = `data:image/png;base64,${buf.toString('base64')}`;
  }
  return cachedBgDataUri;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface PostcardMemberInput {
  profaneName: string;
  mysticName?: string | null;
  /** ISO YYYY-MM-DD. Only the day/month are used — the postcard always shows the current year. */
  birthDate?: string | null;
}

/** Fills the postal-template.html tokens and inlines the background as a base64 data URI. */
export function buildPostcardHtml(member: PostcardMemberInput, year = new Date().getFullYear()): string {
  const template = loadTemplate();
  const bgDataUri = loadBgDataUri();

  const parsed = parseIsoDate(member.birthDate);
  const now = new Date();
  const month = parsed?.mo ?? now.getMonth() + 1;
  const day = parsed?.d ?? now.getDate();
  const dateStr = formatPostcardDate(day, month, year);

  const nomeProfano = escapeHtml(member.profaneName.toUpperCase());
  const nomeMistico = member.mysticName ? escapeHtml(member.mysticName) : '';

  return template
    .replaceAll('../assets/fundo-postal-aniv.png', bgDataUri)
    .replaceAll('{{nome_profano}}', nomeProfano)
    .replaceAll('{{nome_mistico}}', nomeMistico)
    .replaceAll('{{data}}', dateStr);
}

export async function renderPostcardPdf(member: PostcardMemberInput, year?: number): Promise<Buffer> {
  const html = buildPostcardHtml(member, year);
  const browser = await puppeteer.launch({
    executablePath: config.puppeteerExecutablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export function postcardFilename(profaneName: string): string {
  const firstName = profaneName.trim().split(/\s+/)[0] ?? 'Postal';
  return `Postal ${firstName}.pdf`;
}
