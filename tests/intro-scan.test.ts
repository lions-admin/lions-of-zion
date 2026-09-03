import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  INTRO_SCAN_FIELD_TARGET,
  INTRO_SCAN_GLYPH_TARGET,
  INTRO_SCAN_WORD_TARGET,
  LION_MASK_X_PER_SCALE,
  LION_MASK_Y_PER_SCALE,
  SCAN_CORRIDOR_BRAND_PAD,
  SCAN_CORRIDOR_ROW_PAD,
  SCAN_CORRIDOR_SIDE_PAD,
  SCAN_VISIBLE_THRESHOLD,
  TEXT_CORRIDOR_MUTE,
  introScanMultiplier,
  solveLionScanMask,
  solveScanCorridor,
  type LionScanMask,
  type ScanCorridor,
} from "@/components/intro/scanIntro";
import { computeIntroLayout } from "@/components/intro/introLayout";
import {
  getRollingFinalTime,
  getRollingStoryFrame,
  ROLLING_CUE_TIMES_BY_LAYOUT,
} from "@/components/intro/rolling-story-timeline";
import {
  getScanRevealEnvelope,
  SCAN_REVEAL_END,
  SCAN_REVEAL_START,
} from "@/components/intro/story-timeline";

/**
 * Plan §4 Phase D — the GPU scan wakes during the intro.
 *
 * The scan used to be hidden for the whole intro and cut in with the
 * navigation outro. Now `Scene.tsx` shows the network group on
 * `scanReveal`, `NetworkScan` multiplies (never replaces) the navigation
 * opacities by an intro multiplier, and the material's hero hole and text
 * corridor are uniforms that follow the lion and the rows per frame.
 *
 * The arithmetic is pinned directly. The wiring is pinned by reading source,
 * in the style of `tests/motion-runtime.test.ts`: the subjects are a React
 * Three Fiber frame loop and a TSL node graph, neither of which exists under
 * vitest's node environment, so the alternative to a source assertion is no
 * assertion.
 */

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

const SCENE = "components/particle-nav/Scene.tsx";
const LAYER = "components/particle-nav/layers/NetworkScan.tsx";
const MATERIAL = "components/particle-nav/tsl/networkScanMaterial.ts";

describe("introScanMultiplier", () => {
  const targets = [
    INTRO_SCAN_FIELD_TARGET,
    INTRO_SCAN_WORD_TARGET,
    INTRO_SCAN_GLYPH_TARGET,
  ];

  it("keeps every intro target below the navigation strength and above a floor", () => {
    for (const target of targets) {
      expect(target).toBeLessThan(1);
      expect(target).toBeGreaterThanOrEqual(0.2);
    }
    /* The plan's starting point (§4 Phase D), to be validated from captures.
       If these move, move them on purpose: the plan line should move too. */
    expect(INTRO_SCAN_FIELD_TARGET).toBe(0.45);
    expect(INTRO_SCAN_WORD_TARGET).toBe(0.3);
    expect(INTRO_SCAN_GLYPH_TARGET).toBe(0.24);
  });

  it("is 0 with nothing revealed, the target at full intro reveal, 1 at the outro's end", () => {
    for (const target of targets) {
      expect(introScanMultiplier(0, 0, target)).toBe(0);
      expect(introScanMultiplier(1, 0, target)).toBeCloseTo(target, 12);
      expect(introScanMultiplier(0, 1, target)).toBe(1);
      expect(introScanMultiplier(1, 1, target)).toBe(1);
      expect(introScanMultiplier(0.37, 1, target)).toBe(1);
    }
  });

  it("is monotone in both inputs and clamps them", () => {
    const steps = Array.from({ length: 21 }, (_, i) => i / 20);
    for (const target of targets) {
      for (const nav of steps) {
        let previous = -1;
        for (const reveal of steps) {
          const value = introScanMultiplier(reveal, nav, target);
          expect(value).toBeGreaterThanOrEqual(previous);
          previous = value;
        }
      }
      for (const reveal of steps) {
        let previous = -1;
        for (const nav of steps) {
          const value = introScanMultiplier(reveal, nav, target);
          expect(value).toBeGreaterThanOrEqual(previous);
          previous = value;
        }
      }
      expect(introScanMultiplier(-1, -1, target)).toBe(0);
      expect(introScanMultiplier(2, 0, target)).toBeCloseTo(target, 12);
      expect(introScanMultiplier(0, 2, target)).toBe(1);
    }
  });

  it("is dark through the opening and formation on the real envelope", () => {
    for (let t = 0; t <= SCAN_REVEAL_START; t += 0.05) {
      expect(introScanMultiplier(getScanRevealEnvelope(t), 0, INTRO_SCAN_FIELD_TARGET), `t=${t}`).toBe(0);
    }
    expect(
      introScanMultiplier(getScanRevealEnvelope(SCAN_REVEAL_END), 0, INTRO_SCAN_FIELD_TARGET),
    ).toBeCloseTo(INTRO_SCAN_FIELD_TARGET, 12);
  });

  it("clears the group's visibility threshold only once the reveal has begun", () => {
    expect(SCAN_VISIBLE_THRESHOLD).toBeGreaterThan(0);
    expect(SCAN_VISIBLE_THRESHOLD).toBeLessThan(0.1);
    expect(Math.max(getScanRevealEnvelope(SCAN_REVEAL_START), 0)).toBeLessThanOrEqual(SCAN_VISIBLE_THRESHOLD);
    expect(Math.max(getScanRevealEnvelope(SCAN_REVEAL_END), 0)).toBeGreaterThan(SCAN_VISIBLE_THRESHOLD);
  });
});

