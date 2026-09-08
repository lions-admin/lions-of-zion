import Link from 'next/link';
import styles from './content.module.css';
import recordStyles from './correction-history.module.css';

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

/**
 * What a version note is, read from the note itself (UX-04).
 *
 * The public projection — `public_publication_corrections()` in migration
 * `0060` — publishes every post-v1 version of a live record as `summary`
 * text and nothing more: no change source, no field list, no flag saying
 * whether the words changed. A whole-site update that only attaches an
 * illustration therefore reaches the reader as "v4 — Attach the in-house
 * editorial cover illustration after production media materialization was
 * re-verified. Article substance unchanged." — an operator's changelog, and
 * the last thing on the page.
 *
 * So the class is decided from the note, and decided conservatively:
 *
 * - `attachment` — the note says something was attached (an illustration, a
 *   picture, a source stack) *and* says nothing that reads as a correction.
 *   On the audited record all three notes are of this kind; each one also
 *   says the substance is unchanged, which the pattern accepts on its own.
 * - `correction` — the note carries a correction verb. This wins over an
 *   attachment match: a note that corrects a caption while attaching the
 *   right photo is a correction, and an absent or mixed signal falls to the
 *   strict side, which is showing it in full.
 * - `unclassified` — neither. Never summarised; shown verbatim behind the
 *   version-history disclosure, so the reader can see what the data carries
 *   and nothing is invented for it.
 */
export type CorrectionClass = 'correction' | 'attachment' | 'unclassified';

const ATTACHMENT =
  /\b(?:re-?)?attach(?:ed|es|ing)?\b[\s\S]*?\b(?:illustration|image|picture|cover|photo\w*|media|source stack|sources?)\b|\b(?:substance|text|content|wording|body)\s+(?:is\s+|was\s+|remains\s+)?unchanged\b|\bno\s+changes?\s+to\s+the\s+(?:text|substance|content|wording|body)\b/i;

const CORRECTION =
  /\b(?:correct(?:s|ed|ion|ions|ing)?|retract\w*|clarif\w*|amend\w*|revis\w*|rewr\w*|withdr\w*|fix(?:ed|es)?|error\w*|inaccura\w*|mis(?:stat|attribut|identif|report)\w*|developing[\s-]story|updated?\s+(?:the\s+)?(?:headline|title|summary|body|text|claim|figure|number|date|toll|count))\b/i;

export function classifyCorrection(note: string): CorrectionClass {
  if (CORRECTION.test(note)) return 'correction';
  if (ATTACHMENT.test(note)) return 'attachment';
  return 'unclassified';
}

/** Whether a record's history holds anything a reader should be shown open. */
export function hasSubstantiveCorrections(corrections: readonly Correction[]): boolean {
  return corrections.some((correction) => classifyCorrection(correction.note) === 'correction');
}

/**
 * The one-line form of an attachment version — "Illustration attached" — read
 * from the words the note itself uses. A source stack is "Sources attached";
 * anything else that matched the attachment pattern is a picture of some
 * kind, which is what the copy table's line names.
 */
function attachmentLabel(note: string): string {
  return /\bsource stack\b|\bsources?\b/i.test(note) && !/\b(?:illustration|image|picture|cover|photo\w*)\b/i.test(note)
    ? 'Sources attached'
    : 'Illustration attached';
}

export type CorrectionHistoryProps = {
  corrections: Correction[];
  /**
   * `ledger` prints every entry verbatim — the sitewide `/corrections` page
   * and any caller that has not decided otherwise. `record` is the reading
   * surface of one record: substantive corrections open, attachment
   * versions collapsed to one line each, and everything the projection
   * carries kept verbatim behind a collapsed "Version history" disclosure.
   */
  variant?: 'ledger' | 'record';
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
export function CorrectionHistory({ corrections, variant = 'ledger' }: CorrectionHistoryProps) {
  if (variant === 'record' && corrections.length) {
    return <RecordHistory corrections={corrections} />;
  }
  return (
    <div className={styles.corrections}>
      <span className={styles.correctionsKicker}>Correction history</span>
      {corrections.length ? (
        <CorrectionList corrections={corrections} />
      ) : (
        <p className={styles.correctionsEmpty}>None recorded</p>
      )}
    </div>
  );
}

function CorrectionList({ corrections }: { corrections: readonly Correction[] }) {
  return (
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
  );
}

/**
 * The reading-surface form. Attachment versions collapse to one line per
 * label — two "Illustration attached" versions on the same record are one
 * fact, stated once with the latest date (the list arrives newest first, so
 * the first seen is the latest). Every note the projection carries, whatever
 * its class, stays verbatim under the disclosure: collapsing is a matter of
 * emphasis, never of omission.
 */
function RecordHistory({ corrections }: { corrections: readonly Correction[] }) {
  const substantive = corrections.filter((correction) => classifyCorrection(correction.note) === 'correction');
  const attachments = new Map<string, Correction>();
  for (const correction of corrections) {
    if (classifyCorrection(correction.note) !== 'attachment') continue;
    const label = attachmentLabel(correction.note);
    if (!attachments.has(label)) attachments.set(label, correction);
  }
  const showsHistory = substantive.length < corrections.length;

  return (
    <div className={styles.corrections}>
      {substantive.length ? (
        <>
          <span className={styles.correctionsKicker}>Correction history</span>
          <CorrectionList corrections={substantive} />
        </>
      ) : null}
      {attachments.size ? (
        <ul className={recordStyles.attachmentLines}>
          {[...attachments].map(([label, correction]) => (
            <li key={label}>
              <span>{label}</span>
              <span aria-hidden="true"> · </span>
              <time>{correction.date}</time>
            </li>
          ))}
        </ul>
      ) : null}
      {showsHistory ? (
        <details className={recordStyles.versionHistory}>
          <summary>Version history</summary>
          <CorrectionList corrections={corrections} />
        </details>
      ) : null}
    </div>
  );
}
