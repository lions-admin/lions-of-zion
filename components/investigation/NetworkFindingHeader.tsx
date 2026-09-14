import { ResearchText } from '@/components/content';
import { parseRefutation, refutationLabel } from '@/components/research/research-prose';
import type { NetworkMetrics } from '@/lib/content/fake-resistance-cases';
import styles from './investigation.module.css';

/**
 * The network's opening finding — what a reader gets above the fold.
 *
 * This is `CaseStoryHeader` for the cross-case synthesis, and it exists for
 * the same reason. The case pages were given a finding-first opening
 * deliberately; `/fake-resistance/network` never got one, and it showed. The
 * page used to begin "This synthesis integrates empirical findings from eight
 * targeted investigations (01-hinkle-machine through 08-cross-cluster-network),
 * analyzing a combined corpus of 33,354 posts, 213 resolved entities, 708
 * graded relationships, and 40,000 follower samples" — a methods sentence —
 * and buried the actual result, a double refutation, in the next block of
 * running prose with its two numbered halves flattened into the paragraph.
 *
 * The order here is the one the case pages already use: what survives, how to
 * hold it, then the size of what was looked at. The corpus statistics are
 * still on the page and still first-screen, but they now read as what they
 * are — corroboration for a finding the reader has already met, rather than
 * the finding's replacement.
 *
 * Nothing in the refutations is written here. Each is the research's own
 * sentence, and each label is derived from the model the research names in its
 * own text (`Against the "monolithic conspiracy" model:` → "Not a monolithic
 * conspiracy"). The one piece of desk copy is `lede`, which the page supplies.
 */
export function NetworkFindingHeader({
  question,
  lede,
  findings,
  metrics,
  corroboration,
  findingsHref = '#findings',
  exploreHref = '#explore',
}: {
  /** The research question, as the packet states it. */
  question: string;
  /** The desk's plain-language framing of what the findings below amount to. */
  lede: string;
  /** The findings that survived the contradiction pass, in the packet's order. */
  findings: readonly string[];
  metrics: NetworkMetrics;
  /** The methods sentence, demoted to the corroboration it is. */
  corroboration?: string;
  findingsHref?: string;
  exploreHref?: string;
}) {
  /* An empty statement renders nothing at all. A numbered list whose rows can
     be blank is worse than a shorter list: the counter still advances and the
     reader is told a finding exists that nobody can read. A finding with no
     recognisable model name keeps its sentence and loses only the label. */
  const refutations = findings
    .map((finding) => parseRefutation(finding))
    .filter((refutation) => refutation.statement !== '');
  const number = new Intl.NumberFormat('en');

  return (
    <div className={styles.storyHeader}>
      <p className={styles.storyQuestion}>
        <span className={styles.storyQuestionLabel}>What was asked</span>
        {question}
      </p>

      <div className={styles.survives}>
        <span className={styles.survivesLabel}>What survives</span>
        <p>{lede}</p>
      </div>

      {refutations.length > 0 ? (
        <ol className={styles.refutations}>
          {refutations.map((refutation) => (
            <li key={refutation.statement.slice(0, 48)}>
              {refutation.model ? (
                <p className={styles.refutationLabel}>{refutationLabel(refutation.model)}</p>
              ) : null}
              <p className={styles.refutationStatement}>
                <ResearchText>{refutation.statement}</ResearchText>
              </p>
            </li>
          ))}
        </ol>
      ) : null}

      <p className={styles.storyConfidence}>
        Each of these was tested against evidence that would have broken it, and held.{' '}
        <a href={findingsHref}>Read the findings in full</a>, or{' '}
        <a href={exploreHref}>open every recorded connection</a>.
      </p>

      {/* The numbers, after the finding rather than in front of it. They are
          the computed graph's own metrics, not a count of the roster table. */}
      <dl className={styles.storyFacts}>
        <div>
          <dt>Accounts</dt>
          <dd>{metrics.nodes !== undefined ? number.format(metrics.nodes) : 'Not stated'}</dd>
        </div>
        <div>
          <dt>Recorded connections</dt>
          <dd>{metrics.edges !== undefined ? number.format(metrics.edges) : 'Not stated'}</dd>
        </div>
        <div>
          <dt>Computed communities</dt>
          <dd>
            {metrics.communities !== undefined ? number.format(metrics.communities) : 'Not stated'}
            {metrics.bridges !== undefined ? ` · ${number.format(metrics.bridges)} bridges` : ''}
          </dd>
        </div>
        <div>
          <dt>Pairs the coordination test touched</dt>
          <dd>
            {metrics.coordinationEdges !== undefined
              ? number.format(metrics.coordinationEdges)
              : 'Not stated'}
          </dd>
        </div>
      </dl>

      {corroboration ? (
        <p className={styles.storyCorroboration}>
          <ResearchText>{corroboration}</ResearchText>
        </p>
      ) : null}
    </div>
  );
}
