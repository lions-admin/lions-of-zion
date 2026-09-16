import { ActivationBand } from "@/components/content";
import { SITE_URL } from "@/lib/site-config";
import { formatDay } from "@/lib/format-date";
import type { Metadata } from "next";
import Link from "next/link";
import { EditorialShell } from "@/components/site/EditorialShell";
import { HubMasthead, HubUpdated } from "@/components/site/HubMasthead";
import { getCaseIndex } from "@/lib/content/fake-resistance-cases";
import { getAntisemitismFeed, getInfluenceInvestigationFeed, getNarrativeWatchFeed } from "@/lib/content/fake-resistance-watch";
import { NarrativeRecord } from "@/components/briefs/NarrativeRecord";
import { AntisemitismRecord } from "@/components/briefs/AntisemitismRecord";
import { publicationHref } from "@/lib/publication-routing";
import { measureCard, measurePublicationCard } from "@/components/measurement/attrs";
import { Card, CardCta, CardDescription, CardTitle } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/page-metadata";

/* The hub's lede (docs/audits/2026-09-08-copy-table.md, UX-02). */
const description = "See the claim. See what it was built from. Take the sourced version with you.";
export const metadata: Metadata = pageMetadata({
  title: "Fake Resistance", description, path: "/fake-resistance",
});

/** "7 records" beside a section head — or nothing, when the read that would
 *  have counted them failed. Never `0` for a desk nobody could read. */
function SectionCount({ settled, count, noun }: { settled: boolean; count: number; noun: string }) {
  if (!settled) return null;
  return <p className={styles.sectionCount}><span data-numeric="">{count}</span> {count === 1 ? noun : `${noun}s`}</p>;
}

