import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  INTRO_SCAN_FIELD_TARGET,
  INTRO_SCAN_GLYPH_TARGET,
  INTRO_SCAN_WORD_TARGET,
  LION_MASK_EDGE_INNER,
  LION_MASK_EDGE_OUTER,
  LION_MASK_X_PER_SCALE,
  LION_MASK_Y_PER_SCALE,
  RETIRED_FIELD_HOLE_X,
  RETIRED_FIELD_HOLE_Y,
  SCAN_CORRIDOR_BRAND_PAD,
  SCAN_CORRIDOR_ROW_PAD,
  SCAN_CORRIDOR_SIDE_PAD,
  SCAN_VISIBLE_THRESHOLD,
  TEXT_CORRIDOR_MUTE,
  introScanMultiplier,
  lionScanMaskOpacity,
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

/**
 * The build-time hole `buildScanField` used to punch is gone (2026-09-04): it
 * was sized once from `orbit.centerScale`, frozen on world centre, and so sat
 * under the text column as an empty oval for the whole intro. What has to hold
 * is that the *runtime* mask still covers it in the settled navigation state,
 * where the lion is back at `lionY = 0` and `lionScale = orbit.centerScale`.
 *
 * `lionScanMaskOpacity` mirrors the material's `smoothstep` on the CPU and
 * shares its two edge constants with it, so this is a proof about the shader
 * and not about a second implementation of it.
 */
