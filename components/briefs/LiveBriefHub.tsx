import { ActivationBand } from "@/components/content";
import { SITE_URL } from "@/lib/site-config";
import Image from "next/image";
import Link from "next/link";
import { listBriefingPublications } from "@/lib/publications";
import { SECTIONS_BY_HOMEPAGE_SECTION, publicationCta } from "@/lib/publication-routing";
import { isArticleSafeMedia, type EditorialMedia } from "@/server/contracts/editorial-media";
import { isAnalysisBasis } from "@/server/contracts/publication";
import { EditorialShell } from "@/components/site/EditorialShell";
import { HubMasthead, HubUpdated } from "@/components/site/HubMasthead";
import { SECTION_LABELS, VERIFICATION_STATES } from "@/components/live/publication-labels";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import {
  Card,
  CardCount,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";
import { BriefFilters, type BriefFilterValues } from "./BriefFilters";
import styles from "./live-brief.module.css";

type Filters = BriefFilterValues;

/**
 * Every section this hub owns, taken from the routing table rather than
 * listed by hand.
 *
 * It was `["daily_brief", "israel_update"]`, which left `news` — the section
 * `applyEditorial` assigns when a package names none — routed here by
 * `lib/publication-routing.ts` and rendered by nothing: a record filed as
 * News & Analysis reached its own article page and `/updates` and never
 * appeared on the desk that claims it. Deriving the list means a section
 * added to the `news` band gets a reading surface by construction.
 */
const NEWS_SECTIONS = SECTIONS_BY_HOMEPAGE_SECTION.news;

/** The one section on this desk that is an edition rather than a story. */
const BRIEFING_SECTION = "daily_brief";

/**
 * Trim, collapse runs of whitespace, case-fold. Deliberately nothing cleverer
 * — no stemming, no punctuation stripping, no similarity score. Two strings
 * that differ by a comma are two strings, and this rule is only allowed to act
 * where it is certain.
 */
function normaliseForCollapse(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * VA-12 — the archive's exact-duplicate collapse.
 *
 * The live archive carries records that are the same story filed twice: the
 * West Bank outpost story, repeated Lebanon developments, two identical
 * civil-defence briefings. At equal weight in one list they make the desk read
 * as machine-filled and make "what matters most?" unanswerable.
 *
 * Three properties this must keep, in the order they matter:
 *
 * **It matches on title *and* summary, never on title alone.** Two genuinely
 * distinct stories can share a headline — "Strike in southern Lebanon" is a
 * headline, not an identity — and collapsing on the headline would delete real
 * reporting from the reader's view. The pair has to be identical in both.
 *
 * **It is a projection, not a deletion.** This runs on the archive list only.
 * Nothing is archived, unpublished or hidden: every collapsed record keeps its
 * own URL, its own page, its place in `/updates`, and its row in Search. The
 * current edition above the archive does not go through here at all.
 *
 * **It is the cheap, reversible version — and VA-19 did not replace it.**
 * VA-19 was written expecting the canonical-story model to make this function
 * deletable. It does not, and the reason is structural rather than a matter of
 * degree: `groupByCanonicalStory` groups only on an exact shared
 * `canonicalStoryId` and a null id must always stand alone, while every pair
 * this function collapses carries a **null** id on both sides — a story filed
 * twice as two unrelated records is precisely a story whose two rows were
 * never given the same identity. Measured against Production on 2026-09-07:
 * the one pair collapsed here (`israel-s-open-civil-defence-data-initiative`
 * ×2) has `canonicalStoryId: null` on both records, so canonical grouping
 * covers exactly none of what this covers. The two are complementary
 * projections, not successive ones. Do not delete this, and do not grow it
 * into a similarity engine either.
 *
 * The newest of a duplicate group is the one kept, in that group's earliest
 * position. The archive arrives sorted newest-first, so in practice that is the
 * first occurrence, but the comparison is explicit rather than assumed.
 */
export function collapseExactDuplicates<
  T extends { title: string; summary?: string | null; publishedAt: string },
>(items: readonly T[]): T[] {
  const positions = new Map<string, number>();
  const kept: T[] = [];
  for (const item of items) {
    /* The two halves are joined by a NUL rather than a space because
       whitespace has already been collapsed out of both: with a space,
       title "a b" + summary "c" and title "a" + summary "b c" would key
       the same and collapse two unrelated records into one. */
    const key = `${normaliseForCollapse(item.title)}\u0000${normaliseForCollapse(item.summary)}`;
    const at = positions.get(key);
    if (at === undefined) {
      positions.set(key, kept.length);
      kept.push(item);
      continue;
    }
    if (item.publishedAt.localeCompare(kept[at].publishedAt) > 0) kept[at] = item;
  }
  return kept;
}

/**
 * One developing story, as this desk presents it.
 *
 * `latest` carries the story's current headline; `earlier` holds any further
 * records filed under the same editorial identity, newest first. A record that
 * stands alone is a group of one with an empty `earlier`.
 */
export type StoryGroup<T> = {
  canonicalStoryId: string | null;
  latest: T;
  earlier: T[];
};

type Groupable = { publicId: string; canonicalStoryId?: string | null; publishedAt: string };

/**
 * VA-19 — the archive's editorial identity is the *story*, not the row.
 *
 * Grouping is on an **exact shared `canonicalStoryId` and nothing else**.
 * There is no title similarity, no fuzzy match, no second identifier: a record
 * whose id is null or empty is always its own group, and two null-id records
 * are never grouped with each other. That null case is the one that would
 * quietly merge unrelated reporting if it were keyed like any other value, so
 * it is keyed by `publicId` instead — unique by construction — and it is
 * pinned by test.
 *
 * **What this does and does not do against the current schema.**
 * `publication_canonical_story_once` in `server/db/schema/publications.ts` is a
 * partial UNIQUE index on `canonical_story_id`, so at most one live row may
 * carry a given id: `publications/service.ts` refuses a create against an
 * existing canonical story with a CONFLICT telling the caller to send an
 * update instead. A developing story in this system is therefore **one row,
 * updated in place** — the chronology lives in `entity_version` and reaches
 * the reader as `corrections` on the article detail projection. Measured
 * against Production on 2026-09-07: 31 live news records, 6 carrying a
 * canonical id, all 6 distinct, largest group 1.
 *
 * So every group this returns is a group of one *today*, and that is the
 * schema working, not this function failing. It is written to group anyway for
 * two reasons: the archive card is now drawn from a story rather than from a
 * row, which is the identity the desk should have had all along; and if the
 * unique index is ever relaxed so that an update becomes a sibling row, the
 * presentation is already correct instead of quietly listing the same story
 * several times. Grouping is presentation only — every record keeps its own
 * `publicId` URL, its place in `/updates` and its row in Search.
 *
 * Group order follows first appearance, so a newest-first list stays
 * newest-first. Inside a group, records are ordered newest-first by
 * `publishedAt` and `latest` is the newest.
 */
export function groupByCanonicalStory<T extends Groupable>(items: readonly T[]): StoryGroup<T>[] {
  const groups: { key: string; canonicalStoryId: string | null; members: T[] }[] = [];
  const index = new Map<string, number>();
  for (const item of items) {
    const canonical = item.canonicalStoryId?.trim() ? item.canonicalStoryId.trim() : null;
    /* A null id is not a shared identity. Keying it on the record's own
       `publicId` makes "stands alone" the mechanical outcome rather than a
       branch someone can forget, and the `story:` / `alone:` prefixes stop a
       canonical id that happens to read like a publicId colliding with one. */
    const key = canonical ? `story:${canonical}` : `alone:${item.publicId}`;
    const at = index.get(key);
    if (at === undefined) {
      index.set(key, groups.length);
      groups.push({ key, canonicalStoryId: canonical, members: [item] });
      continue;
    }
    groups[at].members.push(item);
  }
  return groups.map(({ canonicalStoryId, members }) => {
    const ordered = [...members].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return { canonicalStoryId, latest: ordered[0], earlier: ordered.slice(1) };
  });
}

/**
 * Whether this record has been revised since it was published.
 *
 * A strict `>` is safe: `recordVersion` writes `updated_at` a fraction of a
 * second *before* `published_at` on the create path, so every unrevised record
 * on Production reads between −1.6s and −0.1s, while every genuine revision
 * reads hours to days positive. No tolerance is applied because inventing one
 * would put a threshold between those two clusters that the data does not ask
 * for.
 *
 * What changed is not on the list projection — the full chronology is
 * `corrections` on the article detail, built from `entity_version` — so the
 * desk states the fact and the time and sends the reader to the record.
 */
export function hasPublishedUpdate(item: { publishedAt: string; updatedAt: string }): boolean {
  /* Parsed rather than string-compared: the ordering of the list is allowed to
     assume both timestamps are serialized identically, but a claim printed on
     the card is not. An unparseable value reads as "not revised". */
  const published = Date.parse(item.publishedAt);
  const updated = Date.parse(item.updatedAt);
  return Number.isFinite(published) && Number.isFinite(updated) && updated > published;
}

/**
 * Why the archive is empty — three causes, not one.
 *
 * Excluding what the edition already showed created a third: the desk holds
 * reporting, none of it is missing, and there is simply nothing *further* to
 * list. Filing that under `nothing-published` would tell a reader looking at
 * eleven stories that nothing has been published, so it is named
 * `empty-record` — the read succeeded and this list genuinely holds nothing —
 * and only a desk with no live records at all still reads as
 * `nothing-published`. The `unavailable` cause is handled before this is
 * reached and is never one of these.
 */
export function emptyArchiveState(filtering: boolean, liveRecordCount: number): {
  status: ReturnType<typeof absenceStatus>;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
} {
  if (filtering) {
    return {
      status: absenceStatus("no-matches"),
      title: "No reports match these filters.",
      description: "Try a broader date or topic selection.",
      actionText: "Clear filters",
      actionHref: "/geopolitical-brief#news-archive",
    };
  }
  if (liveRecordCount > 0) {
    return {
      status: absenceStatus("empty-record"),
      title: "No further reports to show.",
      description: "Everything published on this desk is already shown above.",
    };
  }
  return {
    status: absenceStatus("nothing-published"),
    title: "No reports have been published yet.",
    description: "Published news and briefings will appear here.",
  };
}

const JUMPS = [
  { href: "#latest-news", label: "Latest news" },
  { href: "#daily-brief", label: "The daily briefing" },
  { href: "#news-archive", label: "News archive" },
  { href: "/updates", label: "Every publication ↗︎" },
];

/**
 * The desk shell — masthead, skip link, footer, kicker, h1, standfirst.
 *
 * Deliberately **not** async. This route used to carry a segment-root
 * `app/geopolitical-brief/loading.tsx`, and because the site mounts its header,
 * nav and footer here inside the page rather than in `app/layout.tsx`, that
 * file put the entire chrome behind a Suspense boundary only client JavaScript
 * could resolve: with scripting off the route rendered its title and nothing
 * else. The shell renders synchronously and nothing on this route sits behind
 * a boundary. Making this function `async` — for any reason — is harmless
 * today but would put the chrome back behind a fallback the moment a
 * `loading.tsx` or an outer boundary is reintroduced, so it stays synchronous.
 *
 * VA-42 — why `LiveBriefEdition` is no longer wrapped in a Suspense boundary.
 *
 * It was. The chrome came out of that boundary; the records never did, and the
 * measured result on Production was a reader with scripting off seeing 2,871
 * characters of navigation and **zero** article links: React streams a
 * boundary's contents into `<div hidden id="S:…">` and only client script
 * moves them into the document.
 *
 * Three fixes were weighed. Two do not work:
 *
 * - **Keep Suspense, add a real `<noscript>` list.** A `<noscript>` *inside*
 *   the boundary is streamed into the same hidden div as everything else, so
 *   it is exactly as invisible as the records. A `<noscript>` *outside* the
 *   boundary has to have the records in hand, which means awaiting the read
 *   before the shell flushes — i.e. this fix, plus a second copy of every
 *   record in the payload.
 * - **Split: lead and timeline outside, the filterable archive inside.** It
 *   reads well and is degenerate here. `archive` *is* `current` whenever no
 *   filter is set (see the read below) — there is no second query to stream,
 *   so the split buys no TTFB back in the common case. Worse, `BriefFilters`
 *   is a GET form that `@media (scripting: none)` deliberately keeps usable
 *   without JavaScript; putting the filtered archive behind a boundary would
 *   answer a no-JS reader's filter submission with a hidden div.
 *
 * So the boundary is gone and the route serves complete HTML. What that costs
 * is real and bounded: TTFB now includes one public-projection read. That read
 * is cached three deep — `publicReadCache` (5 min, in-process),
 * `unstable_cache` (300s, tag-invalidated) and `withLastGoodRead` (24h
 * fallback) — and the reads are `Promise.allSettled`, so a failure renders the
 * `unavailable` state rather than hanging. No deadline is imposed on top: a
 * slow-but-successful read would then be reported as "News could not be
 * loaded", which is a lie, and a worse answer than the skeleton it replaced.
 *
 * `StatusState`'s three-way distinction — loading / empty / unavailable — is
 * unchanged and load-bearing: "nothing is published" and "the service is
 * down" stay different sentences, now on the no-JS path too.
 */
export function LiveBriefHub({ filters = {} }: { filters?: Filters }) {
  return (
    <EditorialShell
      routeId="geopolitical-brief"
      className={styles.page}
      showProgress={false}
      register="silent"
    >
      <div className={styles.liveLayout}>
        <HubMasthead
          kicker="What is happening"
          title={<>News &amp; Analysis</>}
          standfirst="What happened today in Israel and the region — every line with its source, so you can check it before you repeat it."
          jumps={JUMPS}
        />

        <LiveBriefEdition filters={filters} />
        <ActivationBand
          share={{ url: `${SITE_URL}/geopolitical-brief`, text: "News & Analysis — what happened, with the sources behind every line." }}
        />
      </div>
    </EditorialShell>
  );
}

/** Archive filters never replace the current news edition. */
export async function LiveBriefEdition({ filters }: { filters: Filters }) {
  const filtering = Object.values(filters).some(Boolean);
  const query = new URLSearchParams({ limit: "100" });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  let current: Publication[] = [];
  let archive: Publication[] = [];
  let currentUnavailable = false;
  let archiveUnavailable = false;
  const readNews = async (selection: URLSearchParams) => {
    const batches = await Promise.all(NEWS_SECTIONS.map((section) => {
      const params = new URLSearchParams(selection);
      params.set("section", section);
      params.set("limit", "50");
      return listBriefingPublications(params.toString());
    }));
    return batches.flat();
  };
  const reads = await Promise.allSettled([
    readNews(new URLSearchParams()),
    filtering ? readNews(query) : Promise.resolve(null),
  ]);
  const newsOnly = (items: Publication[]) => items
    .filter((item) => (NEWS_SECTIONS as readonly string[]).includes(item.section))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (reads[0].status === "fulfilled") current = newsOnly(reads[0].value);
  else currentUnavailable = true;
  if (reads[1].status === "fulfilled") archive = reads[1].value === null ? current : newsOnly(reads[1].value);
  else archiveUnavailable = true;
  if (!filtering && currentUnavailable) archiveUnavailable = true;

  const briefing = current.find((item) => item.section === BRIEFING_SECTION);
  /* Every story section on this desk, the daily edition excepted — it has its
     own strip below and must not compete as one story among many. */
  const updates = current.filter((item) => item.section !== BRIEFING_SECTION);
  const lead = updates[0];
  const sidebarUpdates = updates.slice(1, 5);
  const earlierUpdates = updates.slice(5, 11);
  const briefingInSidebar = Boolean(lead) && sidebarUpdates.length === 0 && Boolean(briefing);
  const storyCount = updates.length;

  /* The archive's own projection, and nothing else's — see
     `collapseExactDuplicates`. `archive` is the same array as `current` when
     no filter is set, so none of this may be done in place.

     VA-04 measured the real defect this ordering fixes: one record occupying
     three places on one page. `netanyahu-orders-unauthorized-west-bank-
     outposts-kb1l1` was the lead (headline link plus "Read the story") *and* a
     row in the archive below; every timeline entry and every "Earlier updates"
     row was in the archive too. A reader scrolling one page met the same
     reporting two and three times and had no way to tell whether that was two
     decisions or one.

     Unfiltered, the archive is now the remainder: what the edition above has
     not already presented. Filtered, it is the complete answer to a query and
     must not hide a match merely because that record also leads the page —
     a filter on the lead's actor returning nothing would be a bug, not tidiness.

     The collapse runs *before* the exclusion, deliberately. Collapsing keeps
     the newest of an exact-duplicate group and the list arrives newest-first,
     so the survivor of a group containing the lead is the lead — excluding by
     `publicId` afterwards then removes the whole group. The other order would
     drop the lead and leave its twin in the archive, presenting the same story
     twice under two addresses. */
  const shownAbove = new Set<string>(
    [lead, ...sidebarUpdates, ...earlierUpdates, briefing]
      .filter((item): item is Publication => Boolean(item))
      .map((item) => item.publicId),
  );
  const archiveRecords = collapseExactDuplicates(archive);
  const archiveStories = groupByCanonicalStory(
    filtering ? archiveRecords : archiveRecords.filter((item) => !shownAbove.has(item.publicId)),
  );

  return (
    <>
      {/* UX-15 — when the desk last changed, as one sentence rather than a rail
          of "LAST PUBLISHED · STORIES ON FILE 23 · DAILY BRIEFINGS 8 · TIMES
          Jerusalem". It renders here and not in the masthead because the shell
          above is deliberately synchronous and cannot know the read's result.
          The story count moved into the section head it describes. */}
      {!currentUnavailable && current[0] ? (
        <p className={styles.editionStatus}><HubUpdated at={current[0].publishedAt} /></p>
      ) : null}

      <section id="latest-news" className={styles.newsOpening} aria-labelledby="latest-news-heading">
        <div className={styles.sectionHeading}>
          <h2 id="latest-news-heading">Latest news</h2>
          {!currentUnavailable && storyCount ? (
            <p><span data-numeric="">{storyCount}</span> {storyCount === 1 ? "story" : "stories"}, newest first</p>
          ) : null}
        </div>
        {currentUnavailable ? (
          <StatusState status={absenceStatus("unavailable")} title="News could not be loaded."
            description="The publication service is unavailable. This is not an empty news feed."
            actionText="Try again" actionHref="/geopolitical-brief" />
        ) : lead ? (
          <div className={styles.newsFront} data-sidebar={sidebarUpdates.length || briefing ? "" : undefined}>
            <article className={styles.newsLead}>
              <p className={styles.liveEyebrow}>
                <span className={styles.leadFlag}>Latest story</span>
                <time dateTime={lead.publishedAt}>{formatDateTime(lead.publishedAt)}</time>
              </p>
              <LeadMedia media={hubMedia(lead)} />
              <h3><Link href={`/articles/${lead.publicId}`}>{lead.title}</Link></h3>
              {lead.summary ? <p className={styles.newsSummary}>{lead.summary}</p> : null}
              <UpdatedMarker item={lead} />
              <Metadata item={lead} />
              <Link className={styles.readLink} href={`/articles/${lead.publicId}`}>
                {publicationCta(lead.section)} <span aria-hidden="true">→</span>
              </Link>
            </article>
            {sidebarUpdates.length ? (
              <aside className={styles.newsSidebar} aria-label="More updates">
                <h2>More updates</h2>
                <ol className={styles.newsTimeline}>
                  {sidebarUpdates.map((item) => {
                    const media = hubMedia(item);
                    return (
                      <li key={item.publicId} className={media ? styles.timelineWithMedia : undefined}>
                        <div>
                          <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt)}</time>
                          <h3><Link href={`/articles/${item.publicId}`}>{item.title}</Link></h3>
                          <UpdatedMarker item={item} />
                        </div>
                        {media ? <Thumbnail media={media} className={styles.timelineThumb} sizes="72px" /> : null}
                      </li>
                    );
                  })}
                </ol>
              </aside>
            ) : briefing ? (
              <aside className={styles.newsSidebar}><Briefing item={briefing} /></aside>
            ) : null}
          </div>
        ) : (
          <StatusState
            status={absenceStatus("nothing-published")}
            title="No individual news updates have been published yet."
            description="Published daily briefings appear below as they arrive."
          />
        )}
      </section>

      {!briefingInSidebar && briefing ? (
        <section className={styles.briefingStrip} aria-labelledby="daily-brief-heading">
          <Briefing item={briefing} headingId="daily-brief-heading" />
        </section>
      ) : null}
      {earlierUpdates.length ? (
        <PublicationSection title="Earlier updates" stories={groupByCanonicalStory(earlierUpdates)} />
      ) : null}

      <aside className={styles.watchBridge} aria-label="Separate narrative coverage">
        <span className={styles.watchMark} aria-hidden="true">
          <Icon name="search" size={18} strokeWidth={1.5} />
        </span>
        <div>
          <h2>Looking for what is being claimed?</h2>
          <p>Circulating claims, their assessment status and disinformation research live on the dedicated narrative desk, kept separate from the news.</p>
        </div>
        <ButtonLink href="/fake-resistance" variant="secondary" size="md" rightIcon={<span aria-hidden="true">↗︎</span>}>
          Fake Resistance
        </ButtonLink>
      </aside>

      <details className={styles.newsArchive} id="news-archive" open={filtering}>
        <summary>
          <span className={styles.archiveTitle}>
            <span>News archive</span>
            <span className={styles.archiveHint}>{filtering ? "Filters active" : "Browse earlier reporting by date, actor, topic or arena"}</span>
          </span>
          <span className={styles.archiveMeta}>
            {archiveUnavailable ? "Unavailable" : `${archiveStories.length} ${archiveStories.length === 1 ? "story" : "stories"}`}
            <Icon className={styles.archiveChevron} name="chevron-down" size={14} strokeWidth={1.5} />
          </span>
        </summary>
        <div className={styles.archiveBody}>
          {/* The last two sentences are a disclosure, not a flourish: the count
              above is the count after the collapse and after the exclusion, and
              a reader comparing it against `/updates` is entitled to know why
              the two differ. */}
          <p>
            Up to 50 recent records from each news section, daily briefings included. Narrative monitoring is kept separate.
            {filtering
              ? " Every matching record is listed here, including any also shown above."
              : " Reporting already presented above is not repeated here."}
            {" "}Records that repeat an earlier headline and summary word for word are listed once, and updates to a developing story are listed under that story; each remains at its own address and in search.
          </p>
          <BriefFilters key={query.toString()} filters={filters}
            actors={uniqueValues(current, "primaryActor")} topics={uniqueValues(current, "editorialTopic")}
            arenas={uniqueValues(current, "arena")} />
          {archiveUnavailable ? <StatusState status={absenceStatus("unavailable")} title="The archive could not be loaded." description="Please try this selection again later." />
            : archiveStories.length ? <PublicationSection title={filtering ? "Matching reports" : "Recent reporting"} stories={archiveStories} />
            : <StatusState {...emptyArchiveState(filtering, current.length)} />}
        </div>
      </details>
    </>
  );
}

