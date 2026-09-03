import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LION_BRAND_SOURCE_LINE,
  LION_EXTRACTION_FRACTION,
  LION_EXTRACTION_SEED_BASE,
  LION_EXTRACTION_SEED_STRIDE,
  lionExtractionEnvelope,
  lionExtractionPool,
  lionExtractionSeed,
  lionHomeExtent,
  mapTextToLionSources,
  packLionSourcePositions,
  pcgHash01,
} from "@/components/intro/lionSourceMap";

/**
 * Phase C of `fixhomeTODO.md`: text particles are born on deterministic
 * samples of the baked lion. The mapping is pure and CPU-side, so its three
 * contracts are pinned here — determinism, spread across the bake rather than
 * one contiguous range, and bounds — together with the lineage the lion
 * shader relies on: a mapped particle always hashes into the pool the lion
 * dims for that line.
 *
 * The shader side (TSL) does not exist under vitest; the source-level checks
 * at the end pin what a typecheck cannot — that the storage node carrying the
 * sources is disposed on the same path as the ones before it, and that the
 * layers actually wire the mapping in.
 */

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

/** A stand-in bake: the 45k tier's count and crown split, positions on a grid. */
const LION_COUNT = 45_000;
const CROWN_START = 38_700;

function fakeHomes(count = LION_COUNT): Float32Array {
  const homes = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    homes[i * 4] = ((i % 300) / 300 - 0.5) * 1.4;
    homes[i * 4 + 1] = (Math.floor(i / 300) / 150 - 0.5) * 1.66;
    homes[i * 4 + 2] = (i % 7) * 0.01 - 0.03;
  }
  return homes;
}

describe("pcgHash01 — the hash both sides evaluate", () => {
  it("stays inside [0, 1) and is deterministic", () => {
    for (let seed = 0; seed < 5_000; seed++) {
      const value = pcgHash01(seed);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(pcgHash01(seed)).toBe(value);
    }
  });

  it("is uniform enough for a threshold to mean a fraction", () => {
    let under = 0;
    const total = 200_000;
    for (let seed = 0; seed < total; seed++) {
      if (pcgHash01(seed + LION_EXTRACTION_SEED_BASE) < LION_EXTRACTION_FRACTION) under++;
    }
    expect(under / total).toBeGreaterThan(LION_EXTRACTION_FRACTION * 0.9);
    expect(under / total).toBeLessThan(LION_EXTRACTION_FRACTION * 1.1);
  });

  it("keeps every seed the story can produce an exact float for the GPU", () => {
    /* `index + seed` is converted uint → float on the GPU; above 2^24 that
       conversion rounds and the CPU pool would diverge from the dimmed one. */
    const largestTier = 180_000;
    const largestLine = Math.max(LION_BRAND_SOURCE_LINE, 30);
    expect(lionExtractionSeed(largestLine) + largestTier).toBeLessThan(2 ** 24);
    expect(LION_EXTRACTION_SEED_STRIDE).toBeGreaterThanOrEqual(largestTier);
  });
});

