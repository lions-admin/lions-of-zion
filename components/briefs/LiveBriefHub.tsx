import { Suspense } from "react";
import Link from "next/link";
import { listBriefingPublications } from "@/lib/publications";
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
    const batches = await Promise.all(["daily_brief", "israel_update"].map((section) => {
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
    .filter((item) => item.section === "daily_brief" || item.section === "israel_update")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (reads[0].status === "fulfilled") current = newsOnly(reads[0].value);
  else currentUnavailable = true;
  if (reads[1].status === "fulfilled") archive = reads[1].value === null ? current : newsOnly(reads[1].value);
  else archiveUnavailable = true;
  if (!filtering && currentUnavailable) archiveUnavailable = true;

  const briefing = current.find((item) => item.section === "daily_brief");
  const updates = current.filter((item) => item.section === "israel_update");
  const lead = updates[0];
  const sidebarUpdates = updates.slice(1, 5);
  const briefingInSidebar = Boolean(lead) && sidebarUpdates.length === 0 && Boolean(briefing);
  const storyCount = updates.length;
  const briefingCount = current.filter((item) => item.section === "daily_brief").length;

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
                  {sidebarUpdates.map((item, index) => (
                    <li key={item.publicId}>
                      <span className={styles.timelineIndex} aria-hidden="true">
                        {String(index + 2).padStart(2, "0")}
                      </span>
                      <div>
                        <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt)}</time>
                        <h3><Link href={`/articles/${item.publicId}`}>{item.title}</Link></h3>
                      </div>
                    </li>
                  ))}
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
          <p>Up to 50 recent news updates and 50 daily briefings. Narrative monitoring is kept separate.</p>
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
      <ol className={styles.liveList}>{items.map((item) => (
        <li key={item.publicId}>
          {/* Nested Read-record control: the row is a surface, not a link. */}
          <Card variant="row" as="article" className={styles.liveRow}>
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
          </Card>
        </li>
      ))}</ol>
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
