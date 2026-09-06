import type { NarrativeWatchDetails } from "@/server/contracts/publication";

/**
 * Reading labels for the publication sections.
 *
 * `/articles/[publicId]` used to render `section.replace(/_/g, " ")`, which
 * prints "narrative watch" and "daily brief" — a machine value with its
 * underscores combed. These are the names the desk actually uses, and they are
 * exhaustive by construction: a further section fails the typecheck rather
 * than rendering as raw enum text.
 *
 * The table itself now lives in `lib/publication-routing.ts` beside the hub,
 * the route and the homepage band it belongs with — a label and a destination
 * are the same editorial decision, and holding them apart is how a record ends
 * up filed as news in one place and as a claim assessment in another. This is
 * the name that table is read by from a component.
 */
export { PUBLICATION_SECTION_LABELS as SECTION_LABELS } from "@/lib/publication-routing";

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
