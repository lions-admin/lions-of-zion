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
    <EditorialShell routeId="fake-resistance" register="silent" showProgress={false} className={styles.page}>
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
            { href: "/fake-resistance/network", label: "The influence network" },
            { href: "/fake-resistance/playbook", label: "The playbook" },
          ]}
        />
        <div className={styles.front}>
          <section className={styles.investigation} aria-labelledby="investigation-heading">
            <div className={styles.eyebrow}><span>Latest investigation</span>{featured ? <time dateTime={featured.updatedAt}>{formatDay(featured.updatedAt)}</time> : null}</div>
            {featured ? <>
              <h2 id="investigation-heading"><Link href={`/fake-resistance/cases/${featured.slug}`}>{featured.title}</Link></h2>
              <p className={styles.question}>{featured.question}</p>
              <dl className={styles.evidence}>
                <div><dt>Graded findings</dt><dd>{featured.counts.exhibits}</dd></div>
                <div><dt>Sources on record</dt><dd>{featured.counts.sources}</dd></div>
              </dl>
              <Link className={styles.action} href={`/fake-resistance/cases/${featured.slug}`}>Open the investigation <span aria-hidden="true">→</span></Link>
            </> : <><h2 id="investigation-heading">Investigations</h2><p role={research.status === "rejected" ? "alert" : undefined}>{research.status === "rejected" ? "Investigations could not be loaded. Monitoring remains available alongside." : "No investigations are available yet."}</p></>}
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
            {monitoring.status === "rejected" ? <p role="alert">Monitoring is temporarily unavailable.</p> : items.length ? items.slice(0, 3).map(item => <NarrativeRecord key={item.publicId} item={item} compact />) : <p>No monitoring records have been published yet.</p>}
          </section>
        </div>
        <section id="antisemitism" className={styles.antisemitism} aria-labelledby="antisemitism-heading">
          <header className={styles.sectionHead}>
            <h2 id="antisemitism-heading">Antisemitism</h2>
            <SectionCount settled={antisemitism.status === "fulfilled"} count={antisemitismItems.length} noun="record" />
            <Link href="/fake-resistance/antisemitism">All of Antisemitism <span aria-hidden="true">→</span></Link>
          </header>
          <p className={styles.disclosure}>Documented incidents and trends. A report names what is known, its context, and what remains unconfirmed.</p>
          {antisemitism.status === "rejected" ? <p role="alert">Antisemitism records are temporarily unavailable.</p> : antisemitismItems.length ? antisemitismItems.slice(0, 2).map(item => <AntisemitismRecord key={item.publicId} item={item} compact />) : <p>No antisemitism records have been published yet.</p>}
        </section>
        <section id="influence" className={styles.more} aria-labelledby="influence-heading">
          <header className={styles.sectionHead}>
            <h2 id="influence-heading">Influence operations</h2>
            <SectionCount settled={influence.status === "fulfilled"} count={influenceItems.length} noun="investigation" />
            <Link href="/fake-resistance/network">The influence network <span aria-hidden="true">↗︎</span></Link>
          </header>
          <p className={styles.disclosure}>Published investigations into coordinated influence — state-aligned, networked and anti-Western operations — kept apart from the claims they circulate.</p>
          {influence.status === "rejected" ? <p role="alert">Influence investigations are temporarily unavailable.</p>
            : influenceItems.length ? <div className={styles.researchGrid}>{influenceItems.slice(0, 3).map(item => <article key={item.publicId}>
                <time dateTime={item.publishedAt}>{formatDay(item.publishedAt)}</time>
                <h3><Link href={publicationHref(item.publicId)}>{item.title}</Link></h3>
                {item.summary ? <p>{item.summary}</p> : null}
                <Link className={styles.action} href={publicationHref(item.publicId)}>Open the investigation <span aria-hidden="true">→</span></Link>
              </article>)}</div>
            : <p>No influence investigations have been published yet.</p>}
        </section>
        {otherCases.length ? <section className={styles.more} aria-labelledby="research-heading">
          <header className={styles.sectionHead}>
            <h2 id="research-heading">Further investigations</h2>
            <SectionCount settled count={cases.length} noun="investigation" />
            <Link href="/fake-resistance/social-media">All investigations <span aria-hidden="true">→</span></Link>
          </header>
          <div className={styles.researchGrid}>{otherCases.slice(0,3).map(item => <article key={item.slug}>
            <time dateTime={item.updatedAt}>{formatDay(item.updatedAt)}</time>
            <h3><Link href={`/fake-resistance/cases/${item.slug}`}>{item.title}</Link></h3>
            <p>{item.question}</p>
            <Link className={styles.action} href={`/fake-resistance/cases/${item.slug}`}>Open the investigation <span aria-hidden="true">→</span></Link>
          </article>)}</div>
        </section> : null}
        <nav className={styles.depth} aria-label="Explore the research">
          <Link href="/fake-resistance/network"><span>Connections &amp; amplification</span><strong>The influence network</strong><span aria-hidden="true">↗︎</span></Link>
          <Link href="/fake-resistance/playbook"><span>Recognise the techniques</span><strong>The manipulation playbook</strong><span aria-hidden="true">↗︎</span></Link>
        </nav>
        <div className={styles.bottomLinks}><Link href="/fake-resistance/official-narrative">Documented narrative investigations →</Link><Link href="/fake-resistance/antisemitism">Antisemitism records →</Link><Link href="/geopolitical-brief">Looking for news? All of News &amp; Analysis →</Link></div>
        <ActivationBand
          share={{ url: `${SITE_URL}/fake-resistance`, text: "Fake Resistance — the claims in circulation, what they were built from, and the sourced version to carry back." }}
        />
      </div>
    </EditorialShell>
  );
}
