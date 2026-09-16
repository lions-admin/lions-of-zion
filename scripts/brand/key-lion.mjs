#!/usr/bin/env node
/**
 * The cover lion, keyed into alpha layers — a one-time, reproducible asset job.
 *
 *   node scripts/brand/key-lion.mjs                     write public/brand/cover/*
 *   node scripts/brand/key-lion.mjs --check             measure only, write nothing
 *   node scripts/brand/key-lion.mjs --preview <dir>     also write flat PNG previews
 *                                                       (composite, core, haze) there
 *                                                       for the eye — never into public/
 *
 * Source: the owner's 2026-08-28 particle render, `assets/reference/
 * crowned-lion-particle-reference.png` (1254², gold particles on black). The
 * cover composites the lion over the site's navy ground and moves it in two
 * depths as the reader scrolls, so it needs the lion as *straight-alpha
 * layers*, not as a picture with a black background baked in.
 *
 * Keying. The render is additive light on black, which makes "black is
 * transparent" exact rather than approximate: a pixel c painted over black
 * is premultiplied colour, so alpha = max(r, g, b) and the straight colour
 * is c / alpha. There is no dark fringe to fight because the straight colour
 * of a half-transparent particle is *bright*; the composite over any ground
 * reproduces the render's own light. A 2% floor kills sensor noise.
 *
 * The crown. By owner-ruling default (decision 2, `.ai/DECISIONS.md`
 * 2026-09-15) the lion on screen is uncrowned. The crown floats free above
 * the mane in this render — the row profile has a trough at y≈265–290
 * between the crown's base and the first mane tufts — so a soft vertical
 * ramp from y=296 to y=352 removes it without retouching, and the top of
 * the mane dissolves upward into particles the way the rest of the edge
 * does. (A ramp starting at 268 left a faint arc of the crown's base band
 * at half alpha; starting it where the mane begins costs a few top tufts
 * that were dissolving anyway.) Nothing is painted; only alpha is shaped.
 *
 * Two layers, split spatially rather than per pixel (a per-pixel alpha
 * split would interleave face and haze particles and both layers would
 * read as noise):
 *
 *   core  the face — an ellipse on the eyes/muzzle with a 140px feather.
 *         Holds on the cover; translates ~12vh and fades over the runway.
 *   haze  the mane and the dispersing particles — everything else inside
 *         the outer vignette. Translates ~22vh, faster, and dims first:
 *         that difference is the parallax.
 *
 * The outer vignette (cx 627, cy 780, rx 590, ry 640, 90px feather) removes
 * the stray dots the render scattered to the corners; on the cover those
 * would read as dust on a flat ground.
 *
 * Output: AVIF and WebP for each layer at the source's 1254px and a 800px
 * cut for phones. The job measures itself: the composite of both layers over
 * `--ground` (#0b1220) must match the render's own light over that ground
 * inside the lion (no fringe), and a ring outside the vignette must be
 * exactly the ground (no halo). Byte budget: 4 MB hard (the script fails),
 * 400 kB desktop target and 250 kB phone target (reported).
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const SRC = path.join(ROOT, "assets/reference/crowned-lion-particle-reference.png");
const OUT = path.join(ROOT, "public/brand/cover");
const CHECK_ONLY = process.argv.includes("--check");
const PREVIEW_DIR = (() => {
  const at = process.argv.indexOf("--preview");
  return at === -1 ? null : path.resolve(process.argv[at + 1]);
})();
const GROUND = [0x0b, 0x12, 0x20];

const smooth = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const C = info.channels;

/* Geometry, in source pixels. Measured from the row/column light profile of
   the render (see the header) and checked by eye on the composite preview. */
const CROWN_RAMP = [296, 352];
const OUTER = { cx: 627, cy: 780, rx: 590, ry: 640, feather: 90 };
const CORE = { cx: 627, cy: 700, rx: 330, ry: 400, feather: 140 };

function ellipse(shape, x, y) {
  /* 0 inside, 1 at the edge, >1 outside, in normalised radius. */
  const dx = (x - shape.cx) / shape.rx;
  const dy = (y - shape.cy) / shape.ry;
  return Math.sqrt(dx * dx + dy * dy);
}

const core = Buffer.alloc(W * H * 4);
const haze = Buffer.alloc(W * H * 4);
let lionPixels = 0;

for (let y = 0; y < H; y++) {
  const crown = smooth(CROWN_RAMP[0], CROWN_RAMP[1], y);
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const m = Math.max(r, g, b) / 255;
    let alpha = m < 0.02 ? 0 : m;
    /* Outer vignette: 1 inside, ramps to 0 across the feather. */
    const ro = ellipse(OUTER, x, y);
    const outerFeather = OUTER.feather / Math.min(OUTER.rx, OUTER.ry);
    alpha *= 1 - smooth(1, 1 + outerFeather, ro);
    alpha *= crown;
    if (alpha <= 0) continue;
    lionPixels += 1;
    /* Straight colour: un-premultiply over black, clamped. */
    const sr = Math.min(255, Math.round(r / m));
    const sg = Math.min(255, Math.round(g / m));
    const sb = Math.min(255, Math.round(b / m));
    const rc = ellipse(CORE, x, y);
    const coreFeather = CORE.feather / Math.min(CORE.rx, CORE.ry);
    const coreWeight = 1 - smooth(1, 1 + coreFeather, rc);
    /* The two layers are composited core-over-haze, so their alphas cannot
       simply share `alpha` by weight: over-compositing gives an effective
       alpha of ac + ah(1 - ac), which is *less* than `alpha` wherever both
       are partial — a visible dark band along the feather (measured at 75/255
       before this line existed). Solve for the core alpha that restores it:
       ah = alpha(1 - w), ac = (alpha - ah) / (1 - ah). */
    const ah = alpha * (1 - coreWeight);
    const ac = ah >= 1 ? 0 : (alpha - ah) / (1 - ah);
    const o = (y * W + x) * 4;
    core[o] = sr; core[o + 1] = sg; core[o + 2] = sb; core[o + 3] = Math.round(ac * 255);
    haze[o] = sr; haze[o + 1] = sg; haze[o + 2] = sb; haze[o + 3] = Math.round(ah * 255);
  }
}

