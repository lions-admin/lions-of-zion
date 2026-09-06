/**
 * Fake Resistance — the live daily watch.
 *
 * Unlike every other module under `lib/content/fake-resistance*`, this one is
 * genuinely dynamic: it reads published `narrative_watch` publications
 * straight from the database, through the exact same cached, last-good-read
 * path `/geopolitical-brief` already uses (`listBriefingPublications`). No
 * new query, no new cache layer — this file exists only to name the filter
 * and the limit this page wants, the way a case-file module names which
 * static array it reads.
 *
 * This is a deliberate second tier, not a merge into the hand-curated
 * archive in `fake-resistance.ts` and `fake-resistance-cases.ts`. Those files
 * document their own bar in their own header comments — multiply
 * corroborated, non-controversial in its mechanics, reviewed in the
 * authoring session before being written down. A record here has cleared
 * nothing: it arrives through the whole-site editorial delivery path, which
 * runs no automated quality suite at all — the deterministic checks in
 * `server/modules/briefing/quality.ts` are reachable only from the legacy
 * external-briefing ingest, and no human has read this record either. (This
 * comment claimed a "17-check automated quality gate" until 2026-09-07,
 * which was true of a path these records do not travel.) Presenting the two
 * with the same weight would lend a same-day machine finding the confidence
 * of a reviewed case file, which
 * is exactly the kind of upgrade this desk does not do — see
 * `components/live/publication-labels.ts`'s own note on the same principle.
 */
import type { PublicPublication } from "@/server/contracts/publication";
import { listBriefingPublications, listPublicPublications } from "@/lib/publications";

const WATCH_LIMIT = 25;

export async function getNarrativeWatchFeed(): Promise<PublicPublication[]> {
  return listBriefingPublications(`?section=narrative_watch&limit=${WATCH_LIMIT}`);
}

/** Antisemitism has its own reading surface; it never inherits a claim label. */
export async function getAntisemitismFeed(): Promise<PublicPublication[]> {
  return listPublicPublications(`?section=antisemitism&limit=${WATCH_LIMIT}`);
}

/**
 * Influence investigations — the third section this hub owns.
 *
 * `lib/publication-routing.ts` has routed `influence_investigation` to
 * `/fake-resistance` since the section existed, and nothing here read it: a
 * record on Iranian, Russian or anti-Western influence operations was filed
 * to this desk, labelled "Influence investigation" on its own page, and
 * absent from the desk itself. It reads through `listPublicPublications`
 * rather than the briefing projection for the same reason antisemitism does —
 * a documented investigation is not a circulating claim and must not inherit
 * the watch's claim framing.
 */
export async function getInfluenceInvestigationFeed(): Promise<PublicPublication[]> {
  return listPublicPublications(`?section=influence_investigation&limit=${WATCH_LIMIT}`);
}