describe("solveLionScanMask", () => {
  it("follows the lion's scale and Y and allocates nothing", () => {
    const out: LionScanMask = { centerY: 0, halfX: 0, halfY: 0 };
    const result = solveLionScanMask(0.6, 1.4, out);
    expect(result).toBe(out);
    expect(out.centerY).toBe(1.4);
    expect(out.halfX).toBeCloseTo(LION_MASK_X_PER_SCALE * 0.6, 12);
    expect(out.halfY).toBeCloseTo(LION_MASK_Y_PER_SCALE * 0.6, 12);
  });

  it("reproduces the previous static centred hole in the navigation state", () => {
    const out: LionScanMask = { centerY: 0, halfX: 0, halfY: 0 };
    solveLionScanMask(1, 0, out);
    expect(out).toEqual({ centerY: 0, halfX: 1.62, halfY: 1.42 });
    solveLionScanMask(-1, 0, out);
    expect(out.halfX).toBe(0);
  });
});

describe("solveScanCorridor", () => {
  const layouts = [
    computeIntroLayout(1440, 900),
    computeIntroLayout(390, 844),
  ];

  it("spans row 0 before any line has built, centred on the column", () => {
    const out: ScanCorridor = { centerY: 0, halfHeight: 0, halfWidth: 0 };
    for (const layout of layouts) {
      const result = solveScanCorridor(layout, null, out);
      expect(result).toBe(out);
      expect(out.centerY).toBeCloseTo(layout.rowTop, 12);
      expect(out.halfHeight).toBeCloseTo(layout.rowGap * SCAN_CORRIDOR_ROW_PAD, 12);
      expect(out.halfWidth).toBeCloseTo(layout.lineMaxWidth / 2 + SCAN_CORRIDOR_SIDE_PAD, 12);
    }
  });

  it("covers every visible row of the story at every cue, with the brand once it builds", () => {
    const out: ScanCorridor = { centerY: 0, halfHeight: 0, halfWidth: 0 };
    for (const layoutName of ["desktop", "mobile"] as const) {
      const layout = computeIntroLayout(layoutName === "desktop" ? 1440 : 390, 900);
      const cues = ROLLING_CUE_TIMES_BY_LAYOUT[layoutName];
      const times = [...cues, getRollingFinalTime(layoutName)];
      for (let i = 0; i + 1 < times.length; i += 1) {
        for (const t of [times[i], (times[i] + times[i + 1]) / 2]) {
          const story = getRollingStoryFrame(t, layoutName);
          solveScanCorridor(layout, story, out);
          const top = out.centerY + out.halfHeight;
          const bottom = out.centerY - out.halfHeight;
          for (const line of story.activeLines) {
            if (line.visibility <= 0.001) continue;
            const y = layout.rowTop - line.row * layout.rowGap;
            expect(y, `${layoutName} t=${t} line ${line.index}`).toBeLessThanOrEqual(top);
            expect(y, `${layoutName} t=${t} line ${line.index}`).toBeGreaterThanOrEqual(bottom);
          }
          if (story.brandProgress > 0.001) {
            expect(bottom, `${layoutName} t=${t} brand`).toBeLessThanOrEqual(
              layout.brandY - SCAN_CORRIDOR_BRAND_PAD,
            );
          }
          expect(out.halfHeight).toBeGreaterThan(0);
          expect(out.halfWidth).toBeGreaterThan(0);
        }
      }
    }
  });

  it("mutes rather than cuts inside the corridor", () => {
    expect(TEXT_CORRIDOR_MUTE).toBeGreaterThan(0.5);
    expect(TEXT_CORRIDOR_MUTE).toBeLessThan(1);
  });
});

