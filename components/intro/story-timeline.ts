/**
 * The intro's master clock, in seconds from the first frame.
 *
 * Every boundary is derived from the one before it, so a tuning change moves
 * the whole sequence together instead of opening a gap between two absolute
 * numbers — which is how the lion came to sit centred for 2.5 s between
 * formation and relocation. Relocation now begins on the very boundary at
 * which formation completes, and the first text line builds on the boundary
 * at which relocation completes. Those zero-gap joins are pinned by
 * `tests/intro-timeline.test.ts`.
 *
 * Derived values pass through `cue()` so that two constants which are meant
 * to be the same instant compare `===` rather than differing in the last
 * binary digit — the rolling timeline rounds its entry starts the same way.
 */
function cue(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}

export const BLACK_START = 0;
export const BLACK_END = 0.65;
export const FORMATION_START = BLACK_END;
export const FORMATION_DURATION = 2.6;
export const FORMATION_END = cue(FORMATION_START + FORMATION_DURATION); // 3.25
/** No hold: the rise starts on the same boundary at which formation ends. */
export const RELOCATION_START = FORMATION_END;
export const RELOCATION_DURATION = 1.1;
export const RELOCATION_END = cue(RELOCATION_START + RELOCATION_DURATION); // 4.35
/** The first rolling line builds on the boundary at which relocation ends. */
export const STORY_START = RELOCATION_END;

/** The lion fades up over the opening of formation. */
export const LION_OPACITY_DURATION = 0.42;
/**
 * A narrow particle throat opens below the lion just before the first line
 * builds, so the first glyphs do not appear from nowhere.
 */
export const STREAM_PREROLL_DURATION = 0.15;
export const STREAM_PREROLL_START = cue(STORY_START - STREAM_PREROLL_DURATION); // 4.20
/**
 * The intelligence scan wakes during the rise and reaches its intro target
 * only after the first lines are readable. Independent of the navigation
 * outro's `navReveal`, which is what used to gate it.
 */
export const SCAN_REVEAL_START = cue(FORMATION_END + 0.45); // 3.70
export const SCAN_REVEAL_END = cue(STORY_START + 2.45); // 6.80

export const BEAT_ENTER_DURATION = 0.55;
export const BEAT_EXIT_DURATION = 0.55;
export const BEAT_OVERLAP_DURATION = 0.2;
export const FINAL_ENTER_DURATION = 0.85;

/**
 * The approved beat schedule, kept as offsets from `STORY_START` so the
 * earlier story start moves every cue with it rather than leaving a table of
 * stale absolute seconds. The runtime reads the rolling timeline; this beat
 * table survives for its frame API and its documented cue spacing.
 */
const STORY_BEAT_OFFSETS = [
  0, 2.82, 5.4, 8.1, 10.92, 13.74, 16.5, 19.08, 21.53, 23.99, 26.51,
] as const;
const FINAL_BEAT_OFFSET = 29.21;

export const FINAL_BEAT_START = cue(STORY_START + FINAL_BEAT_OFFSET);
export const FINAL_TIME = cue(FINAL_BEAT_START + FINAL_ENTER_DURATION);

export type StoryLayout = "desktop" | "mobile";

export type StoryBeatCopy = Readonly<{
  id: string;
  text: string;
  desktopLines: readonly string[];
  mobileLines: readonly string[];
  persistent: boolean;
}>;

/**
 * Line breaks are art-directed for the two render layouts. Joining either set
 * with a single space always recreates the canonical text exactly.
 */
