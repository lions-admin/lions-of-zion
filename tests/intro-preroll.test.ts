import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  STORY_START,
  STREAM_PREROLL_DURATION,
  STREAM_PREROLL_START,
  getTextFlowEnvelope,
  type StoryLayout,
} from "@/components/intro/story-timeline";
import {
  ROLLING_ENTER_DURATION,
  getRollingStoryLineFrame,
} from "@/components/intro/rolling-story-timeline";
import {
  STREAM_LEAD_SHARE,
  STREAM_PREROLL_LINE,
  STREAM_STAGGER_SPAN,
  STREAM_THROAT_T,
  STREAM_TRAVEL_WINDOW,
  streamBuilt,
  streamLead,
  streamLeadShare,
  streamPathParameter,
} from "@/components/intro/streamPath";

/**
 * The stream pre-roll (plan §3, 4.20–4.35 s): "a narrow particle throat begins
 * below the lion so the first text line does not appear from nowhere."
 *
 * Phase A gave that window an envelope and Phase C built the lion → throat →
 * glyph path, but the path's only parameter was the line's `build`, which is
 * flat zero until `STORY_START` — so the 0.15 s pre-roll rendered nothing and
 * the first glyphs still arrived out of nowhere. The fix is a lead taken by
 * the head of the build order, driven by `ExperienceFrame.textFlow`.
 *
 * Three properties make that safe, and they are what this file pins:
 *
 *   1. the lead is zero before the pre-roll opens, so nothing appears early;
 *   2. the composed path parameter is continuous across `STORY_START`, so the
 *      build takes over without a jump;
 *   3. `build = 1` still lands every particle on its glyph, so the first line
 *      finishes on exactly the schedule the timeline already pins.
 *
 * The TSL side is verified by `npm run typecheck` only — there is no GPU under
 * vitest — so the source-level checks at the end pin that the material and the
 * layer use this arithmetic rather than a second copy of it.
 */

const ROOT = process.cwd();
const read = (relative: string) => readFileSync(path.join(ROOT, relative), "utf8");

const LAYOUTS: readonly StoryLayout[] = ["desktop", "mobile"];
const ORDERS = [0, 0.02, 0.09, 0.17, 0.18, 0.25, 0.5, 0.83, 1];

/**
 * The path parameter for one particle of the first line at a wall-clock
 * intro time, composed the way `IntroText` composes it: `flowLead` is
 * `ExperienceFrame.textFlow` for this line at every moment, and `build` is
 * zero until the line is active and the rolling frame's value after.
 */
function pathAt(time: number, order: number, layout: StoryLayout): number {
  const flow = getTextFlowEnvelope(time);
  const line = getRollingStoryLineFrame(STREAM_PREROLL_LINE, time, layout);
  return streamPathParameter(flow, order, line?.build ?? 0);
}

describe("the pre-roll window is the one the timeline already pins", () => {
  it("opens 0.15 s before the first line and closes on its build", () => {
    expect(STREAM_PREROLL_DURATION).toBeCloseTo(0.15, 10);
    expect(STORY_START - STREAM_PREROLL_START).toBeCloseTo(
      STREAM_PREROLL_DURATION,
      10,
    );
    /* The first rolling line is the one that needs the throat: it is the only
       one that would otherwise enter with nothing on screen before it. */
    for (const layout of LAYOUTS) {
      const boundary = getRollingStoryLineFrame(
        STREAM_PREROLL_LINE,
        STORY_START,
        layout,
      );
      expect(boundary, layout).not.toBeNull();
      expect(boundary!.build, layout).toBe(0);
      expect(
        getRollingStoryLineFrame(
          STREAM_PREROLL_LINE,
          STORY_START - 1e-6,
          layout,
        ),
        layout,
      ).toBeNull();
    }
  });
});

