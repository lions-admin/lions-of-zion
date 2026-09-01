import { describe, expect, it } from "vitest";
import {
  CANONICAL_CATEGORIES,
  CANONICAL_HANDLES,
  EXACT_CATEGORY_COUNT,
  EXACT_HANDLE_COUNT,
  getCanonicalCorpusGlyphs,
  validateParticleBank,
} from "@/lib/content/particle-bank";
import {
  generateRowStreams,
  charToAtlasIndex,
  atlasIndexToChar,
  getCanonicalMutationAtlasIndices,
  ARROW_GLYPH,
} from "@/components/typographic-field/stream-generator";

describe("LionsOfZion Canonical Particle Bank & Stream Generator", () => {
  it("contains exactly 28 canonical categories", () => {
    expect(CANONICAL_CATEGORIES).toHaveLength(EXACT_CATEGORY_COUNT);
    expect(CANONICAL_CATEGORIES.length).toBe(28);
  });

  it("contains exactly 157 canonical signal handles", () => {
    expect(CANONICAL_HANDLES).toHaveLength(EXACT_HANDLE_COUNT);
    expect(CANONICAL_HANDLES.length).toBe(157);
  });

  it("passes comprehensive particle bank validation without errors", () => {
    const report = validateParticleBank();
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.categoryCount).toBe(28);
    expect(report.handleCount).toBe(157);
  });

  it("preserves exact canonical category names and core phrases", () => {
    const categoryMap = new Map(CANONICAL_CATEGORIES.map((c) => [c.name, c.phrases]));

    expect(categoryMap.has("Core Identity")).toBe(true);
    expect(categoryMap.get("Core Identity")).toContain("TRUTH");
    expect(categoryMap.get("Core Identity")).toContain("SIGNAL");
    expect(categoryMap.get("Core Identity")).toContain("EVIDENCE");

    expect(categoryMap.has("Core Workflow")).toBe(true);
    expect(categoryMap.get("Core Workflow")).toEqual([
      "DETECT → INVESTIGATE → VERIFY → EXPLAIN → PROVE → SHARE",
    ]);

    expect(categoryMap.has("Brand Phrases")).toBe(true);
    expect(categoryMap.get("Brand Phrases")).toContain("TRUTH HAS A SIGNAL");
    expect(categoryMap.get("Brand Phrases")).toContain("EVIDENCE OVER EMOTION");

    expect(categoryMap.has("October 7")).toBe(true);
    expect(categoryMap.get("October 7")).toContain("TESTIMONY");
    expect(categoryMap.get("October 7")).toContain("SURVIVORS");
  });

  it("preserves key handles verbatim", () => {
    expect(CANONICAL_HANDLES).toContain("@khamenei_ir");
    expect(CANONICAL_HANDLES).toContain("@PressTV");
    expect(CANONICAL_HANDLES).toContain("@MaxBlumenthal");
    expect(CANONICAL_HANDLES).toContain("@DropSiteNews");
    expect(CANONICAL_HANDLES[0]).toBe("@khamenei_ir");
    expect(CANONICAL_HANDLES[CANONICAL_HANDLES.length - 1]).toBe("@DropSiteNews");
  });

  it("extracts all corpus glyphs and includes canonical characters", () => {
    const glyphs = getCanonicalCorpusGlyphs();
    expect(glyphs.length).toBeGreaterThan(40);
    expect(glyphs).toContain(" ");
    expect(glyphs).toContain("@");
    expect(glyphs).toContain("T");
    expect(glyphs).toContain("R");
    expect(glyphs).toContain("U");
    expect(glyphs).toContain("→");
  });

  it("maps characters and the arrow glyph to atlas indices accurately", () => {
    expect(charToAtlasIndex(" ")).toBe(0);
    expect(charToAtlasIndex("A")).toBe("A".charCodeAt(0) - 32);
    expect(charToAtlasIndex("@")).toBe("@".charCodeAt(0) - 32);
    expect(charToAtlasIndex(ARROW_GLYPH)).toBe(95);

    expect(atlasIndexToChar(0)).toBe(" ");
    expect(atlasIndexToChar("A".charCodeAt(0) - 32)).toBe("A");
    expect(atlasIndexToChar(95)).toBe(ARROW_GLYPH);
  });

  it("generates deterministic and reproducible row streams", () => {
    const runA = generateRowStreams(150, 200, 42);
    const runB = generateRowStreams(150, 200, 42);

    expect(runA).toHaveLength(150);
    expect(runB).toHaveLength(150);

    for (let r = 0; r < 150; r++) {
      expect(runA[r].text).toBe(runB[r].text);
      expect(runA[r].baseVelocity).toBe(runB[r].baseVelocity);
      expect(runA[r].semanticLevel).toBe(runB[r].semanticLevel);
      expect(runA[r].depth).toBe(runB[r].depth);
    }
  });

  it("moves all generated streams in a rightward flow (positive velocity)", () => {
    const streams = generateRowStreams(150, 180, 1337);
    for (const stream of streams) {
      expect(stream.baseVelocity).toBeGreaterThan(0);
    }
  });

  it("ensures mutation indices originate exclusively from the canonical corpus", () => {
    const mutationIndices = getCanonicalMutationAtlasIndices();
    expect(mutationIndices.length).toBeGreaterThan(0);
    const corpusGlyphs = new Set(getCanonicalCorpusGlyphs());

    for (let i = 0; i < mutationIndices.length; i++) {
      const char = atlasIndexToChar(mutationIndices[i]);
      expect(corpusGlyphs.has(char)).toBe(true);
    }
  });
});