/**
 * What a manufactured picture is not, said before the caption is read.
 *
 * Deliberately a local copy of the homepage's table rather than an import:
 * `HomeMedia` belongs to the homepage journey and carries its layout with it.
 * The two agree on the wording because the wording is a disclosure, not a
 * style — if one changes, the other is wrong.
 */
const ROLE_DISCLOSURE: Partial<Record<EditorialMedia["role"], string>> = {
  "editorial-illustration": "Editorial illustration — not evidence",
  "safe-cover": "Safe cover — not the original material",
};

/**
 * The picture a record carries, or nothing.
 *
 * The public projection already filters on clearance; this checks again rather
 * than assuming, because a listing that trusts its input is the surface an
 * uncleared image reaches first. Nothing is substituted when a record has no
 * image: a placeholder in a news list reads as a missing photograph, and most
 * records here have none.
 */
function hubMedia(item: Publication): EditorialMedia | null {
  return item.media && isArticleSafeMedia(item.media) ? item.media : null;
}

/**
 * The lead story's picture — the one image on this page that carries its own
 * credit line. Every other row is a listing entry, where a credit under each
 * thumbnail would out-weigh the headlines it sits between; those carry their
 * attribution in the alt text and in full on the record's own page.
 */
function LeadMedia({ media }: { media: EditorialMedia | null }) {
  if (!media) return null;
  const disclosure = media.role === "safe-cover" ? "Safe cover" : media.disclosure ?? ROLE_DISCLOSURE[media.role];
  return (
    <figure className={styles.leadMedia}>
      <Image
        src={media.src}
        alt={media.alt}
        width={media.width}
        height={media.height}
        loading="eager"
        sizes="(max-width: 44.99rem) 100vw, (max-width: 68.75rem) 55vw, 60vw"
        style={{ objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%` }}
      />
      <figcaption>
        {disclosure ? <span className={styles.mediaDisclosure}>{disclosure}</span> : null}
        {media.caption ? <span className={styles.mediaCaption}>{media.caption}</span> : null}
        <span className={styles.mediaCredit}>{media.credit}</span>
      </figcaption>
    </figure>
  );
}

/** A listing thumbnail. Alt text only — see `LeadMedia` for why. */
function Thumbnail({ media, className, sizes }: { media: EditorialMedia; className: string; sizes: string }) {
  return (
    <Image
      className={className}
      src={media.src}
      alt={media.alt}
      width={media.width}
      height={media.height}
      loading="lazy"
      sizes={sizes}
      style={{ objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%` }}
    />
  );
}