describe("the lead — zero, then a rise over the pre-roll, capped at the throat", () => {
  it("is zero at and before the moment the pre-roll opens", () => {
    for (const order of ORDERS) {
      expect(pathAt(0, order, "desktop"), `order ${order}`).toBe(0);
      expect(pathAt(STREAM_PREROLL_START, order, "desktop"), `order ${order}`).toBe(0);
      expect(
        pathAt(STREAM_PREROLL_START - 0.001, order, "desktop"),
        `order ${order}`,
      ).toBe(0);
    }
  });

  it("rises monotonically across the pre-roll for the leading subset", () => {
    const samples: number[] = [];
    for (let step = 0; step <= 30; step++) {
      const time = STREAM_PREROLL_START + (STREAM_PREROLL_DURATION * step) / 30;
      samples.push(pathAt(time, 0, "desktop"));
    }
    expect(samples[0]).toBe(0);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i], `sample ${i}`).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    /* Not a token rise: the head of the line has travelled the whole first leg
       and is sitting in the throat by the time the first glyph starts. */
    expect(samples[samples.length - 1]).toBeCloseTo(STREAM_THROAT_T, 10);
  });

  it("never runs a leading particle past the throat", () => {
    for (const order of ORDERS) {
      for (let flow = 0; flow <= 1.0001; flow += 0.05) {
        expect(streamLead(flow, order)).toBeLessThanOrEqual(STREAM_THROAT_T + 1e-12);
        expect(streamLead(flow, order)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("is a ramp across the head of the build order, not a block", () => {
    expect(streamLeadShare(0)).toBe(1);
    expect(streamLeadShare(STREAM_LEAD_SHARE)).toBe(0);
    expect(streamLeadShare(1)).toBe(0);
    expect(streamLeadShare(STREAM_LEAD_SHARE / 2)).toBeCloseTo(0.5, 10);
    /* Strictly inside the subset, strictly decreasing. */
    let previous = Number.POSITIVE_INFINITY;
    for (let order = 0; order <= STREAM_LEAD_SHARE; order += STREAM_LEAD_SHARE / 20) {
      const share = streamLeadShare(order);
      expect(share).toBeLessThanOrEqual(previous);
      previous = share;
    }
  });

  it("leaves every particle outside the leading subset exactly as it was", () => {
    for (const order of [STREAM_LEAD_SHARE, 0.3, 0.5, 0.9, 1]) {
      for (let build = 0; build <= 1.0001; build += 0.05) {
        expect(streamPathParameter(1, order, build), `order ${order}`).toBe(
          streamBuilt(order, build),
        );
      }
    }
  });
});

describe("the handover to the build is continuous", () => {
  it("has no jump at STORY_START, at any point of the build order", () => {
    for (const layout of LAYOUTS) {
      for (const order of ORDERS) {
        /* One millisecond either side of the boundary the build takes over. */
        const before = pathAt(STORY_START - 0.001, order, layout);
        const after = pathAt(STORY_START + 0.001, order, layout);
        expect(
          Math.abs(after - before),
          `${layout} order ${order}: ${before} → ${after}`,
        ).toBeLessThan(0.02);
      }
    }
  });

  it("moves by no more than a frame's worth anywhere across the pre-roll and the first build", () => {
    const dt = 0.001;
    for (const layout of LAYOUTS) {
      for (const order of ORDERS) {
        let previous = pathAt(STREAM_PREROLL_START - 0.05, order, layout);
        for (
          let time = STREAM_PREROLL_START - 0.05;
          time <= STORY_START + ROLLING_ENTER_DURATION + 0.05;
          time += dt
        ) {
          const current = pathAt(time, order, layout);
          expect(
            Math.abs(current - previous),
            `${layout} order ${order} at t=${time.toFixed(3)}`,
          ).toBeLessThan(0.02);
          previous = current;
        }
      }
    }
  });

  it("never goes backwards while the line is entering", () => {
    for (const layout of LAYOUTS) {
      for (const order of ORDERS) {
        let previous = -1;
        for (
          let time = STREAM_PREROLL_START;
          time <= STORY_START + ROLLING_ENTER_DURATION;
          time += 0.002
        ) {
          const current = pathAt(time, order, layout);
          expect(current, `${layout} order ${order} at t=${time.toFixed(3)}`)
            .toBeGreaterThanOrEqual(previous - 1e-9);
          previous = current;
        }
      }
    }
  });
});

describe("the first line still finishes on its existing schedule", () => {
  it("lands every particle exactly at build = 1", () => {
    for (const order of ORDERS) {
      expect(streamBuilt(order, 1), `order ${order}`).toBe(1);
      for (let flow = 0; flow <= 1.0001; flow += 0.1) {
        expect(streamPathParameter(flow, order, 1), `order ${order}`).toBe(1);
      }
    }
  });

  it("reaches build = 1 at the unchanged rolling enter duration", () => {
    for (const layout of LAYOUTS) {
      const landed = getRollingStoryLineFrame(
        STREAM_PREROLL_LINE,
        STORY_START + ROLLING_ENTER_DURATION,
        layout,
      );
      expect(landed, layout).not.toBeNull();
      expect(landed!.build, layout).toBe(1);
      for (const order of ORDERS) {
        expect(
          pathAt(STORY_START + ROLLING_ENTER_DURATION, order, layout),
          `${layout} order ${order}`,
        ).toBe(1);
      }
    }
  });

  it("keeps the stagger the material was built around", () => {
    expect(STREAM_STAGGER_SPAN + STREAM_TRAVEL_WINDOW).toBe(1);
    /* The last particle to start still has a full travel window inside the
       build, which is what makes `streamBuilt(order, 1) === 1` hold. */
    expect(streamBuilt(1, STREAM_STAGGER_SPAN)).toBe(0);
    expect(streamBuilt(1, 1)).toBe(1);
  });
});

describe("the shader and the layer use this arithmetic, not a second copy", () => {
  it("the material takes its constants from streamPath and maxes the two terms", () => {
    const source = read("components/particle-nav/tsl/introTextMaterial.ts");
    expect(source).toMatch(/from '@\/components\/intro\/streamPath'/);
    expect(source).toMatch(/STREAM_STAGGER_SPAN/);
    expect(source).toMatch(/STREAM_THROAT_T/);
    /* The lead ramp and the cap, mirroring `streamLead`. */
    expect(source).toMatch(
      /float\(1\)\.sub\(smoothstep\(0, STREAM_LEAD_SHARE, point\.w\)\)/,
    );
    expect(source).toMatch(
      /uniforms\.flowLead\.mul\(leadShare\)\.mul\(STREAM_THROAT_T\)/,
    );
    expect(source).toMatch(/const t = max\(built, lead\)/);
    /* No local redefinition of the constants that would drift from the module. */
    expect(source).not.toMatch(/^const (THROAT_T|STAGGER_SPAN|TRAVEL_WINDOW) =/m);
    /* Alpha follows the path, or the pre-roll would move invisible particles. */
    expect(source).toMatch(/presence = smoothstep\(0, 0\.04, t\)/);
  });

  it("IntroText drives the lead from textFlow and shows the line before its build", () => {
    const source = read("components/particle-nav/layers/IntroText.tsx");
    const frameLoop = source.slice(source.indexOf("useFrame(("));
    /* The pre-roll window is identified by the frame, not by a second clock:
       `textFlow` is open and no line has entered yet. */
    expect(frameLoop).toMatch(/story\.latestLineIndex === null \? experience\.textFlow/);
    expect(frameLoop).toMatch(/pu\.flowLead as \{ value: number \}\).value = preRoll/);
    /* Held at the same value once the line is active, so the handover frame
       writes the number the previous frame wrote. */
    expect(frameLoop).toMatch(
      /u\.flowLead as \{ value: number \}\)\.value =\s*\n?\s*active\.index === STREAM_PREROLL_LINE \? experience\.textFlow : 0/,
    );
    /* Row 0 is where the line sits at `build = 0`, so nothing shifts when the
       pre-roll branch hands over to the active branch. */
    expect(frameLoop).toMatch(/group\.position\.set\(0, intro\.rowTop, 0\.08\)/);
    /* No timing constant is re-derived here. */
    expect(frameLoop).not.toMatch(/STREAM_PREROLL_START|STORY_START/);
  });

  it("the pre-roll changes no timing constant", () => {
    const timeline = read("components/intro/story-timeline.ts");
    expect(timeline).toMatch(/export const STREAM_PREROLL_DURATION = 0\.15;/);
    expect(timeline).toMatch(
      /export const STREAM_PREROLL_START = cue\(STORY_START - STREAM_PREROLL_DURATION\);/,
    );
    expect(timeline).toMatch(/export const RELOCATION_DURATION = 1\.1;/);
    expect(timeline).toMatch(/export const STORY_START = RELOCATION_END;/);
  });
});
