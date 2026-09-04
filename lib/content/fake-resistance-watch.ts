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
 * this platform's 17-check automated quality gate and nothing more: no
 * human has read it yet. Presenting the two with the same weight would lend
 * a same-day machine finding the confidence of a reviewed case file, which
 * is exactly the kind of upgrade this desk does not do — see
 * `components/live/publication-labels.ts`'s own note on the same principle.
 */
import type { PublicPublication } from "@/server/contracts/publication";
import { listBriefingPublications } from "@/lib/publications";

const WATCH_LIMIT = 25;

export async function getNarrativeWatchFeed(): Promise<PublicPublication[]> {
  return listBriefingPublications(`?section=narrative_watch&limit=${WATCH_LIMIT}`);
}
