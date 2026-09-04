import Link from "next/link";
import { CLAIM_FLOW, SIGNAL_JOURNEY } from "./pipeline-data";
import styles from "@/components/briefs/information-war-system.module.css";

/** "From signal to intelligence" — one complete lifecycle in eight steps. */
export function SignalJourney() {
  return (
    <ol className={styles.journeySteps}>
      {SIGNAL_JOURNEY.map((item, index) => (
        <li key={item.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h3>{item.step}</h3>
            <p>{item.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** How narratives emerge: signals → clusters → narrative → assessment. */
export function NarrativePanel() {
  return (
    <div className={styles.narrativePanel}>
      <ol className={styles.narrativeSteps}>
        <li>
          <h3>Individual signals</h3>
          <p>Collected posts and articles, each with publisher, URL and retrieval time.</p>
        </li>
        <li>
          <h3>Semantic clusters</h3>
          <p>Reports of the same event merge; duplicates never count as corroboration.</p>
        </li>
        <li>
          <h3>Narrative</h3>
          <p>A persistent frame across clusters — the story the copies are telling together.</p>
        </li>
        <li>
          <h3>Intelligence assessment</h3>
          <p>Growth, source diversity and evidence status are weighed; gaps are stated in writing.</p>
        </li>
      </ol>
      <p className={styles.diagramNote}>
        The number that matters is distinct source families, not account or copy counts. Twenty accounts in one
        family are one megaphone; three accounts across three families are a story actually spreading. Velocity,
        volume and reach figures are reported by platforms — and the most gameable number a hostile actor
        controls — so this page draws no dials for them.
      </p>
    </div>
  );
}

/** Suspicious-claim verification flow, with uncertainty explicit. */
export function ClaimFlow() {
  return (
    <ol className={styles.journeySteps}>
      {CLAIM_FLOW.map((item, index) => (
        <li key={item.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h3>{item.step}</h3>
            <p>{item.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The daily intelligence cycle: continuous collection, daily edition. */
export function DailyCycle() {
  const rows: [string, string][] = [
    ["Continuous", "Collection walks every active source, every 30 minutes."],
    ["10 and 40 past", "New documents are embedded for semantic search."],
    ["Every 15 minutes", "The outbox drains: re-indexing and cache invalidation."],
    ["Daily", "Cluster → triage → draft → quality → publish builds the edition."],
    ["From 10:00 Israel time", "The edition is expected; a missing edition raises a critical alert."],
    ["Nightly 03:20", "Maintenance: stuck-job recovery, data pruning, alert hygiene."],
  ];
  return (
    <div className={styles.cyclePanel}>
      <ol className={styles.cycleSteps}>
        {rows.map(([when, what]) => (
          <li key={when}>
            <strong dir="ltr">{when}</strong>
            <span>{what}</span>
          </li>
        ))}
      </ol>
      <p className={styles.diagramNote}>
        Collection never sleeps; the edition is daily. That is the whole rhythm: a continuous intake, one
        published brief per day, and a public record that stays correctable afterwards.
      </p>
    </div>
  );
}

/** Where the system publishes: the three public surfaces. */
export function OutputsFork() {
  return (
    <nav className={styles.outputMap} aria-label="Where the system publishes">
      <p className={styles.outputRoot}>
        <i aria-hidden="true" />
        The public record
      </p>
      <Link href="/geopolitical-brief">
        <strong>The Daily Brief</strong>
        <small>Today&rsquo;s edition, with the lead and the featured story</small>
      </Link>
      <Link href="/updates">
        <strong>Updates</strong>
        <small>Every entry, newest first, with the minute and route it published by</small>
      </Link>
      <Link href="/fact-check">
        <strong>Fact check</strong>
        <small>Claims in circulation, the verdict, and the evidence chain</small>
      </Link>
    </nav>
  );
}
