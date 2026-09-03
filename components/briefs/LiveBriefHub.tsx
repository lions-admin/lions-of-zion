import Link from "next/link";
import { listBriefingPublications } from "@/lib/publications";
import { isAnalysisBasis } from "@/server/contracts/publication";
import { EditorialShell } from "@/components/site/EditorialShell";
import { SECTION_LABELS, VERIFICATION_STATES } from "@/components/live/publication-labels";
import { ButtonLink } from "@/components/ui/Button";
import {
  Card,
  CardCount,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
  StatusState,
} from "@/components/ui";
import sectionStyles from "@/components/sections/sections.module.css";
import { BriefFilters, type BriefFilterValues } from "./BriefFilters";
import styles from "./live-brief.module.css";

type Filters = BriefFilterValues;

export async function LiveBriefHub({ filters = {} }: { filters?: Filters }) {
  const query = new URLSearchParams({ limit: "100" });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  let publications: Publication[] = [];
  let allPublications: Publication[] | null = null;
  let dataUnavailable = false;
  try {
    [publications, allPublications] = await Promise.all([
      listBriefingPublications(query.toString()),
      Object.values(filters).some(Boolean) ? listBriefingPublications("limit=100") : Promise.resolve(null),
    ]);
  } catch (cause) {
    dataUnavailable = true;
    console.error("[briefing] public projection unavailable", cause instanceof Error ? cause.message : cause);
  }
  const filterSource = allPublications ?? publications;
  const dailyBriefs = publications.filter((entry) => entry.section === "daily_brief");
  const lead = dailyBriefs[0] ?? null;
  const featuredIsrael = lead
    ? publications.find((entry) => entry.featuredIsraelStory && israelDate(entry.publishedAt) === israelDate(lead.publishedAt)) ?? null
    : null;
  const updates = publications.filter((entry) => entry.section === "israel_update" || entry.section === "war_update");
  const narratives = publications.filter((entry) => entry.section === "narrative_watch");

  return (
    <EditorialShell
      routeId="geopolitical-brief"
      className={styles.page}
      skipLinkClassName={sectionStyles.skipLink}
      progressTrackClassName={sectionStyles.topProgressTrack}
      progressValueClassName={sectionStyles.topProgressValue}
      showProgress={false}
    >
      <div className={styles.liveLayout}>
        <header className={styles.deskHeader}>
          <p className={styles.liveEyebrow}>
            <span className={styles.deskMark}>Lions of Zion</span>
            <span>Intelligence desk</span>
          </p>
          <h1>The Daily Brief</h1>
          <p>Source-linked reporting on Israel, the war, and the narratives shaping international attention.</p>
        </header>

        <BriefFilters
          key={`${filters.date ?? ""}|${filters.actor ?? ""}|${filters.topicLabel ?? ""}|${filters.arena ?? ""}`}
          filters={filters}
          actors={uniqueValues(filterSource, "primaryActor")}
          topics={uniqueValues(filterSource, "editorialTopic")}
          arenas={uniqueValues(filterSource, "arena")}
        />

        {dataUnavailable ? (
          <StatusState
            eyebrow="SERVICE STATUS"
            title="The Daily Brief is temporarily unavailable."
            description="Published editions remain secure in our archive. Our data pipeline is synchronizing latest reports."
            actionText="Refresh Briefs"
            actionHref="/geopolitical-brief"
          />
        ) : !lead ? (
          <StatusState
            eyebrow="CURRENT EDITION"
            title="No valid Daily Brief is available for this selection."
            description="Updates appear only after the complete edition clears source, evidence, and quality checks. Try clearing active filters."
            actionText="Clear All Filters"
            actionHref="/geopolitical-brief"
          />
        ) : (
          <header className={styles.liveLead}>
            {/* No `ShinyText` here, deliberately. Two reasons, either alone
                sufficient. Editorially, neither eyebrow on this page names a
                live state — "Current edition" classifies the lead and
                "Intelligence desk" is a masthead — and this kicker is already
                the single gold accent on the first screen, so a pass through
                it is a second emphasis on the one thing that had emphasis.
                Mechanically, the primitive cannot currently show a pass at
                all: `shiny-text.module.css` sets an opaque `color` and paints
                the gradient behind the glyphs through `background-clip:
                text`, which puts it under fully opaque ink. Reported to the
                library's owner rather than worked around from here. */}
            <p className={styles.liveEyebrow}>
              <span>Current edition</span>
              <time dateTime={lead.publishedAt}>{formatDate(lead.publishedAt)}</time>
            </p>
            <h2>{lead.title}</h2>
            {lead.summary ? <p>{lead.summary}</p> : null}
            <ButtonLink href={`/articles/${lead.publicId}`} variant="primary" size="md">
              Read the full brief <span aria-hidden="true">↗</span>
            </ButtonLink>
          </header>
        )}

        {featuredIsrael ? (
          <section className={styles.featureStory}>
            <p className={styles.liveEyebrow}>
              <span>Israel</span>
              <span>Daily feature</span>
            </p>
            <h2>{featuredIsrael.title}</h2>
            {featuredIsrael.summary ? <p>{featuredIsrael.summary}</p> : null}
            <Metadata item={featuredIsrael} />
            <Link href={`/articles/${featuredIsrael.publicId}`} className={styles.readLink}>Read the feature <span aria-hidden="true">↗</span></Link>
          </section>
        ) : null}

        {updates.length ? <PublicationSection title="Israel and war updates" items={updates} /> : null}
        {narratives.length ? <PublicationSection title="Narrative watch and false claims" items={narratives} narrative /> : (
          <section className={styles.liveSection} aria-labelledby="narrative-watch-heading">
            <h2 id="narrative-watch-heading">Narrative watch and false claims</h2>
            {/* This used to say nothing had "cleared the evidence threshold".
                A record published as our own analysis deliberately clears no
                such threshold, so the old wording would have described the
                new content type as a failure. */}
            <div className={styles.narrativeEmpty}>
              <p>No narrative record was published in this edition.</p>
              <p>Records appear here in two forms — a reported claim with its source trail, or our own analysis answering a claim no public source yet documents. Both state their wording, trend and evidence status in full, and an unsourced record is labelled as analysis on its face.</p>
            </div>
          </section>
        )}
        {dailyBriefs.length > 1 ? <PublicationSection title="Daily archive" items={dailyBriefs.slice(1)} /> : null}
      </div>
    </EditorialShell>
  );
}

