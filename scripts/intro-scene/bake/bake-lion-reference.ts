/**
 * Raster concept reference -> deterministic LNP1 particle relief.
 *
 * Run with `npm run bake:nav-lion`.
 *
 * The commissioned GLB pipeline survives in `sample.ts` as `sampleLion()`, which
 * nothing imports: there is no `.glb` in the repository and no script to drive it.
 * It is kept because re-modelling would need it back, not because it runs today.
 * This image-driven bake is the art-directed production path: it preserves
 * the facial landmarks and mane silhouette from the approved reference while
 * still feeding the exact same GPU simulation/runtime format.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { packLion } from './pack';
import { mulberry32, type SampledCloud } from './sample';

const DEFAULT_INPUT = 'assets/reference/crowned-lion-particle-reference.png';
const DEFAULT_OUT = 'public/particles';
const LODS = [180_000, 90_000, 45_000] as const;
const SEED = 20260824;
const MAX_LARGEST_BYTES = 1.4 * 1024 * 1024;

type WeightedPixel = { x: number; y: number; luma: number; weight: number };

function pickWeighted(items: WeightedPixel[], cumulative: Float64Array, total: number, random: number) {
  const target = random * total;
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (cumulative[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return items[lo];
}

function buildDistribution(items: WeightedPixel[]) {
  const cumulative = new Float64Array(items.length);
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].weight;
    cumulative[i] = total;
  }
  return { cumulative, total };
}

function reliefDepth(nx: number, ny: number, luma: number, crown: boolean, jitter: number) {
  if (crown) {
    const crownArch = Math.max(0, 1 - (nx / 0.34) ** 2);
    return -0.075 + crownArch * 0.035 + luma * 0.018 + jitter;
  }

  // A shallow bas-relief: mane sits back; brow/muzzle/nose advance toward the camera.
  const face = Math.exp(-((nx / 0.255) ** 2 + ((ny - 0.035) / 0.275) ** 2) * 1.15);
  const muzzle = Math.exp(-((nx / 0.16) ** 2 + ((ny - 0.145) / 0.115) ** 2) * 1.3);
  const brow = Math.exp(-((nx / 0.23) ** 2 + ((ny + 0.035) / 0.09) ** 2) * 1.8);
  return -0.145 + face * 0.14 + muzzle * 0.075 + brow * 0.025 + luma * 0.012 + jitter;
}

function sampleCloud(
  body: WeightedPixel[],
  crown: WeightedPixel[],
  width: number,
  height: number,
  totalCount: number,
): SampledCloud {
  const positions = new Float32Array(totalCount * 3);
  const normals = new Float32Array(totalCount * 3);
  const random = mulberry32(SEED + totalCount);
  const bodyDist = buildDistribution(body);
  const crownDist = buildDistribution(crown);

  // Keep the jewellery legible without letting it overpower the face.
  const crownCount = Math.round(totalCount * 0.14);
  const bodyCount = totalCount - crownCount;

  const write = (index: number, p: WeightedPixel, isCrown: boolean) => {
    const px = (p.x + random() - 0.5) / width;
    const py = (p.y + random() - 0.5) / height;
    const nx = px - 0.5;
    const ny = py - 0.5;
    const scale = 1.72;
    const o = index * 3;
    positions[o] = nx * scale;
    positions[o + 1] = -ny * scale - 0.015;
    positions[o + 2] = reliefDepth(nx, ny, p.luma, isCrown, (random() - 0.5) * 0.012);

    // Front-facing relief normals are sufficient for the existing interaction
    // field; visual tone is driven by the point material rather than lighting.
    normals[o] = nx * 0.12;
    normals[o + 1] = -ny * 0.08;
    normals[o + 2] = 1;
  };

  for (let i = 0; i < bodyCount; i++) {
    write(i, pickWeighted(body, bodyDist.cumulative, bodyDist.total, random()), false);
  }
  for (let i = 0; i < crownCount; i++) {
    write(bodyCount + i, pickWeighted(crown, crownDist.cumulative, crownDist.total, random()), true);
  }

  return { positions, normals, crownStart: bodyCount, crownCount };
}

async function main() {
  const input = resolve(process.argv[2] || DEFAULT_INPUT);
  const outDir = resolve(process.argv[3] || DEFAULT_OUT);
  const source = readFileSync(input);
  const sourceHash = createHash('sha256').update(source).digest('hex').slice(0, 16);

  const { data, info } = await sharp(source)
    .resize(640, 640, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const body: WeightedPixel[] = [];
  const crown: WeightedPixel[] = [];
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const o = (y * info.width + x) * info.channels;
      const r = data[o] / 255;
      const g = data[o + 1] / 255;
      const b = data[o + 2] / 255;
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const goldSignal = Math.max(0, r * 0.46 + g * 0.46 - b * 0.2);
      if (luma < 0.018 || goldSignal < 0.012) continue;

      // Power curve keeps the fine dust while favouring sculptural landmarks.
      const weight = Math.max(0.00001, (luma - 0.012) ** 1.18 * (0.72 + goldSignal));
      // The crown's lower band ends just above the mane. Keeping this mask at
      // 25.2% preserves the lion's natural forehead silhouette when the intro
      // hides the crown; the old 27.5% cut produced a visible horizontal seam.
      const isCrown = y < info.height * 0.252 && x > info.width * 0.245 && x < info.width * 0.755;
      (isCrown ? crown : body).push({ x, y, luma, weight });
    }
  }

  if (body.length < 1_000 || crown.length < 200) {
    throw new Error(`reference segmentation failed (body ${body.length}, crown ${crown.length})`);
  }

  mkdirSync(outDir, { recursive: true });
  let largest = 0;
  for (const count of LODS) {
    const label = `${Math.round(count / 1000)}k`;
    const cloud = sampleCloud(body, crown, info.width, info.height, count);
    const out = join(outDir, `lion-v2-${label}.bin`);
    const bytes = packLion(cloud, { lod: label, seed: SEED, sourceHash }, out);
    largest = Math.max(largest, bytes);
    console.log(`  wrote ${out} — ${count} pts (crown ${cloud.crownCount}), ${(bytes / 1024).toFixed(0)} KB`);
  }

  if (largest > MAX_LARGEST_BYTES) {
    throw new Error(`largest bake ${(largest / 1024 / 1024).toFixed(2)} MB exceeds 1.4 MB`);
  }
  console.log(`✓ reference bake complete — ${body.length} body pixels, ${crown.length} crown pixels`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
