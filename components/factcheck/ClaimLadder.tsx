import Link from "next/link";
import { CorrectionHistory, KnownUnknownPanel } from "@/components/content";
/* Imported from the source modules rather than the `@/components/live`
   barrel: that barrel re-exports the feed, which pulls `Reveal`, `StatusState`
   and `live-feed.module.css` into this route's graph for the sake of a label
   map. `package.json` declares CSS as a side effect, so a bundler cannot drop
   the stylesheet on its own. */
import { TREND_LABELS, VERIFICATION_STATES } from "@/components/live/publication-labels";
import { stamp } from "@/components/live/feed-time";
import { ANALYSIS_AUTHOR, isAnalysisBasis } from "@/server/contracts/publication";
import type { PublicPublicationDetail } from "@/server/contracts/publication";
import { EvidenceChain } from "./EvidenceChain";
import styles from "./fact-check.module.css";

/**
 * The work behind a check, as a linear evidence path.
 *
 * Numbered rungs, in document order — the same order a screen reader walks:
 *
 *   01 CLAIM          — the circulating statement, verbatim, plus who is
 *                       carrying it and where. `exactClaim` is quoted, never
 *                       paraphrased.
 *   02 SOURCES        — source count and the public chain, `passages[].sources[]`.
 *   03 CONTRADICTIONS — how many contradicting records are held on file.
 *                       Textual; the table itself is not public.
 *   04 UNKNOWNS       — `knownUnknowns`, still text, or a statement that none
 *                       are recorded.
 *   05 ASSESSMENT     — `verificationState`, its meaning, and the evidence basis.
 *
 * Position and context follow when the record carries them. They are labelled
 * as stated positions, not as a sixth finding. The left-edge rule on a chain
 * rung is never the only relationship cue: every rung has a heading, and every
 * uncited statement says so in words.
 */
export function ClaimLadder({ record }: { record: PublicPublicationDetail }) {
  const details = record.narrativeWatchDetails;
  if (!details) return null;

  const verdict = VERIFICATION_STATES[details.verificationState];
  const analysis = isAnalysisBasis(details);
  const supporting = details.supportingEvidenceIds.length;
  const contradicting = details.contradictingEvidenceIds.length;

  return (
    <div className={styles.ladder}>
      <section className={styles.rungBlock}>
        <h3 className={styles.rungLabel}>
          <span>01</span> The claim
        </h3>
        <blockquote className={styles.claimQuote}>
          <p>{details.exactClaim}</p>
        </blockquote>
        <dl className={styles.claimFacts}>
          <div>
            <dt>Carried by</dt>
            <dd>
              {details.propagators.length
                ? details.propagators.join(", ")
                : "No attributable propagator is recorded."}
            </dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>{details.arenas.join(", ")}</dd>
          </div>
          <div>
            <dt>Circulation</dt>
            <dd>{TREND_LABELS[details.trendDirection]}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.rungBlock}>
        <h3 className={styles.rungLabel}>
          <span>02</span> Sources
        </h3>
        {analysis ? (
          /* An analysis record cites nothing anywhere — that is the rule, not
             a gap in this page, and `EvidenceChain` over zero-source passages
             would print a column of "no source attached" and read as a
             malfunction. State the position instead. */
          <p className={styles.analysisNote}>
            This record answers the claim from our own reasoning and cites no
            documentary source. That is a deliberate, all-or-nothing state:
            {" "}{ANALYSIS_AUTHOR} either cites its evidence throughout or
            declares that it has none. Read what follows as our assessment, not
            as documented fact.
          </p>
        ) : record.passages.length ? (
          <EvidenceChain passages={record.passages} />
        ) : (
          <p className={styles.emptyRung}>
            Source count: none. No statement-level source chain is published
            for this record.
          </p>
        )}
        {supporting > 0 ? (
          <p className={styles.onFile}>
            {supporting} supporting evidence{" "}
            {supporting === 1 ? "record is" : "records are"} held on file. The
            evidence table itself is not public, so those records are counted
            here and not shown.
          </p>
        ) : null}
      </section>

      <section className={styles.rungBlock}>
        <h3 className={styles.rungLabel}>
          <span>03</span> Contradictions
        </h3>
        <p className={styles.onFile}>
          {contradicting > 0
            ? `${contradicting} contradicting evidence ${
                contradicting === 1 ? "record is" : "records are"
              } held on file. The evidence table itself is not public, so those records are counted here and not shown.`
            : "No contradicting evidence records are held on file."}
        </p>
      </section>

      <section className={styles.rungBlock}>
        <h3 className={styles.rungLabel}>
          <span>04</span> Unknowns
        </h3>
        {details.knownUnknowns.length ? (
          <div className={styles.unknowns}>
            <KnownUnknownPanel unknowns={details.knownUnknowns} />
          </div>
        ) : (
          <p className={styles.emptyRung}>No known unknowns are recorded.</p>
        )}
      </section>

      <section className={styles.rungBlock}>
        <h3 className={styles.rungLabel}>
          <span>05</span> Assessment
        </h3>
        <p className={styles.verdictLine}>
          <span className={styles.verdictMark} data-tone={verdict.tone}>
            {verdict.label}
          </span>
          <span className={styles.verdictMeaning}>{verdict.meaning}</span>
        </p>
        <p className={styles.basisLine} data-basis={analysis ? "analysis" : "sourced"}>
          {analysis
            ? "Basis: our own analysis, citing no source."
            : "Basis: the public sources cited above."}
        </p>
      </section>

      {details.israeliPosition || details.securityContext ? (
        <section className={styles.rungBlock}>
          <h3 className={styles.rungLabel}>
            <span>06</span> Position and context
          </h3>
          {details.israeliPosition ? (
            <div className={styles.position}>
              <h4>Israel&rsquo;s stated position</h4>
              <p>{details.israeliPosition}</p>
            </div>
          ) : null}
          {details.securityContext ? (
            <div className={styles.position}>
              <h4>Security context</h4>
              <p>{details.securityContext}</p>
            </div>
          ) : null}
          <p className={styles.positionNote}>
            These are positions on record and the situation around the claim.
            They are stated here as context, and they are not part of the
            evidence the assessment above rests on.
          </p>
        </section>
      ) : null}

      <footer className={styles.ladderFoot}>
        <Link href={`/articles/${record.publicId}`} className={styles.readFull}>
          Read the full record <span aria-hidden="true">&rarr;</span>
        </Link>
        <p className={styles.ladderStamp}>
          Published <time dateTime={record.publishedAt}>{stamp(record.publishedAt)}</time>
          {record.updatedAt !== record.publishedAt ? (
            <>
              {" · Revised "}
              <time dateTime={record.updatedAt}>{stamp(record.updatedAt)}</time>
            </>
          ) : null}
        </p>
        {record.corrections.length ? (
          <div className={styles.correctionsHost}>
            <CorrectionHistory
              corrections={record.corrections.map((correction) => ({
                date: stamp(correction.changedAt),
                note: correction.summary,
                version: `v${correction.version}`,
              }))}
            />
          </div>
        ) : null}
      </footer>
    </div>
  );
}
