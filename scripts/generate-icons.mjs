#!/usr/bin/env node
// One-off script — not part of the deployed app. Generates the PWA icon set from a simple
// SVG mark (gold "sunburst" on ivory — Fiat Lux, "let there be light") using the brand colors
// from apps/web/src/theme.ts. Run: node scripts/generate-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'apps', 'web', 'public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

const IVORY = '#f6f3ee';
const GOLD = '#c69a2e';

function sunburstSvg({ size, cornerRadius, sunRadius, rayLength, rayWidth, rayGap }) {
  const c = size / 2;
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i;
    const x1 = c + Math.cos(angle) * (sunRadius + rayGap);
    const y1 = c + Math.sin(angle) * (sunRadius + rayGap);
    const x2 = c + Math.cos(angle) * (sunRadius + rayGap + rayLength);
    const y2 = c + Math.sin(angle) * (sunRadius + rayGap + rayLength);
    rays.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`);
  }
  const bg =
    cornerRadius > 0
      ? `<rect width="${size}" height="${size}" rx="${cornerRadius}" fill="${IVORY}"/>`
      : `<rect width="${size}" height="${size}" fill="${IVORY}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${bg}
  <circle cx="${c}" cy="${c}" r="${sunRadius}" fill="${GOLD}"/>
  <g stroke="${GOLD}" stroke-width="${rayWidth}" stroke-linecap="round">${rays.join('')}</g>
</svg>`;
}

async function render(svg, size, filename) {
  const outPath = path.join(OUT_DIR, filename);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log('Wrote', outPath);
}

const standard = (size) =>
  sunburstSvg({
    size,
    cornerRadius: size * 0.19,
    sunRadius: size * 0.195,
    rayLength: size * 0.1,
    rayWidth: size * 0.043,
    rayGap: size * 0.035,
  });

// Maskable: full-bleed background (OS applies its own shape mask), content kept inside the
// ~80%-diameter safe zone so nothing important gets clipped.
const maskable = (size) =>
  sunburstSvg({
    size,
    cornerRadius: 0,
    sunRadius: size * 0.137,
    rayLength: size * 0.078,
    rayWidth: size * 0.035,
    rayGap: size * 0.078,
  });

await render(standard(192), 192, 'icon-192.png');
await render(standard(512), 512, 'icon-512.png');
await render(maskable(512), 512, 'icon-maskable-512.png');
await render(standard(180), 180, 'apple-touch-icon.png');

// A tiny multi-purpose favicon-sized PNG too (browsers happily use a PNG favicon).
await render(standard(48), 48, 'favicon-48.png');

writeFileSync(path.join(OUT_DIR, 'source.svg'), standard(512), 'utf-8');
console.log('Done.');
