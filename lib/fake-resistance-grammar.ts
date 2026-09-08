/**
 * The three things the Fake Resistance desk publishes, and the words each one
 * gets — VA-52.
 *
 * A disputed claim, a documented antisemitic incident and an influence-network
 * investigation are three different objects with three different epistemic
 * statuses, and the desk had been describing them with nested ternaries spread
 * across the card that drew them. The labels were right; nothing said *why*, so
 * nothing stopped the next surface from choosing differently.
 *
 * The harm this exists to prevent is specific and one-directional: **a
 * documented incident must never read as a "fake claim"**. An antisemitic
 * incident that happened is not a narrative in circulation, and filing it to
 * this desk is a statement about who it concerns, not about whether it is true.
 * That is why `incident` has a status line of its own rather than borrowing the
 * verification vocabulary a claim assessment uses — a claim can be *refuted*,
 * and an incident that happened cannot.
 *
 * Keyed by the preview kind rather than the section because the preview is what
 * a card has; `lib/content/homepage-adapters.ts` derives that kind from
 * `publication.section`, which remains the only editorial choice.
 */

export type FakeResistanceKind = "watch" | "case" | "article";

export interface FakeResistanceGrammar {
  /** The eyebrow above the heading: what kind of object this is. */
  kicker: string;
  /** What the status line means, in a reader's terms. */
  meaning: string;
  /** How this type's sources should be read. */
  sourceNote: string;
}

export const FAKE_RESISTANCE_GRAMMAR: Readonly<
  Record<FakeResistanceKind, FakeResistanceGrammar>
> = {
  /** Claim / fact check: something circulating, assessed against evidence. */
  watch: {
    kicker: "Claim in circulation",
    meaning: "Assessed against the evidence named below.",
    sourceNote: "Sources are what the assessment rests on.",
  },
  /** Network / investigation: actors, relationships, findings, limits. */
  case: {
    kicker: "Influence investigation",
    meaning: "Findings carry their own confidence and limitations.",
    sourceNote: "A source count is not a verdict.",
  },
  /**
   * Incident / watch: a documented event, reported.
   *
   * Deliberately not "claim" language. This is the record that must never be
   * mistaken for a disputed one.
   */
  article: {
    kicker: "Documented incident",
    meaning: "A reported event, not a claim under assessment.",
    sourceNote: "Sources document the event.",
  },
};

/** The desk's own standfirst has to cover all three, not just claims. */
export const FAKE_RESISTANCE_INTRO =
  "Three kinds of record sit here: claims in circulation, assessed against evidence; documented incidents, reported as events; and influence investigations, with their findings and their limits. Each says which it is.";
