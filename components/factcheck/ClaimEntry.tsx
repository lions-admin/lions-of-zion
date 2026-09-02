import Link from "next/link";
import { Reveal } from "@/components/motion";
import { VERIFICATION_STATES } from "@/components/live/publication-labels";
import { stamp } from "@/components/live/feed-time";
import { isAnalysisBasis } from "@/server/contracts/publication";
import type { PublicPublication, PublicPublicationDetail } from "@/server/contracts/publication";
import { ClaimLadder } from "./ClaimLadder";
import styles from "./fact-check.module.css";

/**
 * One row of the desk: a claim, its verdict, and the whole ladder underneath.
 *
 * `<details>`/`<summary>` rather than a state hook, and that is the load-bearing
 * choice here. It opens with JavaScript off, it is keyboard-operable and
 * announced without a single ARIA attribute, and it means this page ships no
 * client component at all. A disclosure widget built in React would be worse in
 * every one of those respects and better in none.
 *
 * The verdict is *outside* the disclosure, so it is visible closed. A reader
 * scanning for the claim they saw online gets the answer without opening
 * anything; opening it is for the reader who wants to see the work. Hiding the
 * verdict behind the toggle would be engagement bait, and this desk publishes a
 * playbook chapter about that.
 */
export function ClaimEntry({
  record,
  detail,
  open,
  index = 0,
}: {
  record: PublicPublication;
  /** The full record, when it was fetched. Absent rows link out instead. */
  detail?: PublicPublicationDetail;
  /** Whether this row starts open. Used for the first row only. */
  open?: boolean;
  /** Position in the desk, for the entrance stagger. */
  index?: number;
}) {
  const details = record.narrativeWatchDetails;
  if (!details) return null;

  const verdict = VERIFICATION_STATES[details.verificationState];
  const analysis = isAnalysisBasis(details);

  /* `Reveal` renders the `<li>` itself rather than a wrapper around one. An
     `<ol>` may contain only `<li>`, and a `display: contents` div between them
     fixes the layout while leaving the document invalid. */
  return (
    <Reveal as="li" className={styles.entry} index={index}>
      <p className={styles.entryHead}>
        <span className={styles.entryVerdict} data-tone={verdict.tone}>
          {verdict.label}
        </span>
        {analysis ? <span className={styles.entryBasis}>Own analysis</span> : null}
        <time className={styles.entryStamp} dateTime={record.publishedAt}>
          {stamp(record.publishedAt)}
        </time>
      </p>

      {detail ? (
        <details className={styles.disclosure} open={open}>
          <summary className={styles.summary}>
            <span className={styles.claimText}>{details.exactClaim}</span>
            <span className={styles.summaryHint} aria-hidden="true" />
          </summary>
          <ClaimLadder record={detail} />
        </details>
      ) : (
        <>
          <p className={styles.claimText}>{details.exactClaim}</p>
          <p className={styles.entryLink}>
            <Link href={`/articles/${record.publicId}`}>
              See how this one was checked <span aria-hidden="true">&rarr;</span>
            </Link>
          </p>
        </>
      )}
    </Reveal>
  );
}
