import Link from "next/link";
import { listBriefingPublications } from "@/lib/publications";
import { isAnalysisBasis } from "@/server/contracts/publication";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Reveal } from "@/components/motion";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusState } from "@/components/ui/StatusState";
import styles from "./live-brief.module.css";

/* `--stagger` is one step of a sequence and the token file caps a sequence
   at four items. A list here can run to a hundred, and an entrance delay
   that keeps growing would leave the fiftieth row blank for seconds after
   it has scrolled into view. */
const MAX_STAGGER_INDEX = 3;

type Filters = { date?: string; actor?: string; topicLabel?: string; arena?: string };

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
    <main className={styles.page}>
      <SiteHeader activeSection="geopolitical-brief" />
      <div className={styles.liveLayout}>
        <header className={styles.deskHeader}>
          <p className={styles.liveEyebrow}>
            <span className={styles.deskMark}>Lions of Zion</span>
            <span>Intelligence desk</span>
          </p>
          <h1>The Daily Brief</h1>
          <p>Source-linked reporting on Israel, the war, and the narratives shaping international attention.</p>
        </header>

        <ArchiveFilters filters={filters} publications={filterSource} />

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
    </main>
  );
}

type Publication = Awaited<ReturnType<typeof listBriefingPublications>>[number];

function ArchiveFilters({ filters, publications }: { filters: Filters; publications: Publication[] }) {
  const values = (key: "primaryActor" | "editorialTopic" | "arena") =>
    [...new Set(publications.map((item) => item[key]).filter((value): value is string => Boolean(value)))].sort();
  return (
    <form className={styles.filters} action="/geopolitical-brief" method="get">
      <label><span>Date</span><input type="date" name="date" defaultValue={filters.date} /></label>
      <label><span>Actor</span><select name="actor" defaultValue={filters.actor ?? ""}><option value="">All actors</option>{values("primaryActor").map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Topic</span><select name="topicLabel" defaultValue={filters.topicLabel ?? ""}><option value="">All topics</option>{values("editorialTopic").map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Arena</span><select name="arena" defaultValue={filters.arena ?? ""}><option value="">All arenas</option>{values("arena").map((value) => <option key={value}>{value}</option>)}</select></label>
      <Button type="submit" variant="primary" size="md">Filter archive</Button>
      {Object.values(filters).some(Boolean) ? (
        <ButtonLink href="/geopolitical-brief" variant="ghost" size="md">
          Clear
        </ButtonLink>
      ) : null}
    </form>
  );
}

function PublicationSection({ title, items, narrative = false }: { title: string; items: Publication[]; narrative?: boolean }) {
  return (
    <section className={styles.liveSection}>
      <h2>{title}</h2>
      {/* `Reveal` takes its children as a prop, so each row is still server
          markup and this file is still a Server Component. The entrance is
          the shared one — opacity, a short rise, a focus pull, once. No
          ticker, no marquee, nothing that keeps moving after it has
          arrived. */}
      <ol className={styles.liveList}>{items.map((item, index) => (
        <Reveal as="li" key={item.publicId} index={Math.min(index, MAX_STAGGER_INDEX)}>
          <Link href={`/articles/${item.publicId}`}>
            <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
            <Headline title={item.title} narrative={narrative} />
            {item.summary ? <span>{item.summary}</span> : null}
            <Metadata item={item} narrative={narrative} />
          </Link>
        </Reveal>
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
  if (!match) return <strong>{title}</strong>;
  return (
    <>
      <span className={styles.claimKicker}>{match[1]}</span>
      <strong>{title.slice(match[0].length)}</strong>
    </>
  );
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
