import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { isAnalysisBasis } from "@/server/contracts/publication";
import type { PublicPublication } from "@/server/contracts/publication";
import { clock, stamp } from "./feed-time";
import { SECTION_LABELS, VERIFICATION_STATES } from "./publication-labels";
import styles from "./live-feed.module.css";
import { Badge, type BadgeStatus } from "@/components/ui/Badge";

/**
 * One entry in the record.
 *
 * The row's whole job is provenance: when, by what route, on what basis.
 * Facts are drawn from the public projection and none is inferred:
 *
 *   · `publishedAt` — the exact minute, absolute, never relative.
 *   · `autoPublishedAt` — whether the machine published this or an editor did.
 *     This is the one genuinely interesting signal the projection carries that
 *     nothing on the site currently shows, and it is the page's signature: a
 *     filled mark for automatic, a hollow one for an editor's hand.
 *   · `updatedAt` — a revision, shown only when it differs from publication.
 *   · `evidenceBasis` — for a Narrative Watch record, whether it cites sources
 *     at all. Read `=== "analysis"` via `isAnalysisBasis`, never the negation:
 *     rows predating the field carry no key and must fall to the strict side.
 *   · related record — `editorialTopic`, `primaryActor`, and `arena` when the
 *     projection carries them, beside the title link to `/articles/{publicId}`.
 *
 * The title links to `/articles/{publicId}`, which stays the canonical home of
 * the record. This feed is an index over it, not a second copy of it.
 */
/** A machine facet — `international_arms_sales` — printed as words. The
 *  projection's value is unchanged; only the underscores are combed. */
function words(value: string): string {
  return value.replaceAll("_", " ");
}

export function UpdateEntry({ entry }: { entry: PublicPublication }) {
  const automatic = entry.autoPublishedAt !== null;
  const revised = entry.updatedAt !== entry.publishedAt;
  const details = entry.narrativeWatchDetails;
  const analysis = isAnalysisBasis(details);
  const verdict = details ? VERIFICATION_STATES[details.verificationState] : null;

  return (
    <Card as="li" variant="row" className={styles.entry}>
      <p className={styles.dateline}>
        <time className={styles.clock} dateTime={entry.publishedAt} title={stamp(entry.publishedAt)}>
          {clock(entry.publishedAt)}
        </time>
        <span className={styles.section}>{SECTION_LABELS[entry.section]}</span>
        {/* The mark and its words travel together. A mark alone would be a
            legend the reader has to hold in their head, and a legend is where
            an honest signal quietly becomes decoration. */}
        <span className={styles.route} data-route={automatic ? "auto" : "editor"}>
          <i aria-hidden="true" />
          {automatic ? "Published automatically" : "Published by an editor"}
        </span>
      </p>

      <CardTitle className={styles.title}>
        <Link href={`/articles/${entry.publicId}`}>{entry.title}</Link>
      </CardTitle>

      {entry.summary ? (
        <CardDescription className={styles.summary}>{entry.summary}</CardDescription>
      ) : null}

      {verdict || analysis || revised || entry.arena || entry.primaryActor || entry.editorialTopic ? (
        <p className={styles.marks}>
          {/* One verdict renderer (SYS-011, finished 2026-09-16). This chip
              drew the same word as the record it links to from its own three
              tone rules, and it put the meaning in a `title` — which a touch
              reader cannot open at all, and which was the last tooltip
              carrying meaning on a public surface. `Badge` gives the state
              its ramp AND its shape, so it survives greyscale, and the
              meaning goes where a screen reader will read it. */}
          {verdict && details ? (
            <Badge
              status={details.verificationState as BadgeStatus}
              aria-label={`${verdict.label}: ${verdict.meaning}`}
            >
              {verdict.label}
            </Badge>
          ) : null}
          {analysis ? (
            <span className={styles.basis}>Our own analysis &mdash; cites no source</span>
          ) : null}
          {entry.editorialTopic ? <span className={styles.facet}>{words(entry.editorialTopic)}</span> : null}
          {entry.primaryActor ? <span className={styles.facet}>{words(entry.primaryActor)}</span> : null}
          {entry.arena ? <span className={styles.facet}>{words(entry.arena)}</span> : null}
          {revised ? (
            <span className={`${styles.facet} ${styles.revised}`}>
              <span>Revised</span>
              <time dateTime={entry.updatedAt}>{stamp(entry.updatedAt)}</time>
            </span>
          ) : null}
        </p>
      ) : null}
    </Card>
  );
}