export default async function Page() {
  const [research, monitoring, antisemitism, influence] = await Promise.allSettled([getCaseIndex(), getNarrativeWatchFeed(), getAntisemitismFeed(), getInfluenceInvestigationFeed()]);
  const cases = research.status === "fulfilled" ? [...research.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  const items = monitoring.status === "fulfilled" ? [...monitoring.value].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) : [];
  const antisemitismItems = antisemitism.status === "fulfilled" ? [...antisemitism.value].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) : [];
  /* `influence_investigation` routes here through `lib/publication-routing.ts`
     and had no reading surface on the desk that owns it. Published records
     only — the hand-curated case files above keep their own higher bar. */
  const influenceItems = influence.status === "fulfilled" ? [...influence.value].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) : [];
  const [featured, ...otherCases] = cases;
  /* When this desk last changed: the newest instant across every read that
     succeeded. A failed read contributes nothing rather than a date it does
     not have, and a desk with nothing published says nothing here. */
  const latest = [
    ...(research.status === "fulfilled" ? cases.map((item) => item.updatedAt) : []),
    ...(monitoring.status === "fulfilled" ? items.map((item) => item.publishedAt) : []),
    ...(antisemitism.status === "fulfilled" ? antisemitismItems.map((item) => item.publishedAt) : []),
    ...(influence.status === "fulfilled" ? influenceItems.map((item) => item.publishedAt) : []),
  ].sort().at(-1);
  return (
    <EditorialShell routeId="fake-resistance" showProgress={false} className={styles.page}>
      <div className={styles.hub}>
        <HubMasthead
          kicker="What is being said about it"
          title={<>Fake Resistance</>}
          standfirst={description}
          status={latest ? <HubUpdated at={latest} /> : undefined}
          jumps={[
            { href: "#investigation-heading", label: "Latest investigation" },
            { href: "#latest-monitoring", label: "On the watch" },
            { href: "#antisemitism", label: "Antisemitism" },
            { href: "#influence", label: "Influence operations" },
          ]}
        />
        <div className={styles.front}>
          <section className={styles.investigation} aria-labelledby="investigation-heading"
            {...(featured ? measureCard({ id: `fr-case-lead-${featured.slug}`, section: "fake-resistance", content: `case:${featured.slug}`, type: "case", placement: "fake-resistance:lead" }) : {})}>
            <div className={styles.eyebrow}><span>Latest investigation</span>{featured ? <time dateTime={featured.updatedAt}>{formatDay(featured.updatedAt)}</time> : null}</div>
            {featured ? <>
              <h2 id="investigation-heading"><Link href={`/fake-resistance/cases/${featured.slug}`}>{featured.title}</Link></h2>
              <p className={styles.question}>{featured.question}</p>
              <dl className={styles.evidence}>
                <div><dt>Graded findings</dt><dd>{featured.counts.exhibits}</dd></div>
                <div><dt>Sources on record</dt><dd>{featured.counts.sources}</dd></div>
              </dl>
              <Link className={styles.action} href={`/fake-resistance/cases/${featured.slug}`}>Open the investigation <span aria-hidden="true">→</span></Link>
            </> : (
              <StatusState
                status={absenceStatus(research.status === "rejected" ? "unavailable" : "nothing-published")}
                title={research.status === "rejected"
                  ? "Investigations could not be loaded."
                  : "No investigations are available yet."}
                description={research.status === "rejected"
                  ? "Monitoring remains available alongside. This is not an empty file."
                  : "Graded case files appear here as they are published."}
              />
            )}
          </section>
          <section id="latest-monitoring" className={styles.monitoring} aria-labelledby="monitoring-heading">
            {/* UX-15 — the counts that used to sit in the masthead's facts
                rail now sit beside the head they describe. A failed read and
                an empty desk are different facts, and a count is the one
                place the difference disappears silently: both settle to `[]`,
                and `0` then states as fact something nobody knows. So a count
                is printed only when its read succeeded; the body already says
                "temporarily unavailable" for the other case. */}
            <header className={styles.sectionHead}>
              <h2 id="monitoring-heading">On the watch</h2>
              <SectionCount settled={monitoring.status === "fulfilled"} count={items.length} noun="record" />
              <Link href="/fake-resistance/watch">All of Narrative Watch <span aria-hidden="true">→</span></Link>
            </header>
            <p className={styles.disclosure}>Published monitoring. Not a live scan.</p>
            {monitoring.status === "rejected" ? (
              <StatusState status={absenceStatus("unavailable")} title="Monitoring is temporarily unavailable."
                description="The claims desk's published records are unaffected and return when the read succeeds." />
            ) : items.length ? items.slice(0, 3).map(item => <NarrativeRecord key={item.publicId} item={item} compact />) : (
              <StatusState status={absenceStatus("nothing-published")} title="No monitoring records have been published yet."
                description="Claim assessments appear here as they are published." />
            )}
          </section>
        </div>
        <section id="antisemitism" className={styles.antisemitism} aria-labelledby="antisemitism-heading">
          <header className={styles.sectionHead}>
            <h2 id="antisemitism-heading">Antisemitism</h2>
            <SectionCount settled={antisemitism.status === "fulfilled"} count={antisemitismItems.length} noun="record" />
            <Link href="/fake-resistance/antisemitism">All of Antisemitism <span aria-hidden="true">→</span></Link>
          </header>
          <p className={styles.disclosure}>Documented incidents and trends. A report names what is known, its context, and what remains unconfirmed.</p>
          {/* Documented incidents are reporting, not contested claims — the
              adversarial ember never draws them (2026-09-16 clarity ruling).
              The panel is ruled like every other section on this desk. */}
          {antisemitism.status === "rejected" ? (
            <StatusState status={absenceStatus("unavailable")} title="Antisemitism records are temporarily unavailable."
              description="Documented incidents are unaffected and return when the read succeeds." />
          ) : antisemitismItems.length ? antisemitismItems.slice(0, 2).map(item => <AntisemitismRecord key={item.publicId} item={item} compact />) : (
            <StatusState status={absenceStatus("nothing-published")} title="No antisemitism records have been published yet."
              description="Documented incidents and trends appear here as they are published." />
          )}
        </section>
        <section id="influence" className={styles.more} aria-labelledby="influence-heading">
          <header className={styles.sectionHead}>
            <h2 id="influence-heading">Influence operations</h2>
            <SectionCount settled={influence.status === "fulfilled"} count={influenceItems.length} noun="investigation" />
            <Link href="/fake-resistance/network">The influence network <span aria-hidden="true">↗︎</span></Link>
          </header>
          <p className={styles.disclosure}>Published investigations into coordinated influence — state-aligned, networked and anti-Western operations — kept apart from the claims they circulate.</p>
          {influence.status === "rejected" ? (
            <StatusState status={absenceStatus("unavailable")} title="Influence investigations are temporarily unavailable."
              description="Published investigations are unaffected and return when the read succeeds." />
          ) : influenceItems.length ? <div className={styles.researchGrid}>{influenceItems.slice(0, 3).map(item => <article key={item.publicId} {...measurePublicationCard("fr-influence", item)}>
            <Card variant="tile" href={publicationHref(item.publicId)} className={styles.researchTile}>
              <time dateTime={item.publishedAt}>{formatDay(item.publishedAt)}</time>
              <CardTitle as="h3">{item.title}</CardTitle>
              {item.summary ? <CardDescription>{item.summary}</CardDescription> : null}
              <CardCta>Open the investigation</CardCta>
            </Card>
          </article>)}</div>
          : (
            <StatusState status={absenceStatus("nothing-published")} title="No influence investigations have been published yet."
              description="Published investigations into coordinated influence appear here." />
          )}
        </section>
        {otherCases.length ? <section className={styles.more} aria-labelledby="research-heading">
          <header className={styles.sectionHead}>
            <h2 id="research-heading">Further investigations</h2>
            {/* The count is the rows that follow, not the whole file: the lead
                above is an investigation too, and a reader counting tiles
                against the head is counting these. */}
            <SectionCount settled count={otherCases.length} noun="investigation" />
            <Link href="/fake-resistance/social-media">All of the investigations <span aria-hidden="true">→</span></Link>
          </header>
          <div className={styles.researchGrid}>{otherCases.slice(0,3).map(item => <article key={item.slug}
            {...measureCard({ id: `fr-case-${item.slug}`, section: "fake-resistance", content: `case:${item.slug}`, type: "case" })}>
            <Card variant="tile" href={`/fake-resistance/cases/${item.slug}`} className={styles.researchTile}>
              <time dateTime={item.updatedAt}>{formatDay(item.updatedAt)}</time>
              <CardTitle as="h3">{item.title}</CardTitle>
              <CardDescription>{item.question}</CardDescription>
              <CardCta>Open the investigation</CardCta>
            </Card>
          </article>)}</div>
        </section> : (
          <section className={styles.more} aria-labelledby="research-heading">
            <StatusState
              status={absenceStatus(research.status === "rejected" ? "unavailable" : "empty-record")}
              title={research.status === "rejected"
                ? "Investigations could not be loaded."
                : "No further investigations on file yet."}
              description={research.status === "rejected"
                ? "The case file could not be read; the investigations above were not affected."
                : "The latest investigation above is the whole file so far."}
            />
          </section>
        )}
        <nav className={styles.depth} aria-label="Explore the research" data-measure-id="fr-depth-nav" data-measure-section="fake-resistance">
          <Link href="/fake-resistance/network"><span>Connections &amp; amplification</span><strong>The influence network</strong><span aria-hidden="true">↗︎</span></Link>
          <Link href="/fake-resistance/playbook"><span>Recognise the techniques</span><strong>The manipulation playbook</strong><span aria-hidden="true">↗︎</span></Link>
          <Link href="/fake-resistance/official-narrative"><span>Inside the story it tells</span><strong>Documented narrative investigations</strong><span aria-hidden="true">↗︎</span></Link>
        </nav>
        {/* The bottom-links row, re-voiced as one bridge: this desk's reader
            who wants the news is standing at the end of the front, and the
            bridge is where a front hands its reader over (the same device the
            news desk points back with). One device, one sentence, one door —
            the antisemitism records are linked from their section head above. */}
        <aside className={styles.watchBridge} aria-label="Continue to the news" data-measure-id="fr-to-news" data-measure-section="fake-resistance">
          <span className={styles.watchMark} aria-hidden="true">
            <Icon name="source" size={18} strokeWidth={1.5} />
          </span>
          <div>
            <h2>Looking for what is happening?</h2>
            <p>What happened today in Israel and the region, with the sources behind every line, is on the news desk — kept separate from the claims desk.</p>
          </div>
          <ButtonLink href="/geopolitical-brief" variant="secondary" size="md" rightIcon={<span aria-hidden="true">↗︎</span>}
            data-measure-id="fr-to-news-link">
            All of News &amp; Analysis
          </ButtonLink>
        </aside>
        {/* The band's sentence is this hub's own, not the site's stock line. */}
        <ActivationBand
          share={{ url: `${SITE_URL}/fake-resistance`, text: "Fake Resistance — the claims in circulation, what they were built from, and the sourced version to carry back." }}
          heading="Check a claim yourself."
        />
      </div>
    </EditorialShell>
  );
}