describe("mapTextToLionSources — determinism", () => {
  it("returns an identical mapping for identical inputs", () => {
    const a = mapTextToLionSources(7_500, LION_COUNT, 3);
    const b = mapTextToLionSources(7_500, LION_COUNT, 3);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("changes with the line index, so rows do not all draw from one subset", () => {
    const a = mapTextToLionSources(2_000, LION_COUNT, 0);
    const b = mapTextToLionSources(2_000, LION_COUNT, 1);
    let same = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
    expect(same / a.length).toBeLessThan(0.01);
  });

  it("packs the same positions on every call", () => {
    const homes = fakeHomes();
    const indices = mapTextToLionSources(1_000, LION_COUNT, 5);
    const a = packLionSourcePositions(homes, indices, 5);
    const b = packLionSourcePositions(homes, indices, 5);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe("mapTextToLionSources — bounds", () => {
  it("never indexes outside the bake", () => {
    for (const [text, lion] of [
      [7_500, LION_COUNT],
      [5_400, 45_000],
      [7_000, 180_000],
      [850, 17],
      [3, 1],
    ] as const) {
      const indices = mapTextToLionSources(text, lion, 2);
      expect(indices.length).toBe(text);
      for (const index of indices) {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(lion);
      }
    }
  });

  it("is total: an empty pool falls back to the whole lion", () => {
    const indices = mapTextToLionSources(50, 40, 0, 0);
    expect(indices.length).toBe(50);
    for (const index of indices) expect(index).toBeLessThan(40);
    expect(new Set(Array.from(indices)).size).toBeGreaterThan(10);
  });

  it("handles empty inputs without throwing", () => {
    expect(mapTextToLionSources(0, LION_COUNT, 0).length).toBe(0);
    expect(mapTextToLionSources(10, 0, 0).length).toBe(10);
  });
});

describe("mapTextToLionSources — distribution across the bake", () => {
  const indices = mapTextToLionSources(7_500, LION_COUNT, 4);

  it("spans the index range instead of one contiguous block", () => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const index of indices) {
      if (index < min) min = index;
      if (index > max) max = index;
    }
    expect(max - min).toBeGreaterThan(LION_COUNT * 0.95);
  });

  it("fills every tenth of the bake in proportion — mane, face and crown all feed a line", () => {
    const buckets = new Array<number>(10).fill(0);
    for (const index of indices) buckets[Math.floor((index / LION_COUNT) * 10)]++;
    const expected = indices.length / 10;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expected * 0.7);
      expect(count).toBeLessThan(expected * 1.3);
    }
  });

  it("reaches the crown subset at its share of the bake", () => {
    let crown = 0;
    for (const index of indices) if (index >= CROWN_START) crown++;
    const share = (LION_COUNT - CROWN_START) / LION_COUNT;
    expect(crown / indices.length).toBeGreaterThan(share * 0.6);
    expect(crown / indices.length).toBeLessThan(share * 1.4);
  });

  it("does not sweep the bake in particle order", () => {
    /* Consecutive text particles landing on consecutive lion indices would
       read as one region of the lion peeling off as the line builds. */
    let monotoneRuns = 0;
    for (let i = 1; i < indices.length; i++) {
      if (Math.abs(indices[i] - indices[i - 1]) < 8) monotoneRuns++;
    }
    expect(monotoneRuns / indices.length).toBeLessThan(0.02);
  });
});

describe("the pool the lion dims is the pool the text is made of", () => {
  it("maps every text particle into the line's hashed pool", () => {
    for (const line of [0, 7, 19, LION_BRAND_SOURCE_LINE]) {
      const seed = lionExtractionSeed(line);
      const indices = mapTextToLionSources(5_000, LION_COUNT, line);
      for (const index of indices) {
        expect(pcgHash01(index + seed)).toBeLessThan(LION_EXTRACTION_FRACTION);
      }
    }
  });

  it("pools are the configured fraction of the lion and sorted ascending", () => {
    const pool = lionExtractionPool(LION_COUNT, 2);
    expect(pool.length / LION_COUNT).toBeGreaterThan(LION_EXTRACTION_FRACTION * 0.85);
    expect(pool.length / LION_COUNT).toBeLessThan(LION_EXTRACTION_FRACTION * 1.15);
    for (let i = 1; i < pool.length; i++) expect(pool[i]).toBeGreaterThan(pool[i - 1]);
  });

  it("keeps the extraction fraction inside the plan's tuning cap", () => {
    expect(LION_EXTRACTION_FRACTION).toBeGreaterThanOrEqual(0.04);
    expect(LION_EXTRACTION_FRACTION).toBeLessThanOrEqual(0.07);
  });
});

describe("packLionSourcePositions", () => {
  it("copies xyz from the mapped homes and writes a lane in w", () => {
    const homes = fakeHomes(64);
    const indices = Uint32Array.from([0, 5, 63, 17]);
    const packed = packLionSourcePositions(homes, indices, 1);
    expect(packed.length).toBe(16);
    indices.forEach((source, i) => {
      expect(packed[i * 4]).toBe(homes[source * 4]);
      expect(packed[i * 4 + 1]).toBe(homes[source * 4 + 1]);
      expect(packed[i * 4 + 2]).toBe(homes[source * 4 + 2]);
      expect(packed[i * 4 + 3]).toBeGreaterThanOrEqual(0);
      expect(packed[i * 4 + 3]).toBeLessThan(1);
    });
  });
});

describe("lionHomeExtent", () => {
  it("reads the model-space bounds off a vec4-aligned upload", () => {
    const homes = new Float32Array([0.2, -0.8, 0, 9, -0.7, 0.81, 0, 9, 0.7, 0.1, 0, 9]);
    const extent = lionHomeExtent(homes);
    /* Float32 storage: compare at its precision, not the literal's. */
    expect(extent.minX).toBeCloseTo(-0.7, 6);
    expect(extent.maxX).toBeCloseTo(0.7, 6);
    expect(extent.minY).toBeCloseTo(-0.8, 6);
    expect(extent.maxY).toBeCloseTo(0.81, 6);
  });

  it("returns zeros for an empty upload", () => {
    expect(lionHomeExtent(new Float32Array(0))).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  });
});

describe("lionExtractionEnvelope — dim during the transfer, restore after", () => {
  it("is zero before a line starts and once it has built", () => {
    expect(lionExtractionEnvelope(0, 1)).toBe(0);
    expect(lionExtractionEnvelope(1, 1)).toBe(0);
  });

  it("peaks in the middle of the transfer", () => {
    const mid = lionExtractionEnvelope(0.5, 1);
    expect(mid).toBeCloseTo(1, 5);
    expect(lionExtractionEnvelope(0.1, 1)).toBeLessThan(mid);
    expect(lionExtractionEnvelope(0.9, 1)).toBeLessThan(mid);
  });

  it("is gated by textFlow", () => {
    expect(lionExtractionEnvelope(0.5, 0)).toBe(0);
    expect(lionExtractionEnvelope(0.5, 0.5)).toBeCloseTo(0.5, 5);
  });

  it("never exceeds 1", () => {
    for (let t = 0; t <= 1; t += 0.01) {
      expect(lionExtractionEnvelope(t, 1)).toBeLessThanOrEqual(1);
      expect(lionExtractionEnvelope(t, 1)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the layers wire the mapping in and dispose what it allocates", () => {
  it("IntroText builds sources from the lion homes and tears them down with the set", () => {
    const source = read("components/particle-nav/layers/IntroText.tsx");
    expect(source).toMatch(/mapTextToLionSources\(/);
    expect(source).toMatch(/lionSources:\s*packLionSourcePositions\(/);
    /* The set is disposed on both exits of the effect: a cancelled load and
       the cleanup itself. */
    expect(source).toMatch(/if \(cancelled\) disposeSet\(created\)/);
    expect(source).toMatch(/return \(\) => \{\s*cancelled = true;\s*if \(created\) disposeSet\(created\);/);
    /* Mapping happens in the effect keyed on layout and bake, never per frame. */
    expect(source).toMatch(/\}, \[layoutKey, lionHomes\]\)/);
    const frameLoop = source.slice(source.indexOf("useFrame(("));
    expect(frameLoop).not.toMatch(/mapTextToLionSources|packLionSourcePositions|buildTextCloud/);
  });

  it("the text material disposes the source storage on the same path as the others", () => {
    const source = read("components/particle-nav/tsl/introTextMaterial.ts");
    expect(source).toMatch(/instancedArray\(options\.lionSources, 'vec4'\)/);
    expect(source).toMatch(/sources \? \[positions, traits, sources\] : \[positions, traits\]/);
  });

  it("Scene hands the lion homes to IntroText and the lion shader dims the hashed pool", () => {
    expect(read("components/particle-nav/Scene.tsx")).toMatch(
      /lionHomes=\{sim\?\.homeData \?\? null\}/,
    );
    const lion = read("components/particle-nav/tsl/pointMaterial.ts");
    expect(lion).toMatch(/hash\(instanceIndex\.add\(uniforms\.extractionSeed\)\)/);
    expect(lion).toMatch(/LION_EXTRACTION_FRACTION/);
    const core = read("components/particle-nav/layers/LionCore.tsx");
    expect(core).toMatch(/lionExtractionEnvelope\(/);
    expect(core).toMatch(/lionExtractionSeed\(/);
  });

  it("the sim keeps the decoded homes on the CPU", () => {
    expect(read("components/particle-nav/tsl/lionCompute.ts")).toMatch(
      /homeData: decoded\.positions/,
    );
  });
});
