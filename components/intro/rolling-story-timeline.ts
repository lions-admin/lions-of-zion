import {
  STORY_BEATS,
  STORY_START,
  type StoryBeatId,
  type StoryLayout,
} from "./story-timeline";

export const ROLLING_STORY_START = STORY_START;
export const ROLLING_WINDOW_SIZE = 4;
export const ROLLING_POOL_SIZE = ROLLING_WINDOW_SIZE + 1;
/*
 * Cadence is per layout, and the phone's is faster.
 *
 * It used to be one `ROLLING_LINE_CADENCE = 1.25` applied to the line index,
 * with every downstream cue derived from `lines.length - 1`. But the line
 * count is art direction, not content: the same twelve sentences break into
 * 14 lines on desktop and 21 on mobile, so the phone sat through 8.75 extra
 * seconds — 47.33s against 38.58s, a 22.7% longer cut for the small screen,
 * the impatient context, the metered connection and the battery. That is also
 * longer than the ~44.5s version `.ai/DECISIONS.md` (2026-08-23) explicitly
 * rejected as too long, and it was never re-measured after the mobile line
 * array grew.
 *
 * 1.0s on mobile brings the intro to 42.33s and the gap to 9.7%. Desktop is
 * untouched, so the whole saving lands where the cost was.
 *
 * ── Why not a beat-relative schedule, which is what the design audit filed ──
 *
 * Because the twelve sentences cannot take equal wall-clock time on both
 * layouts without a composition change that no constant here can express.
 * Equal totals mean mobile's 21 lines fit in desktop's 16.25s of story — one
 * line every 0.8125s across the 20 gaps — while `ROLLING_EXIT_DURATION` is
 * 1.0s. A line cannot be retired faster than it dissolves, so at least two
 * lines are always dissolving at once. That overruns `ROLLING_POOL_SIZE`,
 * which is `ROLLING_WINDOW_SIZE + 1` precisely because exactly one line has
 * ever been dissolving at a time: `IntroText` keys its sprite pool on
 * `index % pool`, so a sixth concurrent line silently takes another's slot
 * and a sentence vanishes. It also puts two dissolving clouds in the same
 * row, since `getNormalPosition` clamps everything past the window to row 0.
 * Both reproduce: at 0.8125s the mobile timeline reaches six concurrent lines
 * and two simultaneous dissolves, and a slot is double-claimed through 7.8%
 * of the intro.
 *
 * ── Why the remaining 3.75s stays ──────────────────────────────────────────
 *
 * The three ways out — a wider pool, a row rule for lines more than one step
 * past the window, a shorter dissolve — all buy wall clock by taking reading
 * time off the phone, and the phone has less of it to give.
 *
 * The window is four *lines* wide, so it holds about 3.4 desktop sentences
 * and about 2.3 mobile ones. A sentence broken across two lines is whole on
 * screen only from the moment its second line finishes building until its
 * first line begins to dissolve — `3 × cadence − ROLLING_ENTER_DURATION`.
 * Measured against the real arrays: a typical desktop sentence is whole for
 * 4.20s and a typical mobile one for 2.20s. Equalising the totals takes
 * mobile to 1.64s, 39% of desktop's. The phone would finish sooner having
 * been given less time to read — the opening defect wearing the other shoe.
 *
 * So mobile's 1.0s is a floor and not a stopping point for want of effort: it
 * is exactly `ROLLING_EXIT_DURATION`, the fastest cadence at which one line
 * has finished dissolving before the next needs its row. What remains of the
 * gap is the honest cost of breaking twelve sentences into 21 lines instead
 * of 14, and closing it means changing the break, not the clock.
 *
 * (The audit's own figure, a 2.2s beat cadence, does not land near 38.6s
 * either: it computes to 46.53s.)
 *
 * Two invariants hold these numbers, and both are asserted rather than left
 * to this comment — see `tests/intro-rolling-timeline.test.ts`:
 *   - a layout's cadence must stay at or above `ROLLING_EXIT_DURATION`;
 *   - mobile's total must stay within 10% of desktop's, so a growing mobile
 *     line array cannot quietly buy itself more wall clock again.
 * `.claude/hooks/check-story-timeline.mjs` re-checks both on every edit to
 * `story-timeline.ts`, which is where a line array actually grows.
 */
