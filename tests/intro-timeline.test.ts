import { describe, expect, it } from "vitest";
import {
  BLACK_END,
  FORMATION_END,
  FORMATION_START,
  RELOCATION_END,
  RELOCATION_START,
  SCAN_REVEAL_END,
  SCAN_REVEAL_START,
  STORY_BEAT_STARTS,
  STORY_START,
  STREAM_PREROLL_START,
  FINAL_BEAT_START,
  FINAL_TIME as BEAT_FINAL_TIME,
  getFormationEnvelope,
  getLionOpacityEnvelope,
  getRelocationEnvelope,
  getScanRevealEnvelope,
  getTextFlowEnvelope,
  getTextOpacityEnvelope,
  getTimelineStage,
  type StoryLayout,
} from "@/components/intro/story-timeline";
import {
  ROLLING_CUE_TIMES_BY_LAYOUT,
  ROLLING_OUTRO_DURATION,
  ROLLING_STORY_BOUNDARIES_BY_LAYOUT,
  ROLLING_STORY_START,
  getActiveTextTransfer,
  getRollingFinalTime,
  getRollingOutroStart,
  getRollingSkipTime,
  getRollingStoryFrame,
  getRollingStoryLineFrame,
  retimeRollingStory,
} from "@/components/intro/rolling-story-timeline";

/**
 * The intro clock, pinned. The plan's acceptance is a set of zero-gap joins:
 * formation → rise → first line, with the scan waking underneath. Each was a
 * pair of absolute constants that could drift apart — and did, leaving the
 * lion centred for 2.5 s — so the joins are asserted here as equalities on
 * the exported boundaries and as behaviour of the pure envelopes, with no
 * canvas involved.
 */

const LAYOUTS: readonly StoryLayout[] = ["desktop", "mobile"];
const STEP = 0.01;

function sample(from: number, to: number): number[] {
  const out: number[] = [];
  for (let t = from; t <= to + 1e-9; t += STEP) out.push(Number(t.toFixed(3)));
  return out;
}

function expectMonotone(values: readonly number[], label: string) {
  for (let i = 1; i < values.length; i += 1) {
    expect(values[i], `${label} at step ${i}`).toBeGreaterThanOrEqual(values[i - 1]);
  }
}

describe("the lion stages join with no gap", () => {
  it("relocation starts on the boundary at which formation ends", () => {
    expect(RELOCATION_START).toBe(FORMATION_END);
    expect(getFormationEnvelope(FORMATION_END)).toBe(1);
    expect(getRelocationEnvelope(FORMATION_END)).toBe(0);
    /* One frame later the lion is already moving. */
    expect(getRelocationEnvelope(FORMATION_END + 1 / 60)).toBeGreaterThan(0);
  });

  it("has no interval after full assembly in which the lion waits", () => {
    /* There is no hold stage any more, by name or by behaviour. */
    for (const t of sample(0, RELOCATION_END + 1)) {
      expect(getTimelineStage(t)).not.toBe("lion-hold");
    }
    /* Whenever formation is complete and relocation is not, relocation is
       strictly advancing: no plateau between the two. */
    let previous = 0;
    for (const t of sample(FORMATION_END + STEP, RELOCATION_END - STEP)) {
      const relocation = getRelocationEnvelope(t);
      expect(relocation, `t=${t}`).toBeGreaterThan(previous);
      previous = relocation;
    }
  });

  it("formation and relocation are eased, continuous and monotone", () => {
    expectMonotone(sample(0, RELOCATION_END + 1).map(getFormationEnvelope), "formation");
    expectMonotone(sample(0, RELOCATION_END + 1).map(getRelocationEnvelope), "relocation");
    expect(getFormationEnvelope(FORMATION_START)).toBe(0);
    expect(getFormationEnvelope(BLACK_END)).toBe(0);
    expect(getRelocationEnvelope(RELOCATION_END)).toBe(1);
    expect(getRelocationEnvelope(RELOCATION_END + 10)).toBe(1);
  });

  it("the lion fades up inside formation, not before", () => {
    expect(getLionOpacityEnvelope(0)).toBe(0);
    expect(getLionOpacityEnvelope(FORMATION_START)).toBe(0);
    expect(getLionOpacityEnvelope(FORMATION_END)).toBe(1);
  });

  it("stays within the plan's tuning window", () => {
    /* ±150 ms of the plan's targets: 0.65 / 3.25 / 4.35. */
    expect(Math.abs(BLACK_END - 0.65)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(FORMATION_END - 3.25)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(RELOCATION_END - 4.35)).toBeLessThanOrEqual(0.15);
  });
});

