import { ActivationBand } from "@/components/content";
import { SITE_URL } from "@/lib/site-config";
import { formatDay } from "@/lib/format-date";
import type { Metadata } from "next";
import Link from "next/link";
import { EditorialShell } from "@/components/site/EditorialShell";
import { HubMasthead, HubUpdated, type HubJumpLink } from "@/components/site/HubMasthead";
import { getCaseIndex } from "@/lib/content/fake-resistance-cases";
import { getAntisemitismFeed, getInfluenceInvestigationFeed, getNarrativeWatchFeed } from "@/lib/content/fake-resistance-watch";
import { NarrativeRecord } from "@/components/briefs/NarrativeRecord";
import { AntisemitismRecord } from "@/components/briefs/AntisemitismRecord";
import { publicationHref } from "@/lib/publication-routing";
import { Card, CardCount, CardDescription, CardEyebrow, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";
import { measureCard, measurePublicationCard } from "@/components/measurement/attrs";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/page-metadata";
import { Icon } from "@/components/ui/Icon";
import { ViewTransition } from "@/components/motion";

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
  /* In-page anchors only, and only to sections that are on the page: the
     "Further investigations" ledger renders only when there is more than one
     case file, and a contents row that points at an id nobody wrote is a
     control that does nothing. */
  const jumps: HubJumpLink[] = [
    { href: "#investigation-heading", label: "Latest investigation" },
    { href: "#latest-monitoring", label: "On the watch" },
    { href: "#antisemitism", label: "Antisemitism" },
    { href: "#influence", label: "Influence operations" },
    ...(otherCases.length ? [{ href: "#research-heading" as const, label: "Further investigations" }] : []),
  ];
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
          jumps={jumps}
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
              <Link className={styles.action} href={`/fake-resistance/cases/${featured.slug}`}>Open the investigation <Icon name="arrow-right" inline className="arrow" /></Link>
            </> : <><h2 id="investigation-heading">Investigations</h2>
              {research.status === "rejected"
                ? <StatusState status={absenceStatus("unavailable")} eyebrow="Latest investigation"
                    title="Investigations could not be loaded."
                    description="Monitoring below remains available. This is not an empty case file." />
                : <StatusState status={absenceStatus("nothing-published")} eyebrow="Latest investigation"
                    title="No investigations have been published yet."
                    description="Published monitoring records appear beside this panel as they arrive." />}</>}
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
              <Link href="/fake-resistance/watch">All of Narrative Watch <Icon name="arrow-right" inline className="arrow" /></Link>
            </header>
            <p className={styles.disclosure}>Published monitoring. Not a live scan.</p>
            {monitoring.status === "rejected"
              ? <StatusState status={absenceStatus("unavailable")} eyebrow="On the watch" title="Monitoring could not be loaded."
                  description="The publication service is unavailable. This is not an empty watch list." />
              : items.length ? items.slice(0, 3).map(item => <NarrativeRecord key={item.publicId} item={item} compact />)
              : <StatusState status={absenceStatus("nothing-published")} eyebrow="On the watch" title="No monitoring records have been published yet."
                  description="Assessed claims appear here as they clear review." />}
          </section>
        </div>
        <section id="antisemitism" className={styles.antisemitism} aria-labelledby="antisemitism-heading">
          <header className={styles.sectionHead}>
            <h2 id="antisemitism-heading">Antisemitism</h2>
            <SectionCount settled={antisemitism.status === "fulfilled"} count={antisemitismItems.length} noun="record" />
            <Link href="/fake-resistance/antisemitism">All of Antisemitism <Icon name="arrow-right" inline className="arrow" /></Link>
          </header>
          <p className={styles.disclosure}>Documented incidents and trends. A report names what is known, its context, and what remains unconfirmed.</p>
          {antisemitism.status === "rejected"
            ? <StatusState status={absenceStatus("unavailable")} eyebrow="Antisemitism" title="Antisemitism records could not be loaded."
                description="The publication service is unavailable. This is not an empty record." />
            : antisemitismItems.length ? antisemitismItems.slice(0, 2).map(item => <AntisemitismRecord key={item.publicId} item={item} compact />)
            : <StatusState status={absenceStatus("nothing-published")} eyebrow="Antisemitism" title="No antisemitism records have been published yet."
                description="Documented incidents appear here as they are filed." />}
        </section>
        <section id="influence" className={styles.more} aria-labelledby="influence-heading">
          <header className={styles.sectionHead}>
            <h2 id="influence-heading">Influence operations</h2>
            <SectionCount settled={influence.status === "fulfilled"} count={influenceItems.length} noun="investigation" />
            <Link href="/fake-resistance/network">The influence network <Icon name="arrow-right" inline className="arrow" /></Link>
          </header>
          <p className={styles.disclosure}>Published investigations into coordinated influence — state-aligned, networked and anti-Western operations — kept apart from the claims they circulate.</p>
          {influence.status === "rejected"
            ? <StatusState status={absenceStatus("unavailable")} eyebrow="Influence operations" title="Influence investigations could not be loaded."
                description="The publication service is unavailable. This is not an empty file." />
            : influenceItems.length ? <div className={styles.researchGrid}>{influenceItems.slice(0, 3).map(item => (
                <Card key={item.publicId} variant="tile" href={publicationHref(item.publicId)} {...measurePublicationCard("fr-influence", item)}>
                  <CardHeader>
                    <CardEyebrow>Influence operation</CardEyebrow>
                    <CardCount><time dateTime={item.publishedAt}>{formatDay(item.publishedAt)}</time></CardCount>
                  </CardHeader>
                  {/* The shared element: a tile's headline carries the
                      record's own name here and on the record page. */}
                  <ViewTransition name={`record-${item.publicId}-headline`} share="morph" default="none">
                    <CardTitle>{item.title}</CardTitle>
                  </ViewTransition>
                  {item.summary ? <CardDescription clamp>{item.summary}</CardDescription> : null}
                </Card>
              ))}</div>
            : <StatusState status={absenceStatus("nothing-published")} eyebrow="Influence operations" title="No influence investigations have been published yet."
                description="Coordinated-influence files appear here once they are published." />}
        </section>
        {otherCases.length ? <section className={styles.more} aria-labelledby="research-heading">
          <header className={styles.sectionHead}>
            <h2 id="research-heading">Further investigations</h2>
            <SectionCount settled count={otherCases.length} noun="investigation" />
          </header>
          <div className={styles.researchGrid}>{otherCases.slice(0, 3).map(item => (
            <Card key={item.slug} variant="tile" href={`/fake-resistance/cases/${item.slug}`}
              {...measureCard({ id: `fr-case-${item.slug}`, section: "fake-resistance", content: `case:${item.slug}`, type: "case" })}>
              <CardHeader>
                <CardEyebrow>Case file</CardEyebrow>
                <CardCount><time dateTime={item.updatedAt}>{formatDay(item.updatedAt)}</time></CardCount>
              </CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription clamp>{item.question}</CardDescription>
            </Card>
          ))}</div>
        </section> : null}
        <nav className={styles.depth} aria-label="Explore the research" data-measure-id="fr-depth-nav" data-measure-section="fake-resistance">
          <Link href="/fake-resistance/network"><span>Connections &amp; amplification</span><strong>The influence network</strong><Icon name="arrow-right" inline className="arrow" /></Link>
          <Link href="/fake-resistance/playbook"><span>Recognise the techniques</span><strong>The manipulation playbook</strong><Icon name="arrow-right" inline className="arrow" /></Link>
          <Link href="/fake-resistance/official-narrative"><span>How a state tells it</span><strong>Official narrative engineering</strong><Icon name="arrow-right" inline className="arrow" /></Link>
          <Link href="/fake-resistance/social-media"><span>Where it spreads</span><strong>The social-media front</strong><Icon name="arrow-right" inline className="arrow" /></Link>
        </nav>
        <ActivationBand
          heading="Carry the sourced version back."
          share={{ url: `${SITE_URL}/fake-resistance`, text: "Fake Resistance — the claims in circulation, what they were built from, and the sourced version to carry back." }}
        />
        <aside className={styles.watchBridge} aria-label="The news desk">
          <p className={styles.bridgeKicker}>Next in the record</p>
          <h2>Looking for what happened?</h2>
          <p>Reporting on events — every line with the source behind it — is kept on the news desk, apart from the claims made about them.</p>
          <Link className={styles.bridgeLink} href="/geopolitical-brief" data-measure-id="fr-to-brief">
            All of News &amp; Analysis <Icon name="arrow-right" inline className="arrow" />
          </Link>
        </aside>
      </div>
    </EditorialShell>
  );
}
