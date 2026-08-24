/**
 * pnpm poster — deliverable #4: AVIF + WebP still matching the idle frame,
 * for the no-WebGL2 tier and social cards. Deterministic SVG rendition of the
 * composition (same layout math as the component), encoded via sharp. The
 * fallback mirrors the live particle-only network scan; it contains no stars.
 *
 * Once the scene is final, re-capture from /demo and re-encode through this
 * script to keep formats/sizes consistent.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

const W = 1600;
const H = 1600;
const CX = W / 2;
const CY = H / 2;
const SCALE = 118; // px per world unit — mirrors the component framing

const GOLD = '#C9A24B';
const BLUE = '#6FA8DC';
const BG = '#070B14';

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NODE_CENTRES = Array.from({ length: 8 }, (_, i) => {
  const a = Math.PI / 2 - (i / 8) * Math.PI * 2;
  return { x: CX + Math.cos(a) * W * 0.36, y: CY - Math.sin(a) * H * 0.4 };
});

function excluded(x: number, y: number) {
  if (((x - CX) / 255) ** 2 + ((y - CY) / 230) ** 2 < 1) return true;
  return NODE_CENTRES.some((node) => Math.hypot(x - node.x, y - node.y) < 105);
}

function networkScan(rng: () => number, rows: number): string {
  let s = '';
  for (let row = 0; row < rows; row++) {
    const y = ((row + 0.5) / rows) * H + (rng() - 0.5) * 8;
    const segments = 7 + Math.floor(rng() * 9);
    for (let j = 0; j < segments; j++) {
      const x0 = rng() * W;
      const length = 30 + rng() * 150;
      const spacing = 4 + rng() * 4;
      for (let x = x0; x < Math.min(W, x0 + length); x += spacing) {
        if (!excluded(x, y) && rng() > 0.16) {
          s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.55 + rng() * 0.75).toFixed(2)}" fill="${BLUE}" opacity="${(0.18 + rng() * 0.34).toFixed(2)}"/>`;
        }
      }
    }
  }
  return s;
}

const INTEL_LABELS = [
  ['DISINFORMATION NETWORK', 82, 164],
  ['FAKE NEWS FACTORY', 1190, 112],
  ['INCITEMENT SIGNAL', 330, 310],
  ['HOSTILE INFLUENCE', 92, 510],
  ['COORDINATED NARRATIVE', 1210, 505],
  ['BOT CLUSTER', 1110, 880],
  ['ANTI-ISRAEL CAMPAIGN', 115, 1055],
  ['NARRATIVE SPIKE', 1210, 1090],
  ['SOURCE UNVERIFIED', 350, 1365],
  ['HATE AMPLIFICATION', 930, 1335],
] as const;

function dottedRing(r: number, n: number, opacity: number): string {
  let s = '';
  for (let i = 0; i < n; i++) {
    const dash = (i / n) * 24;
    if (dash % 1 > 0.62) continue;
    const a = (i / n) * Math.PI * 2;
    s += `<circle cx="${(CX + Math.cos(a) * r).toFixed(1)}" cy="${(CY + Math.sin(a) * r).toFixed(1)}" r="1.1" fill="${GOLD}" opacity="${opacity}"/>`;
  }
  return s;
}

async function main() {
  const rng = mulberry(20260824);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <radialGradient id="g" cx="50%" cy="50%" r="60%">
    <stop offset="0%" stop-color="#101a30" stop-opacity="0.9"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${networkScan(rng, 46)}
  <g fill="${BLUE}" opacity="0.78" font-family="Arial, sans-serif" font-size="18" font-weight="600" letter-spacing="1.5">
    ${INTEL_LABELS.map(([label, x, y]) => `<text x="${x}" y="${y}">${label}</text>`).join('')}
  </g>
  ${dottedRing(1.12 * SCALE, 170, 0.18)}
  ${dottedRing(1.36 * SCALE, 220, 0.16)}
  ${dottedRing(1.62 * SCALE, 280, 0.14)}
</svg>`;

  const outDir = resolve('public/posters');
  mkdirSync(outDir, { recursive: true });
  const lion = await sharp(resolve('assets/reference/crowned-lion-particle-reference.png'))
    .resize(400, 400, { fit: 'contain' })
    .png()
    .toBuffer();
  const base = sharp(Buffer.from(svg)).composite([
    {
      input: lion,
      left: Math.round(CX - 200),
      top: Math.round(CY - 200),
      blend: 'screen',
    },
  ]);
  await base.clone().avif({ quality: 55 }).toFile(resolve(outDir, 'particle-nav.avif'));
  await base.clone().webp({ quality: 72 }).toFile(resolve(outDir, 'particle-nav.webp'));
  console.log('✓ wrote public/posters/particle-nav.{avif,webp}');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