describe("Scene.tsx shows the network group on the scan reveal", () => {
  const source = read(SCENE);

  it("no longer gates the group on navReveal alone", () => {
    expect(source).not.toMatch(/networkRef\.current\.visible\s*=\s*navReveal\s*>/);
    expect(source).not.toMatch(/<group ref=\{networkRef\} visible=/);
    const gate = source.match(/networkRef\.current\.visible\s*=\s*([^;]+);/);
    expect(gate, "network group visibility assignment").not.toBeNull();
    expect(gate?.[1]).toMatch(/scanReveal/);
    expect(gate?.[1]).toMatch(/navReveal/);
    expect(gate?.[1]).toMatch(/SCAN_VISIBLE_THRESHOLD/);
  });

  it("keeps the outro scale easing on navReveal and hands the frame ref to the layer", () => {
    expect(source).toMatch(/networkRef\.current\.scale\.setScalar\(0\.965 \+ navReveal \* 0\.035\)/);
    expect(source).toMatch(/<NetworkScan[\s\S]*?experienceFrameRef=\{experienceFrameRef\}[\s\S]*?\/>/);
  });
});

describe("NetworkScan.tsx multiplies the navigation opacities", () => {
  const source = read(LAYER);

  it("still reads all three params opacities and multiplies each by the intro multiplier", () => {
    for (const [param, target] of [
      ["scanFieldOpacity", "INTRO_SCAN_FIELD_TARGET"],
      ["scanWordOpacity", "INTRO_SCAN_WORD_TARGET"],
      ["scanGlyphOpacity", "INTRO_SCAN_GLYPH_TARGET"],
    ] as const) {
      const multiplied = new RegExp(
        `params\\.${param}\\s*\\*\\s*introScanMultiplier\\(scanReveal,\\s*navReveal,\\s*${target}\\)`,
      );
      expect(source, param).toMatch(multiplied);
      /* Never written straight into a uniform: that was the navigation-only
         behaviour, and would also drop the intro multiplier on a rebuild. */
      expect(source).not.toMatch(new RegExp(`\\.value\\s*=\\s*params\\.${param}\\s*;`));
    }
  });

  it("brings a rebuilt layer level with the frame at commit, before its first draw", () => {
    const commit = source.match(/useLayoutEffect\(\(\) => \{([\s\S]*?)\}, \[built[^\]]*\]\);/);
    expect(commit, "useLayoutEffect keyed on built").not.toBeNull();
    expect(commit?.[1]).toMatch(/syncScanUniforms\(/);
    expect(source).toMatch(/useFrame\(\(\) => \{\s*syncScanUniforms\(/);
  });

  it("treats a missing frame as a dark scan", () => {
    expect(source).toMatch(/frame\?\.scanReveal \?\? 0/);
    expect(source).toMatch(/frame\?\.navReveal \?\? 0/);
  });
});

describe("networkScanMaterial.ts exposes the lion hole and the text corridor as uniforms", () => {
  const source = read(MATERIAL);

  it("declares the hero-hole and corridor uniforms", () => {
    for (const name of [
      "heroCenterY",
      "heroMaskX",
      "heroMaskY",
      "corridorY",
      "corridorHalfHeight",
      "corridorHalfWidth",
      "corridorStrength",
    ]) {
      expect(source, name).toMatch(new RegExp(`^\\s+${name}: uniform\\(`, "m"));
    }
  });

  it("evaluates the hero hole against the uniforms, not the build-time options", () => {
    expect(source).toMatch(/x\.div\(uniforms\.heroMaskX\)/);
    expect(source).toMatch(/p\.y\.sub\(uniforms\.heroCenterY\)\.div\(uniforms\.heroMaskY\)/);
    expect(source).not.toMatch(/x\.div\(options\.maskX\)/);
  });

  it("keeps the static node holes and applies the corridor as a dim in the opacity chain", () => {
    expect(source).toMatch(/for \(const hole of options\.nodeHoles \?\? \[\]\)/);
    expect(source).toMatch(/TEXT_CORRIDOR_MUTE/);
    expect(source).toMatch(/\.mul\(underMenu\)\s*\.mul\(corridorMute\)/);
  });
});
