/**
 * pnpm bake:icons — every SVG in assets/source/icons → 512² single-channel SDF PNG
 * in public/icons/<name>.sdf.png.
 *
 * Icons stay swappable without a lion re-bake: the client places icon-cluster
 * particles by GPU rejection sampling against these textures at runtime.
 *
 * Pipeline: rasterise at 4× (2048²) via sharp → binarise → exact euclidean
 * distance transform (Felzenszwalb–Huttenlocher, both polarities) → signed
 * distance, downsampled to 512², encoded 128 = edge, ±spread px mapped to 0..255.
 */
import { readdirSync, mkdirSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import sharp from 'sharp';

const SRC = resolve('assets/source/icons');
const OUT = resolve('public/icons');
const HI = 2048;
const LO = 512;
const SPREAD_HI = 160; // px at HI res mapped to full range

const INF = 1e20;

/** 1D squared distance transform (Felzenszwalb & Huttenlocher). */
function dt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** 2D squared EDT of an indicator grid (0 where feature, INF elsewhere), in place. */
function edt2d(grid: Float64Array, w: number, h: number): void {
  const f = new Float64Array(Math.max(w, h));
  const d = new Float64Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h));
  const z = new Float64Array(Math.max(w, h) + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    dt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    dt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
}

async function bakeOne(svgPath: string): Promise<void> {
  const name = basename(svgPath, '.svg');
  const { data } = await sharp(svgPath, { density: (72 * HI) / 100 })
    .resize(HI, HI, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = HI * HI;
  const inside = new Float64Array(n);
  const outside = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const solid = data[i * 4 + 3] > 127;
    inside[i] = solid ? 0 : INF;
    outside[i] = solid ? INF : 0;
  }
  edt2d(inside, HI, HI);
  edt2d(outside, HI, HI);

  // signed distance at LO res: positive inside, negative outside
  const out = Buffer.alloc(LO * LO);
  const step = HI / LO;
  for (let y = 0; y < LO; y++) {
    for (let x = 0; x < LO; x++) {
      const hx = Math.min(HI - 1, Math.round((x + 0.5) * step));
      const hy = Math.min(HI - 1, Math.round((y + 0.5) * step));
      const i = hy * HI + hx;
      const sd = Math.sqrt(inside[i]) - Math.sqrt(outside[i]); // <0 inside, >0 outside
      const norm = Math.max(-1, Math.min(1, -sd / SPREAD_HI)); // + inside
      out[y * LO + x] = Math.round(127.5 + norm * 127.5);
    }
  }

  const outPath = join(OUT, `${name}.sdf.png`);
  await sharp(out, { raw: { width: LO, height: LO, channels: 1 } })
    .png({ compressionLevel: 9, colours: 256 })
    .toFile(outPath);
  console.log(`  wrote ${outPath}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const svgs = readdirSync(SRC).filter((f) => f.endsWith('.svg'));
  if (svgs.length === 0) throw new Error(`no SVGs found in ${SRC}`);
  console.log(`bake:icons — ${svgs.length} icons`);
  for (const f of svgs) await bakeOne(join(SRC, f));
  console.log('✓ icons baked');
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
