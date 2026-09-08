import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/sections/DocPage";
import { SectionBlock } from "@/components/sections/SectionPage";
import { CorrectionHistory, type Correction } from "@/components/content";
import { StatusState } from "@/components/ui/StatusState";
import { getCorrectionsLog } from "@/lib/content/corrections";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";
import { pageMetadata } from "@/lib/page-metadata";

const TAGLINE = "How Lions of Zion corrects errors, records significant changes and keeps automated publishing accountable.";
const PAGE_URL = `${SITE_URL}/corrections`;

export const metadata: Metadata = pageMetadata({ title: "Corrections", description: TAGLINE, path: "/corrections" });

const CORRECTIONS_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Corrections",
  url: PAGE_URL,
  description: TAGLINE,
  isPartOf: { "@type": "WebSite", name: "Lions of Zion", url: SITE_URL },
};

type LedgerState = { kind: "ready"; entries: Correction[] } | { kind: "unavailable" };

async function readLedger(): Promise<LedgerState> {
  try {
    const log = await getCorrectionsLog();
    return {
      kind: "ready",
      entries: log.map((entry) => ({
        date: entry.date,
        note: entry.note,
        version: entry.version,
        href: entry.slug.startsWith("/") ? entry.slug : undefined,
        context: entry.page || undefined,
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export default async function Page() {
  const ledger = await readLedger();
  const count = ledger.kind === "ready" ? ledger.entries.length : null;

  return (
    <DocPage register="silent" routeId="corrections" title="Corrections" tagline={TAGLINE}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(CORRECTIONS_JSON_LD) }} />

      <SectionBlock heading="Accountability does not disappear when AI is used">
        <p>Lions of Zion uses AI to increase the speed and breadth of research, comparison and editorial production. That makes correction mechanisms more important, not less. Automated assistance is never an excuse to hide an error, erase an earlier version or pretend that a changing evidence record never changed.</p>
        <p>Human governance remains responsible for the rules around publishing, provenance, escalation and correction. Machine-authored publications can go live through an authorized production path without manual pre-approval of every record; they remain part of the same correctable public record.</p>
      </SectionBlock>

      <SectionBlock heading="Policy">
        <p>When a material factual or contextual error is identified, the public record should be corrected clearly. Significant changes should be transparent, useful historical context should be preserved where it helps readers understand what changed, and uncertainty should be updated when the evidence changes.</p>
        <p>Corrections are not the same thing as routine story development. The sourcing and evidence standard is explained on the <Link href="/methodology">Methodology</Link> page.</p>
      </SectionBlock>

      <SectionBlock heading="What kind of change was made?">
        <ul>
          <li><strong>Correction.</strong> Fixes a material factual or contextual error and belongs in the public correction record.</li>
          <li><strong>Update.</strong> Adds information that emerged after publication without implying the earlier record was wrong.</li>
          <li><strong>Developing-story revision.</strong> Updates the current canonical account as an event changes while preserving version history.</li>
          <li><strong>Added context.</strong> Adds explanation without changing the underlying finding.</li>
          <li><strong>Source update.</strong> Adds, replaces or clarifies a citation or archive link. If the new source changes the conclusion, that change also belongs in the correction record.</li>
          <li><strong>Technical migration.</strong> Moves or reformats material without making a new editorial finding or claiming new verification.</li>
        </ul>
      </SectionBlock>

      <SectionBlock heading="Correction log">
        <p>The central ledger below is one public view of corrections recorded by this site. Publication-level version histories and explicit correction notes may also preserve changes on the records themselves. An empty central ledger must not be read as a claim that no error has ever occurred or that every automated publication was correct.</p>
        <div className={styles.ledger}>
          <div className={styles.ledgerHead}>
            <span className={styles.ledgerKicker}>Public ledger</span>
            <span className={styles.ledgerCount}>{count === null ? "Entries unavailable" : count === 1 ? "1 entry" : `${count} entries`}</span>
          </div>
          {ledger.kind === "unavailable" ? (
            <StatusState className={styles.ledgerState} status="error" eyebrow="Ledger unavailable" title="The correction log could not be loaded" description="This is a failure to read the central ledger, not a statement that no corrections exist. Reload the page; if the problem continues, report it." actionText="Report the problem" actionHref="/support-us#report" />
          ) : count === 0 ? (
            <StatusState className={styles.ledgerState} status="empty" eyebrow="Ledger loaded" title="No entries in the central ledger" description="The central corrections ledger currently contains no rows. That does not establish an error-free history: publication version histories and correction notes may contain changes that are not yet aggregated here." actionText="Read the methodology" actionHref="/methodology#corrections" />
          ) : (
            <CorrectionHistory corrections={ledger.entries} />
          )}
        </div>
      </SectionBlock>

      <SectionBlock heading="Report an error">
        <p>If you find a factual problem, missing context or a source that no longer supports the claim beside it, report it. The question is not whether a person or an AI produced the original record; the question is whether the public record now reflects the best available evidence. Use the <Link href="/support-us#report">report form</Link>.</p>
      </SectionBlock>
    </DocPage>
  );
}