export const ROLLING_LINE_CADENCE_BY_LAYOUT: Readonly<
  Record<StoryLayout, number>
> = Object.freeze({ desktop: 1.25, mobile: 1 });
export const ROLLING_ENTER_DURATION = 0.8;
export const ROLLING_EXIT_DURATION = 1;
export const ROLLING_POSITION_DURATION = 0.8;
export const ROLLING_JOIN_HOLD_DURATION = 1.8;
export const ROLLING_CLEANUP_CADENCE = 1.1;
export const ROLLING_CENTER_DURATION = 0.95;
export const ROLLING_BRAND_DELAY = 0.18;
export const ROLLING_BRAND_ENTER_DURATION = 0.9;
export const ROLLING_FINAL_HOLD_DURATION = 3.2;
export const ROLLING_OUTRO_DURATION = 2.8;
export const ROLLING_FINAL_ROW = 1.12;

function roundTime(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}

export type RollingStoryLine = Readonly<{
  index: number;
  beatIndex: number;
  beatId: StoryBeatId;
  lineInBeat: number;
  text: string;
  isJoin: boolean;
}>;

function buildLineRecords(layout: StoryLayout): readonly RollingStoryLine[] {
  return Object.freeze(
    STORY_BEATS.flatMap((beat, beatIndex) =>
      beat[layout === "desktop" ? "desktopLines" : "mobileLines"].map(
        (text, lineInBeat) => ({
          index: 0,
          beatIndex,
          beatId: beat.id,
          lineInBeat,
          text,
          isJoin: beat.persistent,
        }),
      ),
    ).map((line, index) => Object.freeze({ ...line, index })),
  );
}

export const ROLLING_STORY_LINE_RECORDS_BY_LAYOUT: Readonly<
  Record<StoryLayout, readonly RollingStoryLine[]>
> = Object.freeze({
  desktop: buildLineRecords("desktop"),
  mobile: buildLineRecords("mobile"),
});

export const ROLLING_STORY_LINES_BY_LAYOUT: Readonly<
  Record<StoryLayout, readonly string[]>
> = Object.freeze({
  desktop: Object.freeze(
    ROLLING_STORY_LINE_RECORDS_BY_LAYOUT.desktop.map((line) => line.text),
  ),
  mobile: Object.freeze(
    ROLLING_STORY_LINE_RECORDS_BY_LAYOUT.mobile.map((line) => line.text),
  ),
});

/**
 * When each line enters, solved once per layout rather than divided out of a
 * single constant at three call sites — which is what made the cadence
 * layout-blind, and the intro nine seconds longer on a phone, in the first
 * place.
 */
function buildEntryStarts(layout: StoryLayout): readonly number[] {
  const cadence = ROLLING_LINE_CADENCE_BY_LAYOUT[layout];
  return Object.freeze(
    ROLLING_STORY_LINE_RECORDS_BY_LAYOUT[layout].map((_, index) =>
      roundTime(ROLLING_STORY_START + index * cadence),
    ),
  );
}

const ENTRY_STARTS: Readonly<Record<StoryLayout, readonly number[]>> =
  Object.freeze({
    desktop: buildEntryStarts("desktop"),
    mobile: buildEntryStarts("mobile"),
  });

// Compatibility aliases use the more conservative mobile layout.
export const ROLLING_STORY_LINE_RECORDS =
  ROLLING_STORY_LINE_RECORDS_BY_LAYOUT.mobile;
