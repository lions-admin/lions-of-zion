#!/usr/bin/env node
/**
 * The site's share card, composed from the keyed cover lion and the brand
 * type — a reproducible job, like `key-lion.mjs` which must run first.
 *
 *   node scripts/brand/og-image.mjs     writes app/opengraph-image.png (1200×630)
 *
 * The card is the cover's first screen in miniature: the wordmark in the
 * site grotesk at the display weight, the standfirst, the signal rule with
 * its stub, and the uncrowned lion on the right two-fifths over the flat
 * navy ground. 1200×630 is the one size every network crops from without
 * letterboxing; the previous 1731×909 render was 2.1 MB and printed the
 * retired serif wordmark.
 *
 * Type is rasterised by librsvg through fontconfig, so Schibsted Grotesk has
 * to be installed for the user running this (Google Fonts serves the TTF —
 * put it in ~/.fonts and run fc-cache). The script checks and refuses to
 * write a card in a fallback face.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const COVER = path.join(ROOT, "public/brand/cover");
const OUT = path.join(ROOT, "app/opengraph-image.png");
const W = 1200;
const H = 630;
const GROUND = "#0b1220";
const INK_HI = "#f3efe6";
const INK = "#cbcfd8";
const GOLD = "#d8b45f";

const installed = execFileSync("fc-list", [":family=Schibsted Grotesk", "family"], { encoding: "utf8" });
if (!/Schibsted Grotesk/.test(installed)) {
  console.error("Schibsted Grotesk is not installed for fontconfig; refusing to render the card in a fallback face.");
  process.exit(1);
}

/* The signal rule: a 1px gold line whose head is five 1.5px bars on a 4px
   pitch at fixed heights 3/7/11/5/9 — the same geometry as
   components/brand/SignalMark.tsx. */
function signalRule(x, y, width) {
  const heights = [3, 7, 11, 5, 9];
  const bars = heights
    .map((h, i) => `<rect x="${x + i * 4}" y="${y - h}" width="1.5" height="${h}" fill="${GOLD}"/>`)
    .join("");
  return `${bars}<rect x="${x + 22}" y="${y - 1}" width="${width - 22}" height="1" fill="${GOLD}"/>`;
}

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <g font-family="Schibsted Grotesk" fill="${INK_HI}">
    <text x="88" y="150" font-size="22" font-weight="600" letter-spacing="1.8" fill="${GOLD}">EVIDENCE, NOT NARRATIVES</text>
    <text x="84" y="290" font-size="128" font-weight="700" letter-spacing="-5.8">LIONS</text>
    <text x="84" y="412" font-size="128" font-weight="700" letter-spacing="-5.8">OF ZION</text>
    <text x="88" y="486" font-size="34" font-weight="400" letter-spacing="-0.3" fill="${INK}">Truth has a signal. Find it, check it, share it.</text>
  </g>
  ${signalRule(88, 548, 240)}
  <text x="88" y="586" font-family="Schibsted Grotesk" font-size="20" font-weight="500" fill="${INK}" opacity="0.8">lionsofzion.io</text>
</svg>`;

/* The lion sits on the right, its chin below the card's edge, so the card
   crops it the way the phone cover does. sharp refuses a composite input
   larger than the canvas, so the layer is clipped to the card's box first.
   The type SVG carries no background of its own: it is composited last and
   a filled rect there would cover the lion (which is how the first render
   of this card came out as type alone). */
const lionSize = 760;
const place = { left: W - lionSize + 60, top: -30 };
const clip = {
  left: Math.max(0, -place.left),
  top: Math.max(0, -place.top),
  width: Math.min(lionSize, W - Math.max(0, place.left)) - Math.max(0, -place.left),
  height: Math.min(lionSize, H - Math.max(0, place.top)) - Math.max(0, -place.top),
};
const layer = async (name) =>
  sharp(path.join(COVER, `${name}-1254.webp`)).resize(lionSize, lionSize).extract(clip).png().toBuffer();
const haze = await layer("lion-haze");
const core = await layer("lion-core");
const left = Math.max(0, place.left);
const top = Math.max(0, place.top);

await sharp({ create: { width: W, height: H, channels: 3, background: GROUND } })
  .composite([
    { input: haze, left, top },
    { input: core, left, top },
    { input: Buffer.from(svg), left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9, palette: false })
  .toFile(OUT);
const bytes = (await import("node:fs")).statSync(OUT).size;
console.log(`wrote ${path.relative(ROOT, OUT)} ${W}×${H} ${(bytes / 1024).toFixed(0)} kB`);
