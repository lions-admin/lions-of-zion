import type { Metadata } from "next";
import Link from "next/link";
import { EditorialShell } from "@/components/site/EditorialShell";
import { HubMasthead } from "@/components/site/HubMasthead";
import { getCaseIndex } from "@/lib/content/fake-resistance-cases";
import { getNarrativeWatchFeed } from "@/lib/content/fake-resistance-watch";
import { NarrativeRecord } from "@/components/briefs/NarrativeRecord";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

const description = "Investigations into false narratives, with circulating claims kept distinct from established findings.";
export const metadata: Metadata = {
  title: "Narratives & fact checks", description,
  alternates: { canonical: `${SITE_URL}/fake-resistance` },
};
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Jerusalem" }).format(new Date(value));
}
export default async function Page() {
  const [research, monitoring] = await Promise.allSettled([getCaseIndex(), getNarrativeWatchFeed()]);
  const cases = research.status === "fulfilled" ? [...research.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  const items = monitoring.status === "fulfilled" ? [...monitoring.value].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) : [];
  const [featured, ...otherCases] = cases;
  return (
    <EditorialShell routeId="fake-resistance" register="silent" showProgress={false} className={styles.page}>
      <div className={styles.hub}>
        <HubMasthead
          kicker="The claim and the record"
          title={<>Narratives &amp; fact checks</>}
          standfirst="Investigate the record. Distinguish a circulating claim from a finding, and follow the evidence to where it actually leads."
          /* A failed read and an empty desk are different facts, and a count
             is the one place the difference disappears silently: both settle
             to `[]`, and `0` then states as fact something nobody knows. The
             body below already distinguishes them ("temporarily unavailable"
             vs "none published yet"), so a numeric 0 beside it made the page
             contradict itself. Same rule `/updates` states at its own catch. */
          facts={[
            { label: "Investigations", value: research.status === "fulfilled" ? cases.length : "Unavailable" },
            { label: "On the watch", value: monitoring.status === "fulfilled" ? items.length : "Unavailable" },
          ]}
          jumps={[
            { href: "#investigation-heading", label: "Latest investigation" },
            { href: "#latest-monitoring", label: "On the watch" },
            { href: "/fake-resistance/network", label: "The influence network" },
            { href: "/fake-resistance/playbook", label: "The playbook" },
          ]}
        />
        <div className={styles.front}>
          <section className={styles.investigation} aria-labelledby="investigation-heading">
            <div className={styles.eyebrow}><span>Latest investigation</span>{featured ? <time dateTime={featured.updatedAt}>{dateLabel(featured.updatedAt)}</time> : null}</div>
            {featured ? <>
              <h2 id="investigation-heading"><Link href={`/fake-resistance/cases/${featured.slug}`}>{featured.title}</Link></h2>
              <p className={styles.question}>{featured.question}</p>
              <dl className={styles.evidence}>
                <div><dt>Graded findings</dt><dd>{featured.counts.exhibits}</dd></div>
                <div><dt>Sources on record</dt><dd>{featured.counts.sources}</dd></div>
              </dl>
              <Link className={styles.action} href={`/fake-resistance/cases/${featured.slug}`}>Read the investigation <span aria-hidden="true">→</span></Link>
            </> : <><h2 id="investigation-heading">Investigations</h2><p role={research.status === "rejected" ? "alert" : undefined}>{research.status === "rejected" ? "Investigations could not be loaded. Monitoring remains available alongside." : "No investigations are available yet."}</p></>}
          </section>
          <section id="latest-monitoring" className={styles.monitoring} aria-labelledby="monitoring-heading">
            <header className={styles.sectionHead}><h2 id="monitoring-heading">On the watch</h2><Link href="/fake-resistance/watch">Archive <span aria-hidden="true">↗︎</span></Link></header>
            <p className={styles.disclosure}>Published monitoring. Not a live scan.</p>
            {monitoring.status === "rejected" ? <p role="alert">Monitoring is temporarily unavailable.</p> : items.length ? items.slice(0, 3).map(item => <NarrativeRecord key={item.publicId} item={item} compact />) : <p>No monitoring records have been published yet.</p>}
          </section>
        </div>
        {otherCases.length ? <section className={styles.more} aria-labelledby="research-heading">
          <header className={styles.sectionHead}><h2 id="research-heading">Further investigations</h2><Link href="/fake-resistance/social-media">All investigations <span aria-hidden="true">↗︎</span></Link></header>
          <div className={styles.researchGrid}>{otherCases.slice(0,3).map(item => <article key={item.slug}>
            <time dateTime={item.updatedAt}>{dateLabel(item.updatedAt)}</time>
            <h3><Link href={`/fake-resistance/cases/${item.slug}`}>{item.title}</Link></h3>
            <p>{item.question}</p>
            <Link className={styles.action} href={`/fake-resistance/cases/${item.slug}`}>Read investigation <span aria-hidden="true">→</span></Link>
          </article>)}</div>
        </section> : null}
        <nav className={styles.depth} aria-label="Explore the research">
          <Link href="/fake-resistance/network"><span>Connections &amp; amplification</span><strong>The influence network</strong><span aria-hidden="true">↗︎</span></Link>
          <Link href="/fake-resistance/playbook"><span>Recognise the techniques</span><strong>The manipulation playbook</strong><span aria-hidden="true">↗︎</span></Link>
        </nav>
        <div className={styles.bottomLinks}><Link href="/fake-resistance/official-narrative">Documented narrative investigations →</Link><Link href="/geopolitical-brief">Looking for news? Read the news desk →</Link></div>
      </div>
    </EditorialShell>
  );
}
