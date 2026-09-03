import { VerificationBadge } from "@/components/content";
import { ASSESSMENT_VALUES } from "@/server/contracts/enums";
import type { AssessmentValue } from "@/server/contracts/enums";
import type { PublicPublicationDetail } from "@/server/contracts/publication";
import styles from "./fact-check.module.css";

type Passage = PublicPublicationDetail["passages"][number];

/**
 * `passages[].sources[]` is the only public evidence chain that exists, and
 * this is what it looks like drawn.
 *
 * Each rung is one statement the record makes, labelled as cited or not, with
 * the sources that statement rests on hanging off it in document order. An
 * uncited statement is not hidden and not quietly dropped: it is marked in
 * words, because "which sentences are sourced and which are not" is the single
 * most useful thing a reader can know about a fact check, and a chain that
 * only draws its strong links is not a chain. The left-edge rule is a second
 * cue, never the only one.
 *
 * Everything under `server/modules/assessments/` — the ten confidence
 * dimensions, the evidence-link table with its supporting/contradicting
 * relations — is staff-only and has no public projection. This component
 * therefore does not grade evidence, weigh it, or score it. It shows what is
 * cited, by whom, and where the citation is missing.
 */
export function EvidenceChain({ passages }: { passages: Passage[] }) {
  const cited = passages.filter((passage) => passage.sources.length > 0).length;
  const sourceCount = passages.reduce((total, passage) => total + passage.sources.length, 0);

  return (
    <div className={styles.chain}>
      <p className={styles.chainCount}>
        Source count:{" "}
        <span className={styles.chainFigure}>{sourceCount}</span>{" "}
        {sourceCount === 1 ? "source" : "sources"} across{" "}
        <span className={styles.chainFigure}>{cited}</span> of{" "}
        <span className={styles.chainFigure}>{passages.length}</span>{" "}
        {passages.length === 1 ? "statement" : "statements"}
      </p>

      <ol className={styles.chainList}>
        {passages.map((passage) => {
          const hasSources = passage.sources.length > 0;
          return (
            <li
              className={styles.rung}
              key={passage.position}
              value={passage.position}
              data-cited={hasSources ? "true" : "false"}
            >
              <p className={styles.rungMeta}>
                Statement {passage.position}
                <span>{hasSources ? "Cited" : "No source attached"}</span>
              </p>

              <p className={styles.rungText}>{passage.text}</p>

              {passage.claim ? (
                <p className={styles.rungClaim}>
                  <span>Claim record</span>
                  {passage.claim.title}
                  {isAssessment(passage.claim.assessment) ? (
                    <VerificationBadge assessment={passage.claim.assessment} />
                  ) : null}
                </p>
              ) : null}

              {hasSources ? (
                <ul className={styles.rungSources}>
                  {passage.sources.map((source, index) => (
                    <li key={`${source.url ?? source.title}-${index}`}>
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title}
                        </a>
                      ) : (
                        <span>{source.title}</span>
                      )}
                      <small>{source.publisher}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.rungUncited}>No source is attached to this statement.</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The projection types `assessment` as a bare `string | null`, so a value from
 * the database that is not one of the nine would be handed to
 * `VerificationBadge`, which indexes an exhaustive record and would render
 * `undefined.label`. Narrowing here is what keeps that a missing badge instead
 * of a crashed page.
 */
function isAssessment(value: string | null): value is AssessmentValue {
  return value !== null && (ASSESSMENT_VALUES as readonly string[]).includes(value);
}