export const ROLLING_STORY_LINES = ROLLING_STORY_LINES_BY_LAYOUT.mobile;
export const ROLLING_CLEANUP_COUNT = ROLLING_WINDOW_SIZE - 1;

type RollingTiming = Readonly<{
  joinIndex: number;
  joinStart: number;
  joinEnterEnd: number;
  cleanupStart: number;
  centerStart: number;
  brandStart: number;
  brandEnd: number;
  outroStart: number;
  finalTime: number;
}>;

function buildTiming(layout: StoryLayout): RollingTiming {
  const joinIndex = ROLLING_STORY_LINES_BY_LAYOUT[layout].length - 1;
  const joinStart = ENTRY_STARTS[layout][joinIndex];
  const joinEnterEnd = roundTime(joinStart + ROLLING_ENTER_DURATION);
  const cleanupStart = roundTime(
    joinEnterEnd + ROLLING_JOIN_HOLD_DURATION,
  );
  const centerStart = roundTime(
    cleanupStart +
      (ROLLING_CLEANUP_COUNT - 1) * ROLLING_CLEANUP_CADENCE +
      ROLLING_EXIT_DURATION,
  );
  const brandStart = roundTime(
    centerStart + ROLLING_CENTER_DURATION + ROLLING_BRAND_DELAY,
  );
  const brandEnd = roundTime(brandStart + ROLLING_BRAND_ENTER_DURATION);
  const outroStart = roundTime(brandEnd + ROLLING_FINAL_HOLD_DURATION);
  return Object.freeze({
    joinIndex,
    joinStart,
    joinEnterEnd,
    cleanupStart,
    centerStart,
    brandStart,
    brandEnd,
    outroStart,
    finalTime: roundTime(outroStart + ROLLING_OUTRO_DURATION),
  });
}

const TIMINGS: Readonly<Record<StoryLayout, RollingTiming>> = Object.freeze({
  desktop: buildTiming("desktop"),
  mobile: buildTiming("mobile"),
});

export const ROLLING_JOIN_INDEX = TIMINGS.mobile.joinIndex;
export const ROLLING_FINAL_TIME = TIMINGS.mobile.finalTime;
export const FINAL_TIME = ROLLING_FINAL_TIME;

export function getRollingFinalTime(layout: StoryLayout): number {
  return TIMINGS[layout].finalTime;
}

export function getRollingOutroStart(layout: StoryLayout): number {
  return TIMINGS[layout].outroStart;
}

export type RollingStoryLineBoundary = Readonly<{
  index: number;
  enterStart: number;
  enterEnd: number;
  exitStart: number | null;
  exitEnd: number | null;
}>;

export type RollingLinePhase =
  | "enter"
  | "visible"
  | "shift"
  | "exit"
  | "centering"
  | "final";

export type RollingPositionPhase = "steady" | "shift" | "center";

export type RollingStoryLineFrame = Readonly<{
  index: number;
  slot: 0 | 1 | 2 | 3 | 4;
  line: RollingStoryLine;
  text: string;
  isJoin: boolean;
  boundary: RollingStoryLineBoundary;
  phase: RollingLinePhase;
  build: number;
  disperse: number;
  visibility: number;
  rowFrom: number;
  rowTo: number;
  row: number;
  positionPhase: RollingPositionPhase;
  positionProgress: number;
  centerProgress: number;
}>;

export type RollingStoryStage =
  | "waiting"
  | "rolling"
  | "join-enter"
  | "join-hold"
  | "cleanup"
  | "centering"
  | "branding"
  | "final"
  | "outro"
  | "complete";

