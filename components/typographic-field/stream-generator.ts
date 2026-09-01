/**
 * DETERMINISTIC STREAM GENERATOR & GLYPH ATLAS HELPERS
 *
 * Sourced exclusively from the canonical particle bank (28 categories, 157 handles).
 * Generates continuous wrapping character streams with deterministic seeding,
 * multi-tier category weighting, and canonical glyph mutation schedules.
 */

import {
  CANONICAL_CATEGORIES,
  CANONICAL_HANDLES,
  getCanonicalCorpusGlyphs,
} from "@/lib/content/particle-bank";

export type SemanticLevel = 0 | 1 | 2; // 0 = Inactive / Noise, 1 = Analysis, 2 = High Signal

export interface RowStream {
  readonly rowIndex: number;
  readonly text: string;
  readonly charCodes: Uint16Array;
  readonly length: number;
  readonly semanticLevel: SemanticLevel;
  readonly baseVelocity: number;
  readonly depth: number;
  readonly phase: number;
}

/**
 * Fast deterministic 32-bit PRNG (Mulberry32).
 */
export function createPRNG(seed: number) {
  let s = Math.floor(seed) >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Category categorization into semantic depth levels.
 */
const HIGH_SIGNAL_CATEGORIES = new Set([
  "core_identity",
  "brand_phrases",
  "mission",
  "core_workflow",
  "verification",
  "confidence",
]);

const ANALYSIS_CATEGORIES = new Set([
  "core_process",
  "fact_checking",
  "investigation",
  "intelligence",
  "evidence",
  "news",
  "israel",
  "october_7",
  "analysis",
  "signal",
  "publication",
  "platform_areas",
  "extended_platform",
]);

/**
 * Builds flattened phrase pools per semantic level.
 */
function buildCategoryBuckets(): Record<SemanticLevel, string[]> {
  const buckets: Record<SemanticLevel, string[]> = {
    0: [...CANONICAL_HANDLES], // Adversarial & monitoring handles in level 0
    1: [],
    2: [],
  };

  for (const cat of CANONICAL_CATEGORIES) {
    let level: SemanticLevel = 0;
    if (HIGH_SIGNAL_CATEGORIES.has(cat.id)) {
      level = 2;
    } else if (ANALYSIS_CATEGORIES.has(cat.id)) {
      level = 1;
    } else {
      level = 0;
    }

    for (const phrase of cat.phrases) {
      buckets[level].push(phrase);
    }
  }

  return buckets;
}

const BUCKETS = buildCategoryBuckets();
const CORPUS_GLYPHS = getCanonicalCorpusGlyphs();

/**
 * Mapping character to glyph index in the texture atlas.
 * Atlas supports standard printable ASCII (32-126) plus special glyphs like '→'.
 */
export const ARROW_GLYPH = "→";
export const ARROW_ATLAS_INDEX = 95; // Placed at slot 95 in atlas

export function charToAtlasIndex(char: string): number {
  if (char === ARROW_GLYPH) {
    return ARROW_ATLAS_INDEX;
  }
  const code = char.charCodeAt(0);
  if (code >= 32 && code <= 126) {
    return code - 32;
  }
  return 0; // fallback to space
}

export function atlasIndexToChar(index: number): string {
  if (index === ARROW_ATLAS_INDEX) {
    return ARROW_GLYPH;
  }
  if (index >= 0 && index <= 94) {
    return String.fromCharCode(32 + index);
  }
  return " ";
}

/**
 * Generates continuous row streams deterministically.
 */
export function generateRowStreams(
  rowCount: number,
  charsPerRow: number,
  seed = 1337
): RowStream[] {
  const streams: RowStream[] = [];
  const minLength = charsPerRow + 60; // generous wrap margin

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowSeed = (seed * 1999 + rowIndex * 7919) >>> 0;
    const rng = createPRNG(rowSeed);

    // Distribute levels: 25% High Signal (2), 45% Analysis (1), 30% Handle / Ground (0)
    const pattern = rowIndex % 12;
    const semanticLevel: SemanticLevel =
      pattern === 0 || pattern === 6 || pattern === 11
        ? 2
        : pattern === 2 || pattern === 4 || pattern === 8 || pattern === 10
        ? 1
        : 0;

    const pool = BUCKETS[semanticLevel];
    let poolIndex = Math.floor(rng() * pool.length);
    const stride = 1 + Math.floor(rng() * 7);

    const phrases: string[] = [];
    let currentLength = 0;

    while (currentLength < minLength) {
      const phrase = pool[poolIndex];
      phrases.push(phrase);
      currentLength += phrase.length + 1; // phrase + space separator
      poolIndex = (poolIndex + stride) % pool.length;
    }

    const rowText = phrases.join(" ") + " ";
    const charCodes = new Uint16Array(rowText.length);
    for (let i = 0; i < rowText.length; i++) {
      charCodes[i] = charToAtlasIndex(rowText[i]);
    }

    // Velocity & depth parameters
    const depth = [0.55, 0.85, 1.15][semanticLevel];
    const wave = Math.sin(rowIndex * 0.42 + rng() * 0.2) * 0.5 + 0.5;
    const baseSpeed = 42 + wave * 38; // px/s (positive = rightward motion)
    const phase = rng() * Math.PI * 2;

    streams.push({
      rowIndex,
      text: rowText,
      charCodes,
      length: rowText.length,
      semanticLevel,
      baseVelocity: baseSpeed,
      depth,
      phase,
    });
  }

  return streams;
}

/**
 * Returns canonical mutation candidate glyphs as atlas indices.
 */
export function getCanonicalMutationAtlasIndices(): Uint8Array {
  const indices: number[] = [];
  for (const g of CORPUS_GLYPHS) {
    indices.push(charToAtlasIndex(g));
  }
  return new Uint8Array(indices);
}