export const STORY_BEATS = [
  {
    id: "october-7",
    text: "On October 7, the war did not stay at the border.",
    desktopLines: ["On October 7, the war did not", "stay at the border."],
    mobileLines: ["On October 7, the war", "did not stay at the border."],
    persistent: false,
  },
  {
    id: "eyes-of-the-world",
    text: "The world watched it live.",
    desktopLines: ["The world watched it live."],
    mobileLines: ["The world watched it live."],
    persistent: false,
  },
  {
    id: "broadcast-in-real-time",
    text: "Hamas broadcast the massacre themselves.",
    desktopLines: ["Hamas broadcast the massacre themselves."],
    mobileLines: ["Hamas broadcast the", "massacre themselves."],
    persistent: false,
  },
  {
    id: "another-front",
    text: "Within hours, a second front opened.",
    desktopLines: ["Within hours, a second front opened."],
    mobileLines: ["Within hours,", "a second front opened."],
    persistent: false,
  },
  {
    id: "battlefield-of-lies",
    text: "Lies travelling faster than the facts.",
    desktopLines: ["Lies travelling faster than the facts."],
    mobileLines: ["Lies travelling faster", "than the facts."],
    persistent: false,
  },
  {
    id: "wars-are-not-fought-only",
    text: "Wars are no longer fought only with missiles.",
    desktopLines: ["Wars are no longer fought", "only with missiles."],
    mobileLines: ["Wars are no longer fought", "only with missiles."],
    persistent: false,
  },
  {
    id: "videos-and-algorithms",
    text: "They are fought with videos and algorithms,",
    desktopLines: ["They are fought with videos and algorithms,"],
    mobileLines: ["They are fought with", "videos and algorithms,"],
    persistent: false,
  },
  {
    id: "public-perception",
    text: "with influencers, bots, and belief.",
    desktopLines: ["with influencers, bots, and belief."],
    mobileLines: ["with influencers, bots,", "and belief."],
    persistent: false,
  },
  {
    id: "battlefield-for-truth",
    text: "This is the battlefield for truth.",
    desktopLines: ["This is the battlefield for truth."],
    mobileLines: ["This is the", "battlefield for truth."],
    persistent: false,
  },
  {
    id: "truth-will-not-win",
    text: "Truth does not win by itself.",
    desktopLines: ["Truth does not win by itself."],
    mobileLines: ["Truth does not win by itself."],
    persistent: false,
  },
  {
    id: "uncovered-proven-seen",
    text: "It must be uncovered. Proven. Seen.",
    desktopLines: ["It must be uncovered. Proven. Seen."],
    mobileLines: ["It must be uncovered.", "Proven. Seen."],
    persistent: false,
  },
  {
    id: "join-us",
    text: "Join us.",
    desktopLines: ["Join us."],
    mobileLines: ["Join us."],
    persistent: true,
  },
] as const satisfies readonly StoryBeatCopy[];

export type StoryBeat = (typeof STORY_BEATS)[number];
export type StoryBeatId = StoryBeat["id"];


export const STORY_PARAGRAPHS = [
  STORY_BEATS[0].text,
  STORY_BEATS[1].text,
  `${STORY_BEATS[2].text} ${STORY_BEATS[3].text} ${STORY_BEATS[4].text}`,
  STORY_BEATS[5].text,
  `${STORY_BEATS[6].text} ${STORY_BEATS[7].text}`,
  STORY_BEATS[8].text,
  STORY_BEATS[9].text,
  STORY_BEATS[10].text,
  STORY_BEATS[11].text,
] as const;

/** Approved cue points; the last entry is the persistent final beat. */
export const STORY_BEAT_STARTS: readonly number[] = Object.freeze([
  ...STORY_BEAT_OFFSETS.map((offset) => cue(STORY_START + offset)),
  FINAL_BEAT_START,
]);

export type StoryBeatBoundary = Readonly<{
  index: number;
  id: StoryBeatId;
  start: number;
  enterEnd: number;
  holdEnd: number | null;
  exitEnd: number | null;
  nextStart: number | null;
  holdDuration: number | null;
  wordCount: number;
  persistent: boolean;
}>;

export type StoryBeatPhase = "enter" | "hold" | "exit" | "persistent";

export type StoryBeatFrame = Readonly<{
  index: number;
  slot: 0 | 1;
  beat: StoryBeat;
  boundary: StoryBeatBoundary;
  phase: StoryBeatPhase;
  localTime: number;
  phaseProgress: number;
  enterProgress: number;
  exitProgress: number;
  visibility: number;
}>;

export type TimelineStage =
  | "black"
  | "lion-formation"
  | "lion-relocation"
  | "story"
  | "final-build"
  | "final";

export type TimelineFrame = Readonly<{
  time: number;
  stage: TimelineStage;
  isBlackout: boolean;
  isComplete: boolean;
  lionFormation: number;
  lionRelocation: number;
  lionWind: number;
  storyProgress: number;
  finalProgress: number;
  activeBeats: readonly StoryBeatFrame[];
  primaryBeatIndex: number | null;
}>;

