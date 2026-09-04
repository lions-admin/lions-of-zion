import Link from "next/link";
import styles from "@/components/briefs/information-war-system.module.css";

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
      <p className={styles.cycleLoop} aria-hidden="true">
        <span>↺</span> The edition feeds back into continuous monitoring — the loop never closes.
      </p>
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
