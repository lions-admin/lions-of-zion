import { ResearchText } from '@/components/content';
import type { ResearchCase } from '@/lib/content/fake-resistance-cases';
import type { InvestigationModel } from '@/lib/content/investigation-model';
import { dateLabel } from './labels';
import styles from './investigation.module.css';

/**
 * The opening finding — what a reader gets above the fold.
 *
 * The case title and question are the page's own header; this carries the
 * rest of the first screen: the plain-language finding (the research's own
 * first bottom-line point, in its own words), three compact facts, and the
 * update marker when the case's own new data overturned an earlier reading.
 *
 * No methodology here, no abstract graph. The confidence line the research
 * wrote about itself is the one grade that belongs this early, because it
 * tells a reader how to hold everything below it.
 */
export function CaseStoryHeader({
  record,
  model,
}: {
  record: ResearchCase;
  model: InvestigationModel;
}) {
  const survives = record.bottomLine[0]?.text;
  const stats = record.stats;
  const verified = model.claims.filter((c) => c.verdict === 'verified').length;
  const contested = model.claims.filter((c) => c.contested).length;
  const dated = model.events.filter((e) => e.occurredAt);
  const windowStart = stats?.window?.start ?? dated[0]?.occurredAt;
  const windowEnd = stats?.window?.end ?? dated.at(-1)?.occurredAt;
  const unresolved = model.entities.filter((e) => e.identityStatus === 'unresolved').length;

  return (
    <div className={styles.storyHeader}>
      {model.updated ? (
        <p className={styles.updateMarker}>
          <span className={styles.updateLabel}>Reading updated</span>
          <span>
            This file’s own new data withdrew {record.overturned.length} earlier{' '}
            {record.overturned.length === 1 ? 'reading' : 'readings'} on{' '}
            <time dateTime={record.updatedAt}>{dateLabel(record.updatedAt)}</time>.{' '}
            <a href="#what-changed">See what changed</a>.
          </span>
        </p>
      ) : null}

      {survives ? (
        <div className={styles.survives}>
          <span className={styles.survivesLabel}>What survives</span>
          <p>
            <ResearchText>{survives}</ResearchText>
          </p>
        </div>
      ) : null}

      {record.confidence ? (
        <p className={styles.storyConfidence}>
          <ResearchText>{record.confidence}</ResearchText>
        </p>
      ) : null}

      <dl className={styles.storyFacts}>
        <div>
          <dt>Time window</dt>
          <dd>
            {windowStart && windowEnd ? (
              <>
                <time dateTime={windowStart}>{dateLabel(windowStart)}</time> –{' '}
                <time dateTime={windowEnd}>{dateLabel(windowEnd)}</time>
              </>
            ) : (
              'Not stated'
            )}
          </dd>
        </div>
        <div>
          <dt>Sampled</dt>
          <dd>
            {stats ? (
              <>
                {stats.sampled.toLocaleString('en-US')} posts · {stats.subjectAccounts} accounts
                {stats.controlAccounts > 0 ? ` + ${stats.controlAccounts} controls` : ''}
              </>
            ) : (
              `${record.counts.entities} entities`
            )}
          </dd>
        </div>
        <div>
          <dt>Evidence status</dt>
          <dd>
            {model.claims.length} graded {model.claims.length === 1 ? 'finding' : 'findings'} ·{' '}
            {verified} verified · {contested} with contradicting sources
            {unresolved > 0 ? ` · ${unresolved} unresolved ${unresolved === 1 ? 'identity' : 'identities'}` : ''}
          </dd>
        </div>
      </dl>
    </div>
  );
}
