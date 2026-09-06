import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { listBriefingPublications } from "@/lib/publications";
import { SECTIONS_BY_HOMEPAGE_SECTION } from "@/lib/publication-routing";
import { isArticleSafeMedia, type EditorialMedia } from "@/server/contracts/editorial-media";
import { isAnalysisBasis } from "@/server/contracts/publication";
import { EditorialShell } from "@/components/site/EditorialShell";
import { HubMasthead } from "@/components/site/HubMasthead";
import { SECTION_LABELS, VERIFICATION_STATES } from "@/components/live/publication-labels";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SkeletonDesk } from "@/components/ui/Skeleton";
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
 * else. The shell renders synchronously now and the read of the public
 * projection is the only thing behind a boundary. Making this function `async`
 * again — for any reason — puts the chrome back behind the fallback.
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
          kicker="The present"
          title={<>News &amp; Analysis</>}
          standfirst="Reporting on Israel and the region, the daily briefing, and the sources behind every line."
          jumps={JUMPS}
        />

        <Suspense fallback={<SkeletonDesk inline label="Loading news and analysis" />}>
          <LiveBriefEdition filters={filters} />
        </Suspense>
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
  const briefingInSidebar = Boolean(lead) && sidebarUpdates.length === 0 && Boolean(briefing);
  const storyCount = updates.length;
  const briefingCount = current.filter((item) => item.section === BRIEFING_SECTION).length;

  return (
    <>
      {/* The edition's facts: what the read found, in the record's own terms. */}
      {!currentUnavailable ? (
        <dl className={styles.editionFacts} aria-label="This edition">
          <div>
            <dt>Last published</dt>
            <dd>
              {current[0] ? (
                <time dateTime={current[0].publishedAt}>{formatDateTime(current[0].publishedAt)}</time>
              ) : "—"}
            </dd>
          </div>
          <div>
            <dt>Stories on file</dt>
            <dd data-numeric="">{storyCount}</dd>
          </div>
          <div>
            <dt>Daily briefings</dt>
            <dd data-numeric="">{briefingCount}</dd>
          </div>
          <div>
            <dt>Times</dt>
            <dd>Jerusalem</dd>
          </div>
        </dl>
      ) : null}

      <section id="latest-news" className={styles.newsOpening} aria-labelledby="latest-news-heading">
        <div className={styles.sectionHeading}>
          <h2 id="latest-news-heading">Latest news</h2>
          <p>Individual stories, newest first</p>
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
              <Metadata item={lead} />
              <Link className={styles.readLink} href={`/articles/${lead.publicId}`}>
                Read the story <span aria-hidden="true">→</span>
              </Link>
            </article>
            {sidebarUpdates.length ? (
              <aside className={styles.newsSidebar} aria-label="More updates">
                <h2>More updates</h2>
                <ol className={styles.newsTimeline}>
                  {sidebarUpdates.map((item, index) => {
                    const media = hubMedia(item);
                    return (
                      <li key={item.publicId} className={media ? styles.timelineWithMedia : undefined}>
                        <span className={styles.timelineIndex} aria-hidden="true">
                          {String(index + 2).padStart(2, "0")}
                        </span>
                        <div>
                          <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt)}</time>
                          <h3><Link href={`/articles/${item.publicId}`}>{item.title}</Link></h3>
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
      {updates.length > 5 ? <PublicationSection title="Earlier updates" items={updates.slice(5, 11)} /> : null}

      <aside className={styles.watchBridge} aria-label="Separate narrative coverage">
        <span className={styles.watchMark} aria-hidden="true">
          <Icon name="search" size={18} strokeWidth={1.5} />
        </span>
        <div>
          <h2>Looking for what is being claimed?</h2>
          <p>Circulating claims, their assessment status and disinformation research live on the dedicated narrative desk, kept separate from the news.</p>
        </div>
        <ButtonLink href="/fake-resistance" variant="secondary" size="md" rightIcon={<span aria-hidden="true">↗︎</span>}>
          Narratives &amp; fact checks
        </ButtonLink>
      </aside>

      <details className={styles.newsArchive} id="news-archive" open={filtering}>
        <summary>
          <span className={styles.archiveTitle}>
            <span>News archive</span>
            <span className={styles.archiveHint}>{filtering ? "Filters active" : "Browse earlier reporting by date, actor, topic or arena"}</span>
          </span>
          <span className={styles.archiveMeta}>
            {archiveUnavailable ? "Unavailable" : `${archive.length} ${archive.length === 1 ? "record" : "records"}`}
            <Icon className={styles.archiveChevron} name="chevron-down" size={14} strokeWidth={1.5} />
          </span>
        </summary>
        <div className={styles.archiveBody}>
          <p>Up to 50 recent records from each news section, daily briefings included. Narrative monitoring is kept separate.</p>
          <BriefFilters key={query.toString()} filters={filters}
            actors={uniqueValues(current, "primaryActor")} topics={uniqueValues(current, "editorialTopic")}
            arenas={uniqueValues(current, "arena")} />
          {archiveUnavailable ? <StatusState status={absenceStatus("unavailable")} title="The archive could not be loaded." description="Please try this selection again later." />
            : archive.length ? <PublicationSection title={filtering ? "Matching reports" : "Recent reporting"} items={archive} />
            : <StatusState status={absenceStatus(filtering ? "no-matches" : "nothing-published")}
                title={filtering ? "No reports match these filters." : "No reports have been published yet."}
                description={filtering ? "Try a broader date or topic selection." : "Published news and briefings will appear here."}
                {...(filtering ? { actionText: "Clear filters", actionHref: "/geopolitical-brief#news-archive" } : {})} />}
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
    <Link className={styles.readLink} href={`/articles/${item.publicId}`}>Read the full briefing <span aria-hidden="true">→</span></Link>
  </div>;
}

type Publication = Awaited<ReturnType<typeof listBriefingPublications>>[number];

function uniqueValues(publications: Publication[], key: "primaryActor" | "editorialTopic" | "arena"): string[] {
  return [...new Set(publications.map((item) => item[key]).filter((value): value is string => Boolean(value)))].sort();
}

function PublicationSection({ title, items, narrative = false }: { title: string; items: Publication[]; narrative?: boolean }) {
  return (
    <section className={styles.liveSection}>
      <div className={styles.liveSectionHead}>
        <h2>{title}</h2>
        <p data-numeric="">{items.length} {items.length === 1 ? "record" : "records"}</p>
      </div>
      <ol className={styles.liveList}>{items.map((item) => {
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
            <Metadata item={item} narrative={narrative} />
            <CardFooter className={styles.liveRowAction}>
              <ButtonLink href={`/articles/${item.publicId}`} variant="text" size="md">
                Read record
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

function Metadata({ item, narrative = false }: { item: Publication; narrative?: boolean }) {
  const values = [item.editorialTopic, item.primaryActor, item.arena]
    .filter((value): value is string => Boolean(value))
    .map(humanize);
  const details = item.narrativeWatchDetails;
  return <>
    {values.length ? (
      <small className={styles.storyMeta}>
        {narrative ? <span className={styles.metaLabel}>Monitored signal</span> : null}
        {values.map((value) => <span key={value} className={styles.metaFacet}>{value}</span>)}
      </small>
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