describe("the runtime hero mask covers the retired build-time hole", () => {
  /* Every `orbit.centerScale` the layout can produce: 1 at >= 480 px, and
     0.78 + narrowT * 0.22 below it, so 0.78 at 320 px. */
  const centerScales = [1, 0.95, 0.876, 0.82, 0.78];

  it("is fully dark at least 3% beyond the retired ellipse, on both axes", () => {
    expect(LION_MASK_EDGE_INNER * LION_MASK_X_PER_SCALE).toBeGreaterThan(
      RETIRED_FIELD_HOLE_X * 1.03,
    );
    expect(LION_MASK_EDGE_INNER * LION_MASK_Y_PER_SCALE).toBeGreaterThan(
      RETIRED_FIELD_HOLE_Y * 1.03,
    );
    /* Measured margins, so a change to any of the four numbers has to be
       deliberate: 1.3932 vs 1.34 in x (+3.97%), 1.2212 vs 1.18 in y (+3.49%). */
    expect(LION_MASK_EDGE_INNER * LION_MASK_X_PER_SCALE).toBeCloseTo(1.3932, 10);
    expect(LION_MASK_EDGE_INNER * LION_MASK_Y_PER_SCALE).toBeCloseTo(1.2212, 10);
  });

  it("kills the scan everywhere the retired hole did, at every centre scale", () => {
    const mask: LionScanMask = { centerY: 0, halfX: 0, halfY: 0 };
    for (const scale of centerScales) {
      solveLionScanMask(scale, 0, mask);
      /* The retired hole's whole boundary, plus its interior on a coarse
         grid — a build-time test dropped a point when it was *inside* the
         ellipse, so the boundary is the tight case. */
      for (let i = 0; i < 64; i += 1) {
        const a = (i / 64) * Math.PI * 2;
        for (const r of [0.25, 0.6, 0.9, 1]) {
          const x = Math.cos(a) * RETIRED_FIELD_HOLE_X * scale * r;
          const y = Math.sin(a) * RETIRED_FIELD_HOLE_Y * scale * r;
          expect(lionScanMaskOpacity(x, y, mask), `scale=${scale} a=${a} r=${r}`).toBe(0);
        }
      }
      expect(lionScanMaskOpacity(0, 0, mask)).toBe(0);
    }
  });

  it("fades out rather than cutting, and is clear of the lion by the outer edge", () => {
    const mask: LionScanMask = { centerY: 0, halfX: 0, halfY: 0 };
    solveLionScanMask(1, 0, mask);
    expect(LION_MASK_EDGE_OUTER).toBeGreaterThan(LION_MASK_EDGE_INNER);
    // Monotone from dark to clear along +x, and 1 at the outer edge.
    let previous = -1;
    for (let i = 0; i <= 40; i += 1) {
      const x = (i / 40) * LION_MASK_EDGE_OUTER * LION_MASK_X_PER_SCALE * 1.2;
      const value = lionScanMaskOpacity(x, 0, mask);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(lionScanMaskOpacity(LION_MASK_EDGE_OUTER * LION_MASK_X_PER_SCALE, 0, mask)).toBe(1);
    expect(lionScanMaskOpacity(LION_MASK_EDGE_OUTER * LION_MASK_Y_PER_SCALE * 1.01, 0, mask)).toBeGreaterThan(0);
  });

  it("moves the emptiness with the lion instead of leaving it at world centre", () => {
    /* The defect, stated as arithmetic: mid-intro the lion has risen and
       shrunk, and world centre — where the story column sits — must carry
       scan again. A build-time hole could not do this. */
    const mask: LionScanMask = { centerY: 0, halfX: 0, halfY: 0 };
    solveLionScanMask(0.42, 2.1, mask);
    expect(lionScanMaskOpacity(0, 0, mask)).toBe(1);
    expect(lionScanMaskOpacity(0, 2.1, mask)).toBe(0);
    // And it is dark under the lion at its own new height, not at the old one.
    expect(lionScanMaskOpacity(0.5, 2.1, mask)).toBe(0);
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

  it("writes all three hero-hole uniforms on every layer, every frame", () => {
    const sync = source.match(/function syncScanUniforms\([\s\S]*?\n\}\n/);
    expect(sync, "syncScanUniforms").not.toBeNull();
    const body = sync?.[0] ?? "";
    expect(body).toMatch(/const mask = solveLionScanMask\(\s*frame\?\.lionScale \?\? 0,\s*frame\?\.lionY \?\? 0,/);
    /* Inside the loop over `layers.handles`, so a layer added later cannot
       silently keep its constructor hole. */
    const perLayer = body.match(/for \(const handle of layers\.handles\) \{([\s\S]*?)\n {2}\}/);
    expect(perLayer, "per-layer uniform loop").not.toBeNull();
    for (const name of ["heroCenterY", "heroMaskX", "heroMaskY"]) {
      expect(perLayer?.[1], name).toMatch(new RegExp(`setUniform\\(handle, '${name}',`));
    }
  });
});

/**
 * The Phase D defect, fixed 2026-09-04. `createExclusionTest` punched a
 * centred ellipse into the field geometry at build time, sized from
 * `orbit.centerScale` and frozen at world centre — so for the whole intro,
 * while the lion was up and small, an empty oval sat under the story column
 * and no uniform could move it. The generator is uniform now; the eight fixed
 * spoke exclusions stay, because those really do not move.
 */
describe("NetworkScan.tsx no longer punches a centred hole into the field", () => {
  const source = read(LAYER);

  it("keeps only the node and spoke exclusions at build time", () => {
    const helper = source.match(
      /function createNodeExclusionTest\([\s\S]*?\n\}\n/,
    );
    expect(helper, "createNodeExclusionTest").not.toBeNull();
    const body = helper?.[0] ?? "";
    // The eight rings and the eight spokes, and nothing else.
    expect(body).toMatch(/nodePosition\(i, count, orbit\)/);
    expect(body).toMatch(/Math\.hypot\(x - node\.x, y - node\.y\) < nodeGap/);
    expect(body).toMatch(/distanceToSegment\(x, y, 0, 0, node\.x, node\.y\)/);
    /* `orbit.centerScale` is the only lion-sized quantity available at build
       time, so a centred hole of any radius would have to reach for it. */
    expect(body).not.toMatch(/centerScale/);
    expect(body).not.toMatch(/centreX|centreY/);
  });

  it("has no other build-time centre exclusion anywhere in the layer", () => {
    expect(source).not.toMatch(/createExclusionTest/);
    expect(source).not.toMatch(/\(x \/ centreX\)/);
    expect(source).toMatch(/const excluded = createNodeExclusionTest\(orbit, 8, depthScale\);/);
  });

  it("holds the field to the tier budget and does not let one end spend it all", () => {
    /* Removing the hole moves points into the centre, which the global cap
       inside `push` used to pay for out of the last rows generated — the top
       band measured 10.6% thinner at 1440x900 / 18k over an eight-seed
       ensemble. An even share of the *remaining* budget holds that to 1.9%
       at an unchanged total, without raising `pointBudget`. */
    expect(source).toMatch(
      /const perRowBudget = Math\.ceil\(\(pointBudget - rowStart \/ 4\) \/ \(rows - row\)\);/,
    );
    expect(source).not.toMatch(/Math\.floor\(pointBudget \/ rows\)/);
    // The hard cap is still the tier budget and nothing else.
    expect(source).toMatch(/if \(out\.length >= pointBudget \* 4 \|\| excluded\(x, y\)\) return;/);
    expect(read(SCENE)).toMatch(/pointBudget=\{tier\.networkPoints\}/);
  });

  it("reads the frame after Scene writes it, not a frame late", () => {
    const priority = source.match(/const SCAN_FRAME_PRIORITY = ([\d.]+);/);
    expect(priority, "SCAN_FRAME_PRIORITY").not.toBeNull();
    const value = Number(priority?.[1]);
    /* Above 0 so r3f sorts it after `Scene`'s default-priority writer, below
       the post chain's 1 so it still runs before the draw. */
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
    expect(source).toMatch(/\}, SCAN_FRAME_PRIORITY\);/);
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

  it("fades the hero hole through the shared edge band, not its own literals", () => {
    /* One definition, so `lionScanMaskOpacity` really is a proof about this
       node graph rather than a second guess at it. */
    expect(source).toMatch(/LION_MASK_EDGE_INNER,\s*LION_MASK_EDGE_OUTER,/);
    expect(source).not.toMatch(/smoothstep\(\s*0\.86,\s*1\.24,/);
  });

  it("keeps the static node holes and applies the corridor as a dim in the opacity chain", () => {
    expect(source).toMatch(/for \(const hole of options\.nodeHoles \?\? \[\]\)/);
    expect(source).toMatch(/TEXT_CORRIDOR_MUTE/);
    expect(source).toMatch(/\.mul\(underMenu\)\s*\.mul\(corridorMute\)/);
  });
});
