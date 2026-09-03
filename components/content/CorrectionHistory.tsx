import Link from 'next/link';
import styles from './content.module.css';

export type Correction = {
  date: string;
  note: string;
  version?: string;
  /**
   * The corrected record, when the log knows where it is (CORR-001).
   *
   * Optional on purpose. Inside an article or a claim ladder the correction
   * already sits on the record it applies to, so there is nothing to link
   * to; on the sitewide ledger at `/corrections` an entry is detached from
   * its record and a reader has to be able to reach it. `CorrectionsLogEntry`
   * in `lib/content/corrections.ts` carries the `page` and `slug` this is
   * built from, and the ledger only passes it when both are present — a
   * "corrected record" link that leads nowhere is worse than none.
   */
  href?: string;
  /** What the correction applied to — the label for `href`, or a plain
   *  context line when the record is not linkable. */
  context?: string;
};

export type CorrectionHistoryProps = {
  corrections: Correction[];
};

/**
 * The correction history of one record, and the shape the sitewide ledger
 * reuses.
 *
 * The empty branch stays deliberately plain here. `/corrections` never
 * reaches it — that page renders its own "no corrections recorded" state,
 * distinct from a load failure, because on a public ledger those two look
 * identical if nobody makes them different. The two other callers
 * (`app/articles/[publicId]`, `components/factcheck/ClaimLadder`) render this
 * component only when there is at least one correction, so "None recorded"
 * is the fallback for a caller that has not thought about it, not a state a
 * reader is routinely shown.
 */
export function CorrectionHistory({ corrections }: CorrectionHistoryProps) {
  return (
    <div className={styles.corrections}>
      <span className={styles.correctionsKicker}>Correction history</span>
      {corrections.length ? (
        <ol>
          {corrections.map((correction) => (
            <li key={`${correction.date}-${correction.version ?? ''}`}>
              <span className={styles.correctionStamp}>
                <time>{correction.date}</time>
                {correction.version ? <small>{correction.version}</small> : null}
              </span>
              <div className={styles.correctionEntry}>
                <p>{correction.note}</p>
                {correction.href ? (
                  <Link className={styles.correctionRecord} href={correction.href}>
                    {correction.context ?? 'Corrected record'}
                  </Link>
                ) : correction.context ? (
                  <p className={styles.correctionContext}>{correction.context}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.correctionsEmpty}>None recorded</p>
      )}
    </div>
  );
}
