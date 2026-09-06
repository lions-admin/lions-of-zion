import { ResearchText } from '@/components/content';
import type { ResearchCase } from '@/lib/content/fake-resistance-cases';
import type { InvestigationModel } from '@/lib/content/investigation-model';
import { dateLabel } from './labels';
import styles from './investigation.module.css';

/**
 * What is not established — every case ends here.
 *
 * Four kinds of limit, kept apart because they mean different things: what
 * the research could not establish, what it says would change its reading,
 * how the sample was gathered and what that caps, and the mechanical limits
 * the data itself carries (unresolved operators, quote trees the page cap
 * stopped, empty tree results, the age of the snapshot). The last group is
 * computed from the record rather than written, so it cannot go stale
 * against the data.
 */
export function UnknownsPanel({
  record,
  model,
}: {
  record: ResearchCase;
  model: InvestigationModel;
}) {
  const unresolved = model.entities.filter((e) => e.identityStatus === 'unresolved');
  const capped = model.firstQuoters.filter((r) => r.treeState === 'capped');
  const empty = model.firstQuoters.filter((r) => r.treeState === 'empty_inconclusive');
  const inferred = model.edges.filter((e) => e.kind === 'inferred');

  return (
    <div className={styles.unknowns}>
      {record.unknowns.length > 0 ? (
        <section className={styles.unknownGroup}>
          <h3>Not established</h3>
          <ul>
            {record.unknowns.map((item) => (
              <li key={item.slice(0, 60)}>
                <ResearchText>{item}</ResearchText>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {record.wouldChange.length > 0 ? (
        <section className={styles.unknownGroup}>
          <h3>What would change the assessment</h3>
          <ul>
            {record.wouldChange.map((item) => (
              <li key={item.slice(0, 60)}>
                <ResearchText>{item}</ResearchText>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {record.limitations.length > 0 ? (
        <section className={styles.unknownGroup}>
          <h3>Sampling limits</h3>
          <ul>
            {record.limitations.map((item) => (
              <li key={item.slice(0, 60)}>
                <ResearchText>{item}</ResearchText>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.unknownGroup}>
        <h3>Limits the data carries</h3>
        <ul>
          <li>
            Every follower count and engagement figure is a snapshot; the file was last updated{' '}
            <time dateTime={record.updatedAt}>{dateLabel(record.updatedAt)}</time> and figures
            drift afterwards.
          </li>
          {unresolved.length > 0 ? (
            <li>
              {unresolved.length} {unresolved.length === 1 ? 'account' : 'accounts'} in the roster{' '}
              {unresolved.length === 1 ? 'has' : 'have'} an unresolved operator:{' '}
              {unresolved.map((e) => (e.handle ? `@${e.handle}` : e.name)).join(', ')}. Nothing
              on this page attributes those accounts to a person.
            </li>
          ) : null}
          {inferred.length > 0 ? (
            <li>
              {inferred.length} {inferred.length === 1 ? 'connection is' : 'connections are'} inferred
              coordination — a statistical pattern against a null model, not an established
              relationship. Each carries its p-value and sample size in the flows section.
            </li>
          ) : null}
          {capped.length > 0 ? (
            <li>
              {capped.length} quote {capped.length === 1 ? 'tree was' : 'trees were'} stopped by
              the page cap, so the earliest quoter recorded there is not necessarily the earliest
              quoter.
            </li>
          ) : null}
          {empty.length > 0 ? (
            <li>
              {empty.length} quote {empty.length === 1 ? 'tree' : 'trees'} returned empty after
              retries. That is recorded as inconclusive, not as “no amplification”.
            </li>
          ) : null}
          {model.narratives.length > 0 ? (
            <li>
              Accounts are tied to narratives, findings and events because the research’s own
              wording names them. A name in a sentence is a pointer, not a finding of
              responsibility.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