function roundCue(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function progressBetween(time: number, start: number, end: number): number {
  return clamp01((time - start) / (end - start));
}

function normalizeTimelineTime(time: number): number {
  if (Number.isNaN(time) || time === Number.NEGATIVE_INFINITY) return 0;
  if (time === Number.POSITIVE_INFINITY) return FINAL_TIME;
  return Math.max(0, Math.min(FINAL_TIME, time));
}

/** Hermite ease-in-out on a clamped 0..1 input. The one easing the intro uses. */
export function smoothstep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function safeTime(time: number): number {
  return Number.isNaN(time) ? 0 : time;
}

/*
 * Pure stage envelopes. Each is the eased 0..1 progress of one named stage
 * and nothing else, so `Scene.tsx`, the text layer and the scan material all
 * read the same clock instead of each dividing the time by its own copy of
 * the boundaries. Keep them allocation-free: they run once per frame.
 */

/** Lion gathers at centre; reaches 1 exactly at `FORMATION_END`. */
export function getFormationEnvelope(time: number): number {
  return smoothstep01(
    progressBetween(safeTime(time), FORMATION_START, FORMATION_END),
  );
}

/** Lion rises; begins on `FORMATION_END`, reaches 1 at `RELOCATION_END`. */
export function getRelocationEnvelope(time: number): number {
  return smoothstep01(
    progressBetween(safeTime(time), RELOCATION_START, RELOCATION_END),
  );
}

/** Lion point opacity over the opening of formation. */
export function getLionOpacityEnvelope(time: number): number {
  return smoothstep01(
    progressBetween(
      safeTime(time),
      FORMATION_START,
      FORMATION_START + LION_OPACITY_DURATION,
    ),
  );
}

/**
 * Intelligence-scan presence during the intro: zero through the black
 * opening and the first part of formation, perceptible during the rise, at
 * its intro target once the first lines are readable. Separate from the
 * navigation outro's reveal on purpose — see `SCAN_REVEAL_START`.
 */
export function getScanRevealEnvelope(time: number): number {
  return smoothstep01(
    progressBetween(safeTime(time), SCAN_REVEAL_START, SCAN_REVEAL_END),
  );
}

/**
 * Text visibility through the outro: the story text releases over the back
 * two-thirds of the outro so the navigation can arrive beneath it.
 */
export function getTextOpacityEnvelope(outroProgress: number): number {
  return 1 - smoothstep01((clamp01(outroProgress) - 0.32) / 0.68);
}

/**
 * Global enable for lion-to-text emission: opens over the stream pre-roll so
 * a throat exists below the lion when the first line starts to build, holds
 * at 1 through the story, and releases with the text through the outro.
 */
export function getTextFlowEnvelope(
  time: number,
  outroProgress = 0,
): number {
  return (
    smoothstep01(
      progressBetween(safeTime(time), STREAM_PREROLL_START, STORY_START),
    ) * getTextOpacityEnvelope(outroProgress)
  );
}

/**
 * The approved timing treats a standalone em dash as a spoken/display token.
 * Counting whitespace-delimited tokens therefore reproduces every cue point.
 */
export function countStoryWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

export function getStoryHoldDuration(text: string): number {
  return roundCue(
    Math.max(1.55, Math.min(2.05, 1.2 + countStoryWords(text) * 0.06)),
  );
}

export function getStoryLines(
  beat: StoryBeat,
  layout: StoryLayout,
): readonly string[] {
  return layout === "mobile" ? beat.mobileLines : beat.desktopLines;
}

export const STORY_BEAT_BOUNDARIES: readonly StoryBeatBoundary[] =
  STORY_BEATS.map((beat, index) => {
    const start = STORY_BEAT_STARTS[index] ?? FINAL_BEAT_START;
    const nextStart = STORY_BEAT_STARTS[index + 1] ?? null;
    const wordCount = countStoryWords(beat.text);

    if (beat.persistent) {
      return {
        index,
        id: beat.id,
        start,
        enterEnd: FINAL_TIME,
        holdEnd: null,
        exitEnd: null,
        nextStart: null,
        holdDuration: null,
        wordCount,
        persistent: true,
      };
    }

    const holdDuration = getStoryHoldDuration(beat.text);
    const enterEnd = roundCue(start + BEAT_ENTER_DURATION);
    const holdEnd = roundCue(enterEnd + holdDuration);

    return {
      index,
      id: beat.id,
      start,
      enterEnd,
      holdEnd,
      exitEnd: roundCue(holdEnd + BEAT_EXIT_DURATION),
      nextStart,
      holdDuration,
      wordCount,
      persistent: false,
    };
  });

export function getStoryBeatFrame(
  index: number,
  time: number,
): StoryBeatFrame | null {
  const beat = STORY_BEATS[index];
  const boundary = STORY_BEAT_BOUNDARIES[index];
  if (!beat || !boundary) return null;

  const normalizedTime = normalizeTimelineTime(time);
  if (normalizedTime < boundary.start) return null;
  if (boundary.exitEnd !== null && normalizedTime >= boundary.exitEnd) return null;

  const enterProgress = progressBetween(
    normalizedTime,
    boundary.start,
    boundary.enterEnd,
  );
  let phase: StoryBeatPhase;
  let phaseProgress: number;
  let exitProgress = 0;

  if (normalizedTime < boundary.enterEnd) {
    phase = "enter";
    phaseProgress = enterProgress;
  } else if (boundary.persistent) {
    phase = "persistent";
    phaseProgress = 1;
  } else if (boundary.holdEnd !== null && normalizedTime < boundary.holdEnd) {
    phase = "hold";
    phaseProgress = progressBetween(
      normalizedTime,
      boundary.enterEnd,
      boundary.holdEnd,
    );
  } else {
    phase = "exit";
    exitProgress = progressBetween(
      normalizedTime,
      boundary.holdEnd as number,
      boundary.exitEnd as number,
    );
    phaseProgress = exitProgress;
  }

  return {
    index,
    slot: (index % 2) as 0 | 1,
    beat,
    boundary,
    phase,
    localTime: roundCue(normalizedTime - boundary.start),
    phaseProgress,
    enterProgress,
    exitProgress,
    visibility: enterProgress * (1 - exitProgress),
  };
}

export function getTimelineStage(time: number): TimelineStage {
  const normalizedTime = normalizeTimelineTime(time);
  if (normalizedTime < BLACK_END) return "black";
  if (normalizedTime < FORMATION_END) return "lion-formation";
  if (normalizedTime < RELOCATION_END) return "lion-relocation";
  if (normalizedTime < FINAL_BEAT_START) return "story";
  if (normalizedTime < FINAL_TIME) return "final-build";
  return "final";
}

export function getTimelineFrame(time: number): TimelineFrame {
  const normalizedTime = normalizeTimelineTime(time);
  const stage = getTimelineStage(normalizedTime);
  const lionRelocation = progressBetween(
    normalizedTime,
    RELOCATION_START,
    RELOCATION_END,
  );
  const activeBeats = STORY_BEATS.flatMap((_, index) => {
    const frame = getStoryBeatFrame(index, normalizedTime);
    return frame ? [frame] : [];
  });

  return {
    time: normalizedTime,
    stage,
    isBlackout: stage === "black",
    isComplete: normalizedTime >= FINAL_TIME,
    lionFormation: progressBetween(
      normalizedTime,
      FORMATION_START,
      FORMATION_END,
    ),
    lionRelocation,
    lionWind:
      stage === "lion-relocation" ? Math.sin(Math.PI * lionRelocation) : 0,
    storyProgress: progressBetween(normalizedTime, STORY_START, FINAL_TIME),
    finalProgress: progressBetween(
      normalizedTime,
      FINAL_BEAT_START,
      FINAL_TIME,
    ),
    activeBeats,
    primaryBeatIndex:
      activeBeats.length > 0 ? activeBeats[activeBeats.length - 1].index : null,
  };
}

/** Return the next approved story cue, or the stable final frame time. */
export function getNextBeatTime(time: number): number {
  const normalizedTime = normalizeTimelineTime(time);
  const nextStart = STORY_BEAT_STARTS.find(
    (start) => start > normalizedTime + Number.EPSILON,
  );
  return nextStart ?? FINAL_TIME;
}

export const FINAL_FRAME = getTimelineFrame(FINAL_TIME);
export const SKIP_FRAME = FINAL_FRAME;

export function getFinalFrame(): TimelineFrame {
  return getTimelineFrame(FINAL_TIME);
}
