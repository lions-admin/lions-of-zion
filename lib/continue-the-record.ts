import type { PublicationSection } from "@/server/contracts/enums";

/**
 * What a reader should read next — VA-50.
 *
 * An article used to end at its sources and corrections and stop. There is a
 * "Related coverage" block, but it is fed by `publication_related`, which
 * `linkRelated` writes for the *siblings of a batch* — the other records of the
 * same daily edition. That is a fact about how a record was produced, not about
 * what it is about, so on a single-record run it is empty and on an edition run
 * it recommends whatever else happened to be filed that morning.
 *
 * ## Why there is no "same developing story" rung
 *
 * The audit's ladder starts with "same canonical developing story". That rung
 * cannot return anything here: `publication_canonical_story_once` is a partial
 * unique index, so at most one live row carries a given canonical id. A
 * developing story in this system is **one record updated in place**, and its
 * chronology reaches the reader as corrections on its own page. Anything
 * sharing this record's canonical id *is* this record. Left out deliberately
 * rather than shipped as a rung that is always empty.
 *
 * ## The rule the ladder is built on
 *
 * Every rung requires a **shared field**, never a string resemblance. Keyword
 * or title similarity is what produces "you may also like" filler, and this
 * desk has already been burned by near-duplicate titles: the live sweep found
 * seven near-duplicate pairs whose titles overlap by 0.6 or more. Matching on
 * words would recommend a record's own twin.
 *
 * If nothing qualifies, this returns nothing and the caller sends the reader to
 * the section hub. An empty list is a correct answer.
 */

export type ContinuationReason = "investigation" | "actor" | "topic" | "section";

export interface ContinuationCandidate {
  publicId: string;
  title: string;
  summary: string | null;
  section: PublicationSection;
  canonicalStoryId?: string | null;
  editorialTopic?: string | null;
  primaryActor?: string | null;
  topicTags?: readonly string[];
  publishedAt?: string;
}

export interface Continuation extends ContinuationCandidate {
  reason: ContinuationReason;
}

/** Why each rung is worth a reader's next click, in the reader's words. */
export const CONTINUATION_LABELS: Readonly<Record<ContinuationReason, string>> = {
  investigation: "Investigation on this",
  actor: "More on this actor",
  topic: "More on this topic",
  section: "Also on this desk",
};

const INVESTIGATION_SECTIONS: ReadonlySet<string> = new Set([
  "influence_investigation",
  "narrative_watch",
]);

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function sharesTag(left: ContinuationCandidate, right: ContinuationCandidate): boolean {
  const tags = new Set((left.topicTags ?? []).map(normalise).filter(Boolean));
  if (!tags.size) return false;
  return (right.topicTags ?? []).some((tag) => tags.has(normalise(tag)));
}

/** The first rung a candidate satisfies, or `null` if it satisfies none. */
function rungFor(
  current: ContinuationCandidate,
  candidate: ContinuationCandidate,
): ContinuationReason | null {
  const sameTopic = Boolean(normalise(current.editorialTopic))
    && normalise(current.editorialTopic) === normalise(candidate.editorialTopic);
  const sameActor = Boolean(normalise(current.primaryActor))
    && normalise(current.primaryActor) === normalise(candidate.primaryActor);

  /* An investigation earns the top rung only when it is about the same thing.
     "Any investigation" would put the Hinkle dossier under every news brief. */
  if (INVESTIGATION_SECTIONS.has(candidate.section)
    && !INVESTIGATION_SECTIONS.has(current.section)
    && (sameTopic || sameActor || sharesTag(current, candidate))) {
    return "investigation";
  }
  if (sameActor) return "actor";
  if (sameTopic || sharesTag(current, candidate)) return "topic";
  if (current.section === candidate.section) return "section";
  return null;
}

const RUNG_ORDER: readonly ContinuationReason[] = ["investigation", "actor", "topic", "section"];

/**
 * Choose 2–4 destinations, best rung first, newest within a rung.
 *
 * `max` is a ceiling, not a target: three good rows beat four padded with a
 * fourth that only shares a desk.
 */
export function continueTheRecord(
  current: ContinuationCandidate,
  candidates: readonly ContinuationCandidate[],
  { max = 4 }: { max?: number } = {},
): Continuation[] {
  const seenTitles = new Set<string>([normalise(current.title)]);
  const currentStory = normalise(current.canonicalStoryId);
  const ranked: Continuation[] = [];

  for (const candidate of candidates) {
    if (candidate.publicId === current.publicId) continue;
    /* Same canonical story means the same record, and a repeated title means a
       duplicate the desk has not merged yet — the live sweep found ten such
       pairs. Neither is a destination. */
    if (currentStory && normalise(candidate.canonicalStoryId) === currentStory) continue;
    const title = normalise(candidate.title);
    if (seenTitles.has(title)) continue;

    const reason = rungFor(current, candidate);
    if (!reason) continue;

    seenTitles.add(title);
    ranked.push({ ...candidate, reason });
  }

  ranked.sort((a, b) => {
    const rung = RUNG_ORDER.indexOf(a.reason) - RUNG_ORDER.indexOf(b.reason);
    if (rung !== 0) return rung;
    return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
  });

  /* A lone "also on this desk" row is not a continuation, it is a leftover:
     the hub link the caller already renders says the same thing better. */
  const chosen = ranked.slice(0, Math.max(0, max));
  if (chosen.length === 1 && chosen[0]!.reason === "section") return [];
  return chosen;
}

/**
 * Gather the candidate pool without letting it decide whether the article
 * renders.
 *
 * The continuation is enrichment, and this repository already has a rule for
 * enrichment: media "never decides whether a publishable story lives"
 * (`.ai/DECISIONS.md`, 2026-09-07). The same must hold here. A desk query that
 * is slow, that rejects, or that never settles at all would otherwise hang an
 * article page forever — the article page is the one surface where every
 * element is the record, so there is nothing to stream above it while it waits.
 *
 * So each read is raced against a deadline, failures resolve to nothing, and a
 * result that is not an array is discarded rather than trusted. Every one of
 * those paths ends in the same place: an empty pool, which renders the desk
 * link alone. That is a correct page, not a degraded one.
 */
export async function continuationPool<T>(
  sections: readonly T[],
  read: (section: T) => Promise<unknown>,
  { timeoutMs = 2_000 }: { timeoutMs?: number } = {},
): Promise<ContinuationCandidate[]> {
  const settled = await Promise.all(sections.map(async (section) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const rows = await Promise.race([
        Promise.resolve(read(section)),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
      ]);
      return Array.isArray(rows) ? (rows as ContinuationCandidate[]) : [];
    } catch {
      return [];
    } finally {
      if (timer) clearTimeout(timer);
    }
  }));
  return settled.flat();
}
