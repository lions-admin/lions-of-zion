import { FEED_REVALIDATE_SECONDS } from "./feed-time";
import styles from "./live-feed.module.css";

/**
 * What this feed is, stated before the feed.
 *
 * This strip exists because the obvious design for a page called "Updates" is
 * a pulsing green dot and the word LIVE, and that would be false. The reads
 * behind this page go through `unstable_cache(..., { revalidate: 300 })` in
 * `lib/publications.ts`, so what a reader sees is the published record as of
 * *some* moment in the last five minutes — never the current instant, and with
 * no way from here to know which moment it was. A liveness signal would be
 * inventing precision the system does not have.
 *
 * So the strip says the true thing instead, and says it in the data face at
 * the top of the page rather than in eight-point grey at the bottom. On a site
 * that publishes a playbook of manipulation techniques, the disclosure is not
 * a footnote to the feature — it is part of the feature.
 *
 * Nothing here animates and nothing here counts up. `Ticker` would be a
 * plausible flourish on the entry count and is deliberately not used: an
 * animated number implies a number that changes.
 */
export function FeedStatus({
  entryCount,
  filtered,
}: {
  entryCount: number;
  filtered: boolean;
}) {
  const minutes = Math.round(FEED_REVALIDATE_SECONDS / 60);

  return (
    <section className={styles.status} aria-labelledby="feed-status-heading">
      <h2 className={styles.statusHeading} id="feed-status-heading">
        About this feed
      </h2>
      <dl className={styles.statusGrid}>
        <div>
          <dt>Source</dt>
          <dd>The published record</dd>
        </div>
        <div>
          <dt>Refresh</dt>
          <dd>
            At most every {minutes} minutes
          </dd>
        </div>
        <div>
          <dt>{filtered ? "Shown" : "On this page"}</dt>
          <dd>
            <span className={styles.statusFigure}>{entryCount}</span>{" "}
            {entryCount === 1 ? "entry" : "entries"}
          </dd>
        </div>
        <div>
          <dt>Times</dt>
          <dd>Jerusalem, 24-hour</dd>
        </div>
      </dl>
      <p className={styles.statusNote}>
        This is not a realtime wire. Each entry carries the exact minute it was
        published, but the list itself is rebuilt on a {minutes}-minute cycle, so
        something published a moment ago may not be here yet. Nothing on this
        page updates while you read it &mdash; reload to see the current record.
      </p>
    </section>
  );
}