describe("the first text line starts on the relocation boundary", () => {
  it("relocation end equals the rolling story start in both layouts", () => {
    expect(STORY_START).toBe(RELOCATION_END);
    expect(ROLLING_STORY_START).toBe(RELOCATION_END);
    for (const layout of LAYOUTS) {
      expect(ROLLING_STORY_BOUNDARIES_BY_LAYOUT[layout][0].enterStart).toBe(
        RELOCATION_END,
      );
      expect(ROLLING_CUE_TIMES_BY_LAYOUT[layout][0]).toBe(RELOCATION_END);
    }
  });

  it("the first line exists on that boundary and is building one frame later", () => {
    for (const layout of LAYOUTS) {
      const onBoundary = getRollingStoryLineFrame(0, RELOCATION_END, layout);
      expect(onBoundary, layout).not.toBeNull();
      expect(onBoundary?.build).toBe(0);
      expect(onBoundary?.phase).toBe("enter");
      const oneFrameLater = getRollingStoryLineFrame(0, RELOCATION_END + 1 / 60, layout);
      expect(oneFrameLater?.build ?? 0).toBeGreaterThan(0);
      /* Not a frame earlier: the throat pre-rolls, the glyphs do not. */
      expect(getRollingStoryLineFrame(0, RELOCATION_END - STEP, layout)).toBeNull();
    }
  });

  it("the stream pre-roll opens just before, and is full when the line starts", () => {
    expect(STREAM_PREROLL_START).toBeLessThan(STORY_START);
    expect(STREAM_PREROLL_START).toBeGreaterThan(FORMATION_END);
    expect(getTextFlowEnvelope(STREAM_PREROLL_START)).toBe(0);
    expect(getTextFlowEnvelope(FORMATION_END)).toBe(0);
    const mid = (STREAM_PREROLL_START + STORY_START) / 2;
    expect(getTextFlowEnvelope(mid)).toBeGreaterThan(0);
    expect(getTextFlowEnvelope(mid)).toBeLessThan(1);
    expect(getTextFlowEnvelope(STORY_START)).toBe(1);
  });

  it("text flow and text opacity release together through the outro", () => {
    expect(getTextOpacityEnvelope(0)).toBe(1);
    expect(getTextOpacityEnvelope(1)).toBe(0);
    expect(getTextFlowEnvelope(STORY_START + 5, 1)).toBe(0);
    expectMonotone(
      sample(0, 1).map((p) => 1 - getTextOpacityEnvelope(p)),
      "text release",
    );
  });

  it("activeTextTransfer follows the newest entering line and is never allocated", () => {
    for (const layout of LAYOUTS) {
      expect(getActiveTextTransfer(getRollingStoryFrame(0, layout))).toBe(0);
      expect(getActiveTextTransfer(getRollingStoryFrame(RELOCATION_END, layout))).toBe(0);
      const midBuild = getRollingStoryFrame(RELOCATION_END + 0.4, layout);
      const value = getActiveTextTransfer(midBuild);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThan(1);
      expect(value).toBe(midBuild.activeLines.find((l) => l.index === 0)?.build);
    }
  });
});

describe("the scan wakes during the rise, independent of the outro", () => {
  it("is zero through the opening and formation", () => {
    for (const t of sample(0, SCAN_REVEAL_START)) {
      expect(getScanRevealEnvelope(t), `t=${t}`).toBe(0);
    }
  });

  it("is nonzero during the rise and full after its ramp", () => {
    expect(SCAN_REVEAL_START).toBeGreaterThan(FORMATION_END);
    expect(SCAN_REVEAL_START).toBeLessThan(RELOCATION_END);
    const midRise = (SCAN_REVEAL_START + RELOCATION_END) / 2;
    expect(getScanRevealEnvelope(midRise)).toBeGreaterThan(0);
    expect(getScanRevealEnvelope(midRise)).toBeLessThan(1);
    expect(SCAN_REVEAL_END).toBeGreaterThan(STORY_START);
    expect(getScanRevealEnvelope(SCAN_REVEAL_END)).toBe(1);
    expectMonotone(sample(0, SCAN_REVEAL_END + 1).map(getScanRevealEnvelope), "scan");
  });

  it("reaches its target well before any layout's outro", () => {
    for (const layout of LAYOUTS) {
      expect(SCAN_REVEAL_END).toBeLessThan(getRollingOutroStart(layout));
    }
  });
});