function Briefing({ item, headingId }: { item: Publication; headingId?: string }) {
  return <div id="daily-brief" className={styles.briefingContent}>
    <p className={styles.liveEyebrow}>
      <span className={styles.briefingFlag}>The daily briefing</span>
      <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
    </p>
    <h2 id={headingId}><Link href={`/articles/${item.publicId}`}>{item.title}</Link></h2>
    {item.summary ? <p className={styles.newsSummary}>{item.summary}</p> : null}
    <UpdatedMarker item={item} />
    <Link className={styles.readLink} href={`/articles/${item.publicId}`}>Read the briefing <span aria-hidden="true">→</span></Link>
  </div>;
}

type Publication = Awaited<ReturnType<typeof listBriefingPublications>>[number];

function uniqueValues(publications: Publication[], key: "primaryActor" | "editorialTopic" | "arena"): string[] {
  return [...new Set(publications.map((item) => item[key]).filter((value): value is string => Boolean(value)))].sort();
}

/**
 * A listing of stories. One card per editorial identity, never one per row.
 *
 * The count says "stories" rather than "records" because that is what a card
 * now is: the archive answers "how many things happened", and a developing
 * story that was revised four times is one of them.
 */
function PublicationSection({ title, stories, narrative = false }: { title: string; stories: StoryGroup<Publication>[]; narrative?: boolean }) {
  return (
    <section className={styles.liveSection}>
      <div className={styles.liveSectionHead}>
        <h2>{title}</h2>
        <p data-numeric="">{stories.length} {stories.length === 1 ? "story" : "stories"}</p>
      </div>
      <ol className={styles.liveList}>{stories.map((story) => {
        const item = story.latest;
        const media = hubMedia(item);
        return (
        <li key={item.publicId}>
          {/* Nested Read-record control: the row is a surface, not a link. */}
          <Card variant="row" as="article" className={media ? `${styles.liveRow} ${styles.liveRowMedia}` : styles.liveRow}>
            <CardHeader className={styles.liveRowHeader}>
              <CardEyebrow>
                {rowStatus(item, narrative)}
                {item.editorialTopic ? ` · ${humanize(item.editorialTopic)}` : ""}
              </CardEyebrow>
              <CardCount>
                <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
              </CardCount>
            </CardHeader>
            <Headline title={item.title} narrative={narrative} />
            {item.summary ? (
              <CardDescription className={styles.liveRowSummary}>{item.summary}</CardDescription>
            ) : null}
            <UpdatedMarker item={item} />
            <Metadata item={item} narrative={narrative} />
            <UpdateLog earlier={story.earlier} />
            <CardFooter className={styles.liveRowAction}>
              <ButtonLink href={`/articles/${item.publicId}`} variant="text" size="md">
                {publicationCta(item.section)}
              </ButtonLink>
            </CardFooter>
            {media ? <Thumbnail media={media} className={styles.rowThumb} sizes="112px" /> : null}
          </Card>
        </li>
        );
      })}</ol>
    </section>
  );
}

