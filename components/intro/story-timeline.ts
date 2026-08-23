export const BLACK_START = 0;
export const BLACK_END = 1;
export const FORMATION_START = BLACK_END;
export const FORMATION_END = 3.8;
export const LION_HOLD_START = FORMATION_END;
export const LION_HOLD_END = 6.3;
export const RELOCATION_START = LION_HOLD_END;
export const RELOCATION_END = 8.5;
export const STORY_START = RELOCATION_END;

export const BEAT_ENTER_DURATION = 0.55;
export const BEAT_EXIT_DURATION = 0.55;
export const BEAT_OVERLAP_DURATION = 0.2;
export const FINAL_ENTER_DURATION = 0.85;

export const FINAL_BEAT_START = 37.71;
export const FINAL_TIME = 38.56;

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
    text: "On October 7, the war did not erupt only along Israel’s borders.",
    desktopLines: [
      "On October 7, the war did not erupt",
      "only along Israel’s borders.",
    ],
    mobileLines: [
      "On October 7, the war",
      "did not erupt only along",
      "Israel’s borders.",
    ],
    persistent: false,
  },
  {
    id: "eyes-of-the-world",
    text: "It unfolded before the eyes of the world.",
    desktopLines: ["It unfolded before the eyes", "of the world."],
    mobileLines: ["It unfolded before", "the eyes of the world."],
    persistent: false,
  },
  {
    id: "broadcast-in-real-time",
    text: "Hamas terrorists documented and broadcast their actions in real time.",
    desktopLines: [
      "Hamas terrorists documented and broadcast",
      "their actions in real time.",
    ],
    mobileLines: [
      "Hamas terrorists documented",
      "and broadcast their actions",
      "in real time.",
    ],
    persistent: false,
  },
  {
    id: "another-front",
    text: "But before the smoke had cleared, another front was already open —",
    desktopLines: [
      "But before the smoke had cleared,",
      "another front was already open —",
    ],
    mobileLines: [
      "But before the smoke",
      "had cleared, another front",
      "was already open —",
    ],
    persistent: false,
  },
  {
    id: "battlefield-of-lies",
    text: "a battlefield of lies, propaganda, and narratives spreading faster than the facts.",
    desktopLines: [
      "a battlefield of lies, propaganda,",
      "and narratives spreading faster",
      "than the facts.",
    ],
    mobileLines: [
      "a battlefield of lies,",
      "propaganda, and narratives",
      "spreading faster than the facts.",
    ],
    persistent: false,
  },
  {
    id: "wars-are-not-fought-only",
    text: "Today’s wars are not fought only with soldiers, aircraft, and missiles.",
    desktopLines: [
      "Today’s wars are not fought only",
      "with soldiers, aircraft, and missiles.",
    ],
    mobileLines: [
      "Today’s wars are not fought",
      "only with soldiers, aircraft,",
      "and missiles.",
    ],
    persistent: false,
  },
  {
    id: "videos-and-algorithms",
    text: "They are also fought with videos, headlines, algorithms,",
    desktopLines: [
      "They are also fought with videos,",
      "headlines, algorithms,",
    ],
    mobileLines: [
      "They are also fought with",
      "videos, headlines,",
      "algorithms,",
    ],
    persistent: false,
  },
  {
    id: "public-perception",
    text: "influencers, bots, and public perception.",
    desktopLines: ["influencers, bots,", "and public perception."],
    mobileLines: ["influencers, bots,", "and public perception."],
    persistent: false,
  },
  {
    id: "battlefield-for-truth",
    text: "This is the battlefield for truth.",
    desktopLines: ["This is the battlefield", "for truth."],
    mobileLines: ["This is the battlefield", "for truth."],
    persistent: false,
  },
  {
    id: "truth-will-not-win",
    text: "And truth will not win by itself.",
    desktopLines: ["And truth will not win", "by itself."],
    mobileLines: ["And truth will not win", "by itself."],
    persistent: false,
  },
  {
    id: "uncovered-proven-seen",
    text: "It must be uncovered. Proven. And seen by the world.",
    desktopLines: [
      "It must be uncovered. Proven.",
      "And seen by the world.",
    ],
    mobileLines: [
      "It must be uncovered.",
      "Proven. And seen",
      "by the world.",
    ],
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

export const STORY_TRANSCRIPT = STORY_PARAGRAPHS.join("\n\n");

/** Approved cue points; the last entry is the persistent final beat. */
export const STORY_BEAT_STARTS = [
  8.5,
  11.32,
  13.9,
  16.6,
  19.42,
  22.24,
  25,
  27.58,
  30.03,
  32.49,
  35.01,
  FINAL_BEAT_START,
] as const;

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
  | "lion-hold"
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
    const start = STORY_BEAT_STARTS[index];
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
  if (normalizedTime < LION_HOLD_END) return "lion-hold";
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