type Publication = Awaited<ReturnType<typeof listBriefingPublications>>[number];

function uniqueValues(publications: Publication[], key: "primaryActor" | "editorialTopic" | "arena"): string[] {
  return [...new Set(publications.map((item) => item[key]).filter((value): value is string => Boolean(value)))].sort();
}

function PublicationSection({ title, items, narrative = false }: { title: string; items: Publication[]; narrative?: boolean }) {
  return (
    <section className={styles.liveSection}>
      <h2>{title}</h2>
      <ol className={styles.liveList}>{items.map((item) => (
        <li key={item.publicId}>
          {/* Nested Read-record control: the row is a surface, not a link. */}
          <Card variant="row" as="article" className={styles.liveRow}>
            <CardHeader className={styles.liveRowHeader}>
              <CardEyebrow>
                {rowStatus(item, narrative)}
                {item.editorialTopic ? ` · ${item.editorialTopic}` : ""}
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

function Metadata({ item, narrative = false }: { item: Publication; narrative?: boolean }) {
  const values = [item.editorialTopic, item.primaryActor, item.arena].filter(Boolean);
  const details = item.narrativeWatchDetails;
  return <>
    {values.length ? (
      <small className={styles.storyMeta}>
        {narrative ? <span className={styles.metaLabel}>Monitored signal</span> : null}
        <span>{values.join(" · ")}</span>
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

function israelDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