/**
 * That this record has been revised since publication, and when.
 *
 * The chronology itself — which version changed what — is `corrections` on the
 * article detail projection, so the desk states the fact and sends the reader
 * to the record rather than paraphrasing a change log it cannot see. Rendered
 * as a `<time>` so the machine-readable instant travels with the sentence.
 */
function UpdatedMarker({ item }: { item: Publication }) {
  if (!hasPublishedUpdate(item)) return null;
  return (
    <p className={styles.storyUpdated}>
      <span className={styles.storyUpdatedFlag}>Updated</span>
      <time dateTime={item.updatedAt}>{formatDateTime(item.updatedAt)}</time>
    </p>
  );
}

/**
 * The earlier records filed under one story, beneath its current headline.
 *
 * Empty against the current schema — `publication_canonical_story_once` makes a
 * canonical id unique, so a developing story is one row updated in place and
 * `earlier` is always empty. See `groupByCanonicalStory` for why the branch is
 * here anyway. It renders every earlier update as its own link, because
 * grouping is presentation: nothing here is removed from `/updates`, from
 * Search, or from its own address.
 */
function UpdateLog({ earlier }: { earlier: Publication[] }) {
  if (!earlier.length) return null;
  return (
    <div className={styles.updateLog}>
      <h4>Earlier in this story</h4>
      <ol>
        {earlier.map((item) => (
          <li key={item.publicId}>
            <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
            <Link href={`/articles/${item.publicId}`}>{item.title}</Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Splits the public headline prefix `narrativeWatchTitle()` wrote — "Reported
 * claim: " or "Analysis: " — off the title so it renders as a kicker above the
 * headline rather than as the headline's first two words. Display-side only:
 * this reads what the contract wrote and never writes a prefix, so
 * `server/contracts/publication.ts` stays the single prefixer. A title with
 * neither prefix renders unchanged.
 */
function Headline({ title, narrative }: { title: string; narrative: boolean }) {
  const match = narrative ? /^(Reported claim|Analysis):\s*/.exec(title) : null;
  if (!match) return <CardTitle>{title}</CardTitle>;
  return (
    <>
      <CardEyebrow className={styles.claimKicker}>{match[1]}</CardEyebrow>
      <CardTitle>{title.slice(match[0].length)}</CardTitle>
    </>
  );
}

function rowStatus(item: Publication, narrative: boolean): string {
  const details = item.narrativeWatchDetails;
  if (narrative && details) return VERIFICATION_STATES[details.verificationState].label;
  return SECTION_LABELS[item.section];
}

/** A machine facet — `international_arms_sales` — as words. */
function humanize(value: string): string {
  return value.replaceAll("_", " ").replaceAll(",", ", ");
}

/**
 * Topic, actor and arena as one plain kicker line — "West Bank settler
 * outposts · Benjamin Netanyahu · West Bank".
 *
 * UX-17: they were three bordered, title-cased chips ("Yemen And Red Sea"),
 * which tripled the height of every update entry on a phone and were not
 * links. The values arrive in sentence case from the record and are printed
 * as they are; the separator is the only thing added.
 */
function Metadata({ item, narrative = false }: { item: Publication; narrative?: boolean }) {
  const values = [item.editorialTopic, item.primaryActor, item.arena]
    .filter((value): value is string => Boolean(value))
    .map(humanize);
  const details = item.narrativeWatchDetails;
  return <>
    {values.length ? (
      <p className={styles.storyMeta}>
        {narrative ? <span className={styles.metaLabel}>Monitored signal</span> : null}
        <span className={styles.metaFacets}>{values.join(" · ")}</span>
      </p>
    ) : null}
    {narrative && details ? (
      <dl className={styles.claimRecord}>
        <dt>Claim</dt>
        <dd>{details.exactClaim}</dd>
        <dt>Trend</dt>
        <dd data-value="">{details.trendDirection}</dd>
        <dt>Status</dt>
        <dd data-value="">{details.verificationState}</dd>
        {isAnalysisBasis(details) ? (
          <>
            <dt>Basis</dt>
            <dd>Organisation analysis, no source cited</dd>
          </>
        ) : null}
      </dl>
    ) : null}
  </>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Jerusalem" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(value));
}
