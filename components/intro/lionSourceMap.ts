/**
 * Lion → text particle lineage. CPU-only, DB-free, allocation-free per frame:
 * everything here runs once per text set, when the lion bake or the quantised
 * layout changes — never inside `useFrame`.
 *
 * Two consumers must agree on the same subset of lion particles:
 *
 *   - `tsl/introTextMaterial.ts` starts every text particle at a sampled lion
 *     home, so the stream is read as *those* particles leaving the lion;
 *   - `tsl/pointMaterial.ts` dims that subset on the lion while the transfer
 *     is active, so the lion is seen to give them up and take them back.
 *
 * The material cannot know the mapping, and the text cannot reach the lion's
 * storage, so the subset is defined by a hash both sides can evaluate:
 * `pcgHash01(index + seed) < LION_EXTRACTION_FRACTION`. `pcgHash01` is the
 * exact PCG mix behind TSL's `hash()` (three/src/nodes/math/Hash.js), so a
 * pool selected here is the pool the lion shader dims. The seed is per line,
 * which is what stops the same 6% of the lion flickering on every row.
 *
 * Text particles are then spread across the pool by stratified sampling with
 * a bijective index scramble: every stratum is used exactly once, and the
 * cloud's particle order (fill first, outline last; x-sorted build order) does
 * not sweep across the bake as one contiguous range. Mane, face and crown all
 * contribute to every line, in proportion to their share of the bake.
 */

/** Share of the lion that feeds a line. Tuning starts at 4–7% (plan §4 C). */
export const LION_EXTRACTION_FRACTION = 0.06;

/** How far an extracted lion particle dims at the peak of a transfer, 0..1. */
export const LION_EXTRACTION_DIM = 0.85;

/**
 * Seeds are offsets added to the instance index before hashing, on both the
 * CPU and the GPU. The base keeps them clear of the index range and the stride
 * clears the largest tier (180k), so `index + seed` stays an exact float below
 * 2^24 for every line the story can hold.
 */
export const LION_EXTRACTION_SEED_BASE = 1 << 20;
export const LION_EXTRACTION_SEED_STRIDE = 1 << 18;

/** The brand wordmark is not a story line; it draws from its own pool. */
export const LION_BRAND_SOURCE_LINE = 40;

/** Bijective index scramble — a prime, so it is coprime with any text count. */
const STRATUM_SCRAMBLE = 2654435761;

/**
 * PCG hash, as TSL evaluates it: `hash(seed)` in three/src/nodes/math/Hash.js.
 * Integer arithmetic is done in uint32, so the value matches the shader bit
 * for bit up to the final float conversion, which the GPU performs at f32 and
 * this at f64 — a difference below 1e-7, invisible against a 0.06 threshold.
 */
export function pcgHash01(seed: number): number {
  const state = (Math.imul(seed >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul((state >>> ((state >>> 28) + 4)) ^ state, 277803737) >>> 0;
  const result = ((word >>> 22) ^ word) >>> 0;
  return result / 4294967296;
}

export function lionExtractionSeed(lineIndex: number): number {
  return LION_EXTRACTION_SEED_BASE + Math.max(0, lineIndex | 0) * LION_EXTRACTION_SEED_STRIDE;
}

/**
 * The lion indices that hash under the fraction for this line, ascending.
 * Bake order is spatial, so an ascending pool spans the whole sculpt.
 */
export function lionExtractionPool(
  lionCount: number,
  lineIndex: number,
  fraction: number = LION_EXTRACTION_FRACTION,
): Uint32Array {
  const seed = lionExtractionSeed(lineIndex);
  const pool: number[] = [];
  for (let index = 0; index < lionCount; index++) {
    if (pcgHash01(index + seed) < fraction) pool.push(index);
  }
  return Uint32Array.from(pool);
}

/**
 * One lion index per text particle, stratified across the line's pool.
 *
 * Particle `i` takes stratum `(i * prime + seed) mod textCount` — a
 * permutation of `0..textCount-1`, so the strata partition the pool evenly —
 * then a hashed offset inside it. An empty pool (a tiny bake, or a fraction
 * of zero) falls back to the whole lion, so the mapping is total.
 */
export function mapTextToLionSources(
  textCount: number,
  lionCount: number,
  lineIndex: number,
  fraction: number = LION_EXTRACTION_FRACTION,
): Uint32Array {
  const indices = new Uint32Array(Math.max(0, textCount));
  if (textCount <= 0 || lionCount <= 0) return indices;
  const pool = lionExtractionPool(lionCount, lineIndex, fraction);
  const poolSize = pool.length;
  const seed = lionExtractionSeed(lineIndex);
  for (let i = 0; i < textCount; i++) {
    const stratum = (i * STRATUM_SCRAMBLE + seed) % textCount;
    const jitter = pcgHash01(i + seed + 7919);
    const u = (stratum + jitter) / textCount;
    if (poolSize > 0) {
      indices[i] = pool[Math.min(poolSize - 1, Math.floor(u * poolSize))];
    } else {
      indices[i] = Math.min(lionCount - 1, Math.floor(u * lionCount));
    }
  }
  return indices;
}

/**
 * Gathers the mapped homes into a vec4 storage upload: xyz is the lion-model
 * position, w is the particle's lane across the throat (0..1, from its
 * stratum), so the shader can keep the throat narrow without a second hash.
 */
export function packLionSourcePositions(
  homes: Float32Array,
  indices: Uint32Array,
  lineIndex: number,
): Float32Array {
  const count = indices.length;
  const packed = new Float32Array(count * 4);
  const seed = lionExtractionSeed(lineIndex);
  for (let i = 0; i < count; i++) {
    const source = indices[i] * 4;
    const target = i * 4;
    packed[target] = homes[source];
    packed[target + 1] = homes[source + 1];
    packed[target + 2] = homes[source + 2];
    packed[target + 3] = pcgHash01(i + seed + 104729);
  }
  return packed;
}

export interface LionHomeExtent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Model-space bounds of the baked homes (vec4-aligned xyz). */
export function lionHomeExtent(homes: Float32Array): LionHomeExtent {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset + 1 < homes.length; offset += 4) {
    const x = homes[offset];
    const y = homes[offset + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  return { minX, maxX, minY, maxY };
}

function smoothstep01(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/**
 * How hard the lion dims during a transfer, 0..1. Rises as the first glyphs
 * leave, holds while the line is still drawing from the lion, and is fully
 * restored by the time the line has built — so a held line never reads as a
 * lion with a hole in it. `textFlow` gates the whole thing: zero before the
 * pre-roll and after the outro.
 */
export function lionExtractionEnvelope(transfer: number, textFlow: number): number {
  const t = Math.max(0, Math.min(1, transfer));
  const flow = Math.max(0, Math.min(1, textFlow));
  return smoothstep01(t / 0.25) * (1 - smoothstep01((t - 0.72) / 0.28)) * flow;
}