describe("final times stay derived and monotonic per layout", () => {
  it("every cue is strictly increasing and ends at the outro plus its duration", () => {
    for (const layout of LAYOUTS) {
      const cues = ROLLING_CUE_TIMES_BY_LAYOUT[layout];
      for (let i = 1; i < cues.length; i += 1) {
        expect(cues[i], `${layout} cue ${i}`).toBeGreaterThan(cues[i - 1]);
      }
      const finalTime = getRollingFinalTime(layout);
      expect(cues[cues.length - 1]).toBe(finalTime);
      expect(finalTime).toBeCloseTo(
        getRollingOutroStart(layout) + ROLLING_OUTRO_DURATION,
        6,
      );
      expect(getRollingStoryFrame(finalTime, layout).isComplete).toBe(true);
      expect(getRollingStoryFrame(finalTime - STEP, layout).isComplete).toBe(false);
    }
  });

  it("the desktop cadence makes the desktop story the longer of the two", () => {
    /* Both share the lion stages; only the line cadence differs. */
    expect(getRollingFinalTime("desktop")).not.toBe(getRollingFinalTime("mobile"));
    for (const layout of LAYOUTS) {
      expect(getRollingFinalTime(layout)).toBeGreaterThan(STORY_START);
    }
  });

  it("the legacy beat table moved with the story start", () => {
    expect(STORY_BEAT_STARTS[0]).toBe(STORY_START);
    for (let i = 1; i < STORY_BEAT_STARTS.length; i += 1) {
      expect(STORY_BEAT_STARTS[i]).toBeGreaterThan(STORY_BEAT_STARTS[i - 1]);
    }
    expect(STORY_BEAT_STARTS[STORY_BEAT_STARTS.length - 1]).toBe(FINAL_BEAT_START);
    expect(BEAT_FINAL_TIME).toBeGreaterThan(FINAL_BEAT_START);
  });
});

describe("seeking never rewinds the clock", () => {
  it("skip seeks forward to the outro from anywhere before it", () => {
    for (const layout of LAYOUTS) {
      const outroStart = getRollingOutroStart(layout);
      for (const t of [0, FORMATION_END, RELOCATION_END, STORY_START + 3, outroStart - STEP]) {
        expect(getRollingSkipTime(t, layout), `${layout} t=${t}`).toBe(outroStart);
      }
    }
  });

  it("a second skip during the outro holds the clock rather than restarting it", () => {
    for (const layout of LAYOUTS) {
      const outroStart = getRollingOutroStart(layout);
      const finalTime = getRollingFinalTime(layout);
      for (const t of sample(outroStart, finalTime)) {
        expect(getRollingSkipTime(t, layout), `${layout} t=${t}`).toBeGreaterThanOrEqual(t);
      }
      expect(getRollingSkipTime(finalTime, layout)).toBe(finalTime);
      expect(getRollingSkipTime(finalTime + 5, layout)).toBe(finalTime);
    }
  });

  it("a layout change keeps the lion stages exact and the story proportional", () => {
    for (const t of [0, BLACK_END, FORMATION_END, RELOCATION_END]) {
      expect(retimeRollingStory(t, "desktop", "mobile")).toBe(t);
      expect(retimeRollingStory(t, "mobile", "desktop")).toBe(t);
    }
    for (const [from, to] of [["desktop", "mobile"], ["mobile", "desktop"]] as const) {
      expect(retimeRollingStory(getRollingFinalTime(from), from, to)).toBeCloseTo(
        getRollingFinalTime(to),
        6,
      );
      const fromSpan = getRollingFinalTime(from) - STORY_START;
      const toSpan = getRollingFinalTime(to) - STORY_START;
      const third = STORY_START + fromSpan / 3;
      expect(retimeRollingStory(third, from, to)).toBeCloseTo(STORY_START + toSpan / 3, 6);
      expectMonotone(
        sample(0, getRollingFinalTime(from)).map((t) => retimeRollingStory(t, from, to)),
        `${from}→${to}`,
      );
    }
  });
});