/* ---- checks: fringe inside the lion, halo outside it ---------------------- */
let maxFringe = 0;
let ringSum = [0, 0, 0];
let ringN = 0;
for (let y = 0; y < H; y += 3) {
  for (let x = 0; x < W; x += 3) {
    const o = (y * W + x) * 4;
    const i = (y * W + x) * C;
    const ac = core[o + 3] / 255;
    const ah = haze[o + 3] / 255;
    /* haze under core, both over the ground */
    const over = [0, 1, 2].map((k) => {
      const onGround = haze[o + k] * ah + GROUND[k] * (1 - ah);
      return core[o + k] * ac + onGround * (1 - ac);
    });
    const ro = ellipse(OUTER, x, y);
    if (ro > 1.25 && ro < 1.6) {
      ringSum = ringSum.map((s, k) => s + over[k]);
      ringN += 1;
    } else if (ro < 0.95 && y > CROWN_RAMP[1]) {
      /* The render's own light over the navy: additive, clamped. */
      const additive = [data[i], data[i + 1], data[i + 2]].map((v, k) => Math.min(255, v + GROUND[k]));
      const diff = Math.max(...additive.map((v, k) => Math.abs(v - over[k])));
      if (diff > maxFringe) maxFringe = diff;
    }
  }
}
const ring = ringSum.map((s) => Math.round(s / ringN));
const haloOk = ring.every((v, k) => Math.abs(v - GROUND[k]) <= 1);
console.log(`lion pixels ${lionPixels} · ring outside the vignette ${ring.join(",")} vs ground ${GROUND.join(",")} → ${haloOk ? "no halo" : "HALO"}`);
console.log(`max composite-vs-render difference inside the lion: ${maxFringe} / 255 (a bright particle over navy loses at most the navy's own value under it)`);
if (!haloOk) process.exit(1);

if (CHECK_ONLY) process.exit(0);

/* ---- encode --------------------------------------------------------------- */
mkdirSync(OUT, { recursive: true });
const layers = [
  ["lion-core", core],
  ["lion-haze", haze],
];
const sizes = [1254, 800];
const written = [];
for (const [name, buf] of layers) {
  const base = sharp(buf, { raw: { width: W, height: H, channels: 4 } });
  const trimmed = await base.png().toBuffer();
  for (const size of sizes) {
    const image = sharp(trimmed).resize(size, size, { kernel: "lanczos3" });
    const avif = path.join(OUT, `${name}-${size}.avif`);
    const webp = path.join(OUT, `${name}-${size}.webp`);
    /* 4:2:0 chroma: the particles are one hue, so the colour planes carry
       nothing at full resolution; the alpha plane, which is where the
       detail lives, is never subsampled. */
    await image.clone().avif({ quality: 46, effort: 7, chromaSubsampling: "4:2:0" }).toFile(avif);
    await image.clone().webp({ quality: 74, alphaQuality: 78, effort: 6 }).toFile(webp);
    written.push(avif, webp);
  }
}
/* Flat previews over the ground, for the eye only — they are megabytes of
   PNG and never belong under public/. */
if (PREVIEW_DIR) {
  mkdirSync(PREVIEW_DIR, { recursive: true });
  const ground = { create: { width: W, height: H, channels: 3, background: { r: GROUND[0], g: GROUND[1], b: GROUND[2] } } };
  await sharp(ground)
    .composite([
      { input: await sharp(haze, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer() },
      { input: await sharp(core, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer() },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(PREVIEW_DIR, "lion-composite-1254.png"));
  for (const [name, buf] of layers) {
    const flat = await sharp(ground)
      .composite([{ input: await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer() }])
      .png()
      .toBuffer();
    await sharp(flat).resize(627, 627).png().toFile(path.join(PREVIEW_DIR, `${name}-627.png`));
  }
}

let total = 0;
for (const file of written) {
  const kb = statSync(file).size / 1024;
  total += kb;
  console.log(`${path.relative(ROOT, file).padEnd(44)} ${kb.toFixed(1).padStart(7)} kB`);
}
const desktopAvif = ["lion-core-1254.avif", "lion-haze-1254.avif"].reduce((s, f) => s + statSync(path.join(OUT, f)).size / 1024, 0);
const phoneAvif = ["lion-core-800.avif", "lion-haze-800.avif"].reduce((s, f) => s + statSync(path.join(OUT, f)).size / 1024, 0);
console.log(`desktop AVIF pair ${desktopAvif.toFixed(0)} kB (target 400) · phone AVIF pair ${phoneAvif.toFixed(0)} kB (target 250) · all formats ${total.toFixed(0)} kB (hard budget 4096)`);
writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({
  source: path.relative(ROOT, SRC),
  ground: "#0b1220",
  crownRamp: CROWN_RAMP,
  outer: OUTER,
  core: CORE,
  files: written.map((f) => path.relative(ROOT, f)),
  desktopAvifKb: Math.round(desktopAvif),
  phoneAvifKb: Math.round(phoneAvif),
}, null, 2) + "\n");
if (total > 4096) {
  console.error("cover assets exceed the 4 MB hard budget");
  process.exit(1);
}