export type RollingStoryFrame = Readonly<{
  time: number;
  stage: RollingStoryStage;
  isComplete: boolean;
  latestLineIndex: number | null;
  joinProgress: number;
  centerProgress: number;
  brandProgress: number;
  outroProgress: number;
  activeLines: readonly RollingStoryLineFrame[];
}>;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smooth01(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function progressBetween(time: number, start: number, duration: number): number {
  const progress = (time - start) / duration;
  if (progress <= 1e-9) return 0;
  if (progress >= 1 - 1e-9) return 1;
  return clamp01(progress);
}

function normalizeTime(time: number, layout: StoryLayout): number {
  const finalTime = TIMINGS[layout].finalTime;
  if (Number.isNaN(time) || time === Number.NEGATIVE_INFINITY) return 0;
  if (time === Number.POSITIVE_INFINITY) return finalTime;
  return Math.max(0, Math.min(finalTime, time));
}

function getEntryStart(index: number, layout: StoryLayout): number {
  return ENTRY_STARTS[layout][index] ?? ROLLING_STORY_START;
}

/**
 * The newest line that has entered. A scan over the solved table rather than a
 * division by a cadence constant — which is what let two of these call sites
 * disagree with the layout in the first place, and what would have to change
 * again for any schedule whose entries are not evenly spaced.
 */
function getLatestLineIndex(time: number, layout: StoryLayout): number {
  const starts = ENTRY_STARTS[layout];
  let latest = 0;
  for (let index = 0; index < starts.length; index += 1) {
    if (starts[index] > time + 1e-9) break;
    latest = index;
  }
  return Math.min(TIMINGS[layout].joinIndex, latest);
}

function getExitStart(
  index: number,
  layout: StoryLayout,
): number | null {
  const timing = TIMINGS[layout];
  if (index === timing.joinIndex) return null;

  const normalReplacementIndex = index + ROLLING_WINDOW_SIZE;
  if (normalReplacementIndex <= timing.joinIndex) {
    return getEntryStart(normalReplacementIndex, layout);
  }

  const cleanupIndex =
    index - (timing.joinIndex - ROLLING_CLEANUP_COUNT);
  return roundTime(
    timing.cleanupStart + cleanupIndex * ROLLING_CLEANUP_CADENCE,
  );
}

function buildBoundaries(
  layout: StoryLayout,
): readonly RollingStoryLineBoundary[] {
  return Object.freeze(
    ROLLING_STORY_LINES_BY_LAYOUT[layout].map((_, index) => {
      const enterStart = getEntryStart(index, layout);
      const exitStart = getExitStart(index, layout);
      return Object.freeze({
        index,
        enterStart,
        enterEnd: roundTime(enterStart + ROLLING_ENTER_DURATION),
        exitStart,
        exitEnd:
          exitStart === null
            ? null
            : roundTime(exitStart + ROLLING_EXIT_DURATION),
      });
    }),
  );
}

export const ROLLING_STORY_BOUNDARIES_BY_LAYOUT = Object.freeze({
  desktop: buildBoundaries("desktop"),
  mobile: buildBoundaries("mobile"),
});
export const ROLLING_STORY_BOUNDARIES =
  ROLLING_STORY_BOUNDARIES_BY_LAYOUT.mobile;

type PositionTransition = Readonly<{
  from: number;
  to: number;
  progress: number;
  phase: RollingPositionPhase;
}>;

function getNormalPosition(
  index: number,
  latestIndex: number,
  time: number,
  build: number,
  layout: StoryLayout,
): PositionTransition {
  if (latestIndex < ROLLING_WINDOW_SIZE) {
    return { from: index, to: index, progress: build, phase: "steady" };
  }

  const oldestReadableIndex = latestIndex - (ROLLING_WINDOW_SIZE - 1);
  const exitingIndex = oldestReadableIndex - 1;
  if (index <= exitingIndex) {
    return { from: 0, to: 0, progress: 1, phase: "steady" };
  }

  const to = index - oldestReadableIndex;
  if (index === latestIndex) {
    return { from: to, to, progress: build, phase: "steady" };
  }

  return {
    from: to + 1,
    to,
    progress: progressBetween(
      time,
      getEntryStart(latestIndex, layout),
      ROLLING_POSITION_DURATION,
    ),
    phase: "shift",
  };
}

function getCleanupPosition(
  index: number,
  time: number,
  layout: StoryLayout,
): PositionTransition {
  const timing = TIMINGS[layout];
  const cleanupStep = Math.min(
    ROLLING_CLEANUP_COUNT - 1,
    Math.floor(
      (time - timing.cleanupStart + 1e-9) /
        ROLLING_CLEANUP_CADENCE,
    ),
  );
  const exitingIndex =
    timing.joinIndex - ROLLING_CLEANUP_COUNT + cleanupStep;

  if (index <= exitingIndex) {
    return { from: 0, to: 0, progress: 1, phase: "steady" };
  }

  const to = index - exitingIndex - 1;
  const cueTime =
    timing.cleanupStart + cleanupStep * ROLLING_CLEANUP_CADENCE;
  return {
    from: to + 1,
    to,
    progress: progressBetween(time, cueTime, ROLLING_EXIT_DURATION),
    phase: "shift",
  };
}

function getPositionTransition(
  index: number,
  latestIndex: number,
  time: number,
  build: number,
  layout: StoryLayout,
): PositionTransition {
  const timing = TIMINGS[layout];
  if (index === timing.joinIndex && time >= timing.centerStart) {
    return {
      from: 0,
      to: ROLLING_FINAL_ROW,
      progress: progressBetween(
        time,
        timing.centerStart,
        ROLLING_CENTER_DURATION,
      ),
      phase: "center",
    };
  }

  if (time >= timing.cleanupStart) {
    return getCleanupPosition(index, time, layout);
  }

  return getNormalPosition(index, latestIndex, time, build, layout);
}

export function getRollingStoryLineFrame(
  index: number,
  time: number,
  layout: StoryLayout = "mobile",
): RollingStoryLineFrame | null {
  const records = ROLLING_STORY_LINE_RECORDS_BY_LAYOUT[layout];
  const boundaries = ROLLING_STORY_BOUNDARIES_BY_LAYOUT[layout];
  const timing = TIMINGS[layout];
  const line = records[index];
  const boundary = boundaries[index];
  if (!line || !boundary) return null;

  const normalizedTime = normalizeTime(time, layout);
  if (normalizedTime < boundary.enterStart) return null;
  if (boundary.exitEnd !== null && normalizedTime >= boundary.exitEnd) {
    return null;
  }

  const latestLineIndex = getLatestLineIndex(normalizedTime, layout);
  const build = progressBetween(
    normalizedTime,
    boundary.enterStart,
    ROLLING_ENTER_DURATION,
  );
  const disperse =
    boundary.exitStart === null
      ? 0
      : progressBetween(
          normalizedTime,
          boundary.exitStart,
          ROLLING_EXIT_DURATION,
        );
  const position = getPositionTransition(
    index,
    latestLineIndex,
    normalizedTime,
    build,
    layout,
  );
  const positionProgress = clamp01(position.progress);
  const row =
    position.from +
    (position.to - position.from) * smooth01(positionProgress);
  const centerProgress =
    position.phase === "center"
      ? positionProgress
      : line.isJoin && normalizedTime >= timing.brandStart
        ? 1
        : 0;

  let phase: RollingLinePhase = "visible";
  if (boundary.exitStart !== null && normalizedTime >= boundary.exitStart) {
    phase = "exit";
  } else if (build < 1) {
    phase = "enter";
  } else if (position.phase === "center") {
    phase = centerProgress >= 1 ? "final" : "centering";
  } else if (position.phase === "shift" && positionProgress < 1) {
    phase = "shift";
  } else if (line.isJoin && normalizedTime >= timing.brandStart) {
    phase = "final";
  }

  return {
    index,
    slot: (index % ROLLING_POOL_SIZE) as 0 | 1 | 2 | 3 | 4,
    line,
    text: line.text,
    isJoin: line.isJoin,
    boundary,
    phase,
    build,
    disperse,
    visibility: build * (1 - disperse),
    rowFrom: position.from,
    rowTo: position.to,
    row,
    positionPhase: position.phase,
    positionProgress,
    centerProgress,
  };
}

export function getRollingStoryStage(
  time: number,
  layout: StoryLayout = "mobile",
): RollingStoryStage {
  const timing = TIMINGS[layout];
  const normalizedTime = normalizeTime(time, layout);
  if (normalizedTime < ROLLING_STORY_START) return "waiting";
  if (normalizedTime < timing.joinStart) return "rolling";
  if (normalizedTime < timing.joinEnterEnd) return "join-enter";
  if (normalizedTime < timing.cleanupStart) return "join-hold";
  if (normalizedTime < timing.centerStart) return "cleanup";
  if (normalizedTime < timing.brandStart) return "centering";
  if (normalizedTime < timing.brandEnd) return "branding";
  if (normalizedTime < timing.outroStart) return "final";
  if (normalizedTime < timing.finalTime) return "outro";
  return "complete";
}

export function getRollingStoryFrame(
  time: number,
  layout: StoryLayout = "mobile",
): RollingStoryFrame {
  const timing = TIMINGS[layout];
  const records = ROLLING_STORY_LINE_RECORDS_BY_LAYOUT[layout];
  const normalizedTime = normalizeTime(time, layout);
  const latestLineIndex =
    normalizedTime < ROLLING_STORY_START
      ? null
      : getLatestLineIndex(normalizedTime, layout);
  const activeLines = records.flatMap((_, index) => {
    const frame = getRollingStoryLineFrame(
      index,
      normalizedTime,
      layout,
    );
    return frame ? [frame] : [];
  });

  return {
    time: normalizedTime,
    stage: getRollingStoryStage(normalizedTime, layout),
    isComplete: normalizedTime >= timing.finalTime,
    latestLineIndex,
    joinProgress: progressBetween(
      normalizedTime,
      timing.joinStart,
      ROLLING_ENTER_DURATION,
    ),
    centerProgress: progressBetween(
      normalizedTime,
      timing.centerStart,
      ROLLING_CENTER_DURATION,
    ),
    brandProgress: progressBetween(
      normalizedTime,
      timing.brandStart,
      ROLLING_BRAND_ENTER_DURATION,
    ),
    outroProgress: progressBetween(
      normalizedTime,
      timing.outroStart,
      ROLLING_OUTRO_DURATION,
    ),
    activeLines,
  };
}

function buildCueTimes(layout: StoryLayout): readonly number[] {
  const timing = TIMINGS[layout];
  return Object.freeze([
    ...ROLLING_STORY_BOUNDARIES_BY_LAYOUT[layout].map(
      (boundary) => boundary.enterStart,
    ),
    ...Array.from(
      { length: ROLLING_CLEANUP_COUNT },
      (_, index) =>
        roundTime(
          timing.cleanupStart + index * ROLLING_CLEANUP_CADENCE,
        ),
    ),
    timing.centerStart,
    timing.brandStart,
    timing.outroStart,
    timing.finalTime,
  ]);
}

export const ROLLING_CUE_TIMES_BY_LAYOUT = Object.freeze({
  desktop: buildCueTimes("desktop"),
  mobile: buildCueTimes("mobile"),
});
export const ROLLING_CUE_TIMES = ROLLING_CUE_TIMES_BY_LAYOUT.mobile;

export function getNextRollingCue(
  time: number,
  layout: StoryLayout = "mobile",
): number {
  const normalizedTime = normalizeTime(time, layout);
  return (
    ROLLING_CUE_TIMES_BY_LAYOUT[layout].find(
      (cue) => cue > normalizedTime + Number.EPSILON,
    ) ?? TIMINGS[layout].finalTime
  );
}

export const ROLLING_FINAL_FRAME = getRollingStoryFrame(
  ROLLING_FINAL_TIME,
  "mobile",
);
