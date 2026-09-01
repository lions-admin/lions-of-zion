/**
 * The home page's front-page band — the seam that decides what the home
 * route may truthfully claim.
 *
 * Same convention as the other modules here: local and static today, async
 * so the eventual swap to a real published-content query is a change to
 * these bodies rather than to any call site.
 *
 * The reason this file exists rather than the band reading the editions
 * directly is that the honest answer to "what is newest?" is not obvious,
 * and getting it wrong would put a false freshness claim on the front page:
 *
 *   - **There is no newest edition.** Every edition under `lib/content/`
 *     carries the same `publishedAt` ("Aug 25, 2026"), because they were
 *     authored in one pass. Ranking sections by publication date would be
 *     ranking noise.
 *   - **The only real recency signal is the newest dated entry** — the date
 *     of the most recent documented milestone. That is what this module
 *     surfaces, and why the band's label says "documented milestone" and
 *     never "update" or "latest news".
 *   - **There is no review date.** `reviewedBy` is a role ("Editorial
 *     desk"), not a timestamp. Nothing here may render a "last reviewed"
 *     date, because none exists.
 *
 * See `.ai/DECISIONS.md`, "Marathon content is real and sourced, or labeled
 * a reference", for the standing rule this implements.
 *
 * **The exports here are synchronous.** The home route must render without
 * JavaScript — `CLAUDE.md`: "Without JavaScript the static navigation remains
 * usable immediately." This was originally forced: any `await` in that route's
 * render path put it behind the Suspense boundary `app/loading.tsx` created,
 * and with no JavaScript the fallback was never replaced — measured, the whole
 * page was the loading shell, with the real markup parked in a hidden div and
 * zero reachable links, in the production build as well as in dev.
 *
 * That file is deleted now (`.ai/DECISIONS.md`, 2026-08-26), so the constraint
 * no longer binds. These exports stay synchronous because nothing needs them to
 * change; anyone introducing an `await` should re-measure the no-JavaScript
 * render rather than assume it is free. Note that a top-level `await` here
 * would not have solved it either — that makes the importing module async,
 * which suspended the route just the same. So this module reads
 * the editions' synchronous exports. `getWarUpdateEdition()` and
 * `getOctober7Record()` stay async and stay the seam a real query will land
 * on; if that day comes, the answer is to prerender this slice, not to make
 * the route suspend.
 *
 * Worth knowing while you are here: `/war-update` and `/we-are` have the same
 * defect today for the same reason, and are not fixed by this change.
 */
import type { TimelineEntry } from '@/components/content';
import { briefDevelopmentEntries } from '@/components/briefs/adapters';
import { october7Record } from './october-7';
import { warUpdateEdition } from './war-update';

/**
 * Known duplicate documentation is named explicitly rather than deduplicated
 * by a generic same-day or same-topic heuristic.
 */
const DUPLICATE_ENTRY_IDS: readonly { keep: string; drop: string }[] = [];

export type HomeMilestone = TimelineEntry & {
  /** Which file this milestone was documented in. */
  section: { label: string; href: string };
};

function withSection(
  entries: TimelineEntry[],
  label: string,
  href: string,
): HomeMilestone[] {
  return entries.map((entry) => ({ ...entry, section: { label, href } }));
}

/**
 * Every dated milestone the site has documented, newest first.
 *
 * Our Heroes is deliberately absent: `HeroProfile` carries no date, so it
 * cannot join a dated list. Israel's Story is absent for a different reason
 * — its entries are historical (newest: 2020), so merging them in would push
 * nothing to the top and only lengthen the tail.
 */
export function getAllMilestones(): HomeMilestone[] {
  const merged = [
    ...withSection(warUpdateEdition.entries, 'War Update', '/war-update'),
    ...withSection(october7Record.timeline, 'October 7', '/october-7'),
    ...withSection(briefDevelopmentEntries(), 'Geopolitical Brief', '/geopolitical-brief'),
  ];

  assertKnownDuplicates(merged);

  const dropped = new Set(DUPLICATE_ENTRY_IDS.map((pair) => pair.drop));
  return merged
    .filter((entry) => !dropped.has(entry.id))
    .sort((a, b) => b.datetime.localeCompare(a.datetime));
}

/**
 * The newest documented milestone — the one real freshness signal the home
 * page has, and the only thing its anchored strip is allowed to assert.
 *
 * The same max-by-date reduce `app/war-update/page.tsx` uses for its
 * `dateModified`, widened across sections.
 */
export function getLatestMilestone(): HomeMilestone | null {
  return getAllMilestones()[0] ?? null;
}

/** The newest `limit` milestones, for the band's recent-record list. */
export function getRecentMilestones(limit: number): HomeMilestone[] {
  return getAllMilestones().slice(0, limit);
}

/** War Update's authored trust sentence — what this desk does and doesn't do. */
export function getTrustStrip(): string {
  return warUpdateEdition.trustStrip;
}

/**
 * Both halves of a named duplicate must still be present. If an id is
 * renamed or an entry deleted, the pair is stale — either the drop no longer
 * does anything (and a duplicate returns to the page), or it is silently
 * removing an entry that no longer has a twin.
 */
function assertKnownDuplicates(entries: readonly TimelineEntry[]): void {
  const ids = new Set(entries.map((entry) => entry.id));
  for (const { keep, drop } of DUPLICATE_ENTRY_IDS) {
    if (!ids.has(keep) || !ids.has(drop)) {
      throw new Error(
        `lib/content/home.ts: the duplicate pair "${keep}"/"${drop}" no longer matches the ` +
          `content. Re-check whether the two entries still describe the same event and update ` +
          `DUPLICATE_ENTRY_IDS.`,
      );
    }
  }
}
