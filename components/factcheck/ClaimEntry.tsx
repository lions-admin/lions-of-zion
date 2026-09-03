import Link from "next/link";
import { Reveal } from "@/components/motion";
import { Card } from "@/components/ui/Card";
import { VERIFICATION_STATES } from "@/components/live/publication-labels";
import { stamp } from "@/components/live/feed-time";
import { isAnalysisBasis } from "@/server/contracts/publication";
import type { PublicPublication, PublicPublicationDetail } from "@/server/contracts/publication";
import { FACT_CHECK_PATH } from "./paths";
import { ClaimLadder } from "./ClaimLadder";
import styles from "./fact-check.module.css";

export function claimAnchorId(publicId: string): string {
  return `claim-${publicId}`;
}

export function claimPermalink(publicId: string): string {
  return `${FACT_CHECK_PATH}?claim=${encodeURIComponent(publicId)}#${claimAnchorId(publicId)}`;
}

/**
 * One row of the desk: a claim, its verdict, and the ladder underneath.
 *
 * `<details>`/`<summary>` rather than a state hook, and that is the load-bearing
 * choice here. It opens with JavaScript off, it is keyboard-operable and
 * announced without a single ARIA attribute, and it means this page ships no
 * client component of its own. A disclosure widget built in React would be
 * worse in every one of those respects and better in none.
 *
 * Collapsed, the summary has to be enough to decide whether to expand: verdict
 * (text, never colour alone), the circulating claim, evidence counts when the
 * public detail actually carries them, last updated, and — when the full record
 * was fetched — the verification meaning string as the rationale. Nothing here
 * invents a confidence grade or a rationale field.
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
  /** Whether this row starts open. First row, or the `?claim=` match. */
  open?: boolean;
  /** Position in the desk, for the entrance stagger. */
  index?: number;
}) {
  const details = record.narrativeWatchDetails;
  if (!details) return null;

  const verdict = VERIFICATION_STATES[details.verificationState];
  const analysis = isAnalysisBasis(details);
  const revised = record.updatedAt !== record.publishedAt;
  const stampAt = revised ? record.updatedAt : record.publishedAt;
  /* Supporting/contradicting ids are a public field on the detail. List-only
     rows may not have them in a form this desk can trust — do not invent a
     strength for those. */
  const counted = detail?.narrativeWatchDetails;
  const supporting = counted?.supportingEvidenceIds.length;
  const contradicting = counted?.contradictingEvidenceIds.length;
  const showCounts =
    supporting !== undefined && contradicting !== undefined && (supporting > 0 || contradicting > 0);
  const rationale = detail ? verdict.meaning : null;

  /* `Reveal` renders the `<li>` itself rather than a wrapper around one. An
     `<ol>` may contain only `<li>`, and a `display: contents` div between them
     fixes the layout while leaving the document invalid. Card is the row
     surface, not the link: a nested disclosure and a fallback article link
     cannot sit inside an outer `<a>`. */
  return (
    <Reveal as="li" className={styles.entryItem} index={index}>
      <Card variant="row" className={styles.entry}>
        <details
          className={styles.disclosure}
          id={claimAnchorId(record.publicId)}
          open={open || undefined}
        >
          <summary className={styles.summary}>
            <span className={styles.summaryBody}>
              <span className={styles.entryHead}>
                <span className={styles.entryVerdict} data-tone={verdict.tone}>
                  {verdict.label}
                </span>
                {analysis ? <span className={styles.entryBasis}>Own analysis</span> : null}
                {showCounts ? (
                  <span className={styles.entryStrength}>
                    {supporting} supporting · {contradicting} contradicting
                  </span>
                ) : null}
                <time className={styles.entryStamp} dateTime={stampAt}>
                  {revised ? `Updated ${stamp(stampAt)}` : stamp(stampAt)}
                </time>
              </span>
              {/* Already styled at the h3 type role; it was simply not a
                  heading, which left the ladder's rungs jumping h1 -> h3 and
                  gave a screen-reader user no way to list the claims on the
                  page. A heading inside a `<summary>` is valid and is the
                  pattern accordions use. */}
              <h2 className={styles.claimText}>{details.exactClaim}</h2>
              {rationale ? <span className={styles.entryRationale}>{rationale}</span> : null}
            </span>
            <span className={styles.summaryHint} aria-hidden="true" />
          </summary>

          {detail ? (
            <ClaimLadder record={detail} />
          ) : (
            <p className={styles.entryLink}>
              <Link href={`/articles/${record.publicId}`}>
                See how this one was checked <span aria-hidden="true">&rarr;</span>
              </Link>
            </p>
          )}

          <p className={styles.permalink}>
            <Link href={claimPermalink(record.publicId)}>Link to this check</Link>
          </p>
        </details>
      </Card>
    </Reveal>
  );
}
