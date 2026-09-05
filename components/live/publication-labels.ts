import type { PublicationSection } from "@/server/contracts/enums";
import type { NarrativeWatchDetails } from "@/server/contracts/publication";

/**
 * Reading labels for the four publication sections.
 *
 * `/articles/[publicId]` renders `section.replace(/_/g, " ")`, which prints
 * "narrative watch" and "daily brief" — a machine value with its underscores
 * combed. These are the names the desk actually uses, and they are exhaustive
 * by construction: a fifth section fails the typecheck here rather than
 * rendering as raw enum text.
 */
export const SECTION_LABELS: Record<PublicationSection, string> = {
  daily_brief: "Daily Brief",
  israel_update: "Israel update",
  narrative_watch: "Narrative Watch",
};

/**
 * The six states a Narrative Watch record's `verificationState` may hold.
 *
 * Deliberately **not** routed through `components/content/VerificationBadge`.
 * That component renders `AssessmentValue` — a different, nine-value enum
 * belonging to an information *item*, whose meanings only partly overlap these
 * ("misleading" is in both; "refuted", "disputed" and "unresolved" are not).
 * Rendering one enum through the other's presentation would silently promote a
 * `disputed` narrative into the visual language of an assessed claim, which is
 * the kind of upgrade this desk does not do.
 *
 * `tone` drives colour only, and only through the three state tokens: nothing
 * here invents a hue.
 */
export const VERIFICATION_STATES: Record<
  NarrativeWatchDetails["verificationState"],
  { label: string; tone: "ok" | "warn" | "danger" | "neutral"; meaning: string }
> = {
  verified: {
    label: "Verified",
    tone: "ok",
    meaning: "The claim holds up against the sources on record.",
  },
  refuted: {
    label: "Refuted",
    tone: "danger",
    meaning: "The record contradicts the claim.",
  },
  misleading: {
    label: "Misleading",
    tone: "danger",
    meaning: "Real material arranged to leave a false impression.",
  },
  unsupported: {
    label: "Unsupported",
    tone: "warn",
    meaning: "We looked for evidence and found none either way.",
  },
  disputed: {
    label: "Disputed",
    tone: "warn",
    meaning: "Credible sources disagree and the record does not settle it.",
  },
  unresolved: {
    label: "Unresolved",
    tone: "neutral",
    meaning: "Being tracked; no finding has been reached.",
  },
};

/** How a claim is moving. A direction, never a number — nothing here counts. */
export const TREND_LABELS: Record<NarrativeWatchDetails["trendDirection"], string> = {
  rising: "Spreading further",
  stable: "Holding steady",
  declining: "Losing circulation",
  new: "Newly observed",
  unclear: "Direction unclear",
};
