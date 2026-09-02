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
 * One checked claim, from what was said to what this desk answers.
 *
 * Five rungs, in the order a reader needs them:
 *
 *   1 CLAIM     — the circulating statement, verbatim, plus who is carrying it
 *                 and where. `exactClaim` is quoted, never paraphrased: a fact
 *                 check that restates the claim in its own words has already
 *                 begun answering it.
 *   2 EVIDENCE  — the public source chain, `passages[].sources[]`.
 *   3 ANALYSIS  — each statement beside what it rests on, drawn by
 *                 `EvidenceChain`; rungs 2 and 3 are one figure because the
 *                 whole point is that they are not separable.
 *   4 VERDICT   — `verificationState`, `evidenceBasis`, and what the verdict
 *                 does *not* settle. `knownUnknowns` sits inside the verdict
 *                 rather than after it, because a finding presented without
 *                 its limits is the shape of the thing this desk documents.
 *   5 RESPONSE  — `israeliPosition` and `securityContext`, labelled as stated
 *                 positions rather than as findings. They are context this
 *                 record carries, not evidence it produced.
 *
 * Nothing here upgrades a grade. A record whose `verificationState` is
 * `unresolved` renders as unresolved; `evidenceBasis: "analysis"` is disclosed
 * on the verdict itself, at the same size as the verdict, not in a footnote.
 */
export function ClaimLadder({ record }: { record: PublicPublicationDetail }) {
  const details = record.narrativeWatchDetails;
  if (!details) return null;

  const verdict = VERIFICATION_STATES[details.verificationState];
  const analysis = isAnalysisBasis(details);
  const onFile = details.supportingEvidenceIds.length + details.contradictingEvidenceIds.length;

  return (
    <div className={styles.ladder}>
      <section className={styles.rungBlock} aria-label="The claim">
        <h3 className={styles.rungLabel}>
          <span aria-hidden="true">01</span> The claim
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

      <section className={styles.rungBlock} aria-label="Evidence and analysis">
        <h3 className={styles.rungLabel}>
          <span aria-hidden="true">02</span> Evidence, and what rests on it
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
            No statement-level source chain is published for this record.
          </p>
        )}

        {onFile > 0 ? (
          <p className={styles.onFile}>
            {details.supportingEvidenceIds.length} supporting and{" "}
            {details.contradictingEvidenceIds.length} contradicting evidence
            records are held on file. The evidence table itself is not public,
            so those records are counted here and not shown.
          </p>
        ) : null}
      </section>

      <section className={styles.rungBlock} aria-label="Verdict">
        <h3 className={styles.rungLabel}>
          <span aria-hidden="true">03</span> Verdict
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
        {details.knownUnknowns.length ? (
          <div className={styles.unknowns}>
            <KnownUnknownPanel unknowns={details.knownUnknowns} />
          </div>
        ) : null}
      </section>

      {details.israeliPosition || details.securityContext ? (
        <section className={styles.rungBlock} aria-label="Stated positions and context">
          <h3 className={styles.rungLabel}>
            <span aria-hidden="true">04</span> Position and context
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
            evidence the verdict above rests on.
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
