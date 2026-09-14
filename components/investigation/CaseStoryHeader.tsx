import { ResearchText } from '@/components/content';
import { splitClaimFromEvidence } from '@/components/research';
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
  /* The research writes every bottom-line point the same way: the finding as
     a bold opening sentence, then the measurements that establish it, all in
     one paragraph. On `hinkle-machine` that put "The '70%' figure is dead; the
     production-cell coupling is not." immediately in front of "287 of Hinkle's
     790 non-retweet posts (36.3%) … median lag 512 s ≈ 8.5 min; p25 95 s; p75
     1261 s; max 23.7 h" — the finding arrived first and was drowned in the
     same breath. Split, the claim is a claim and the numbers corroborate it.
     A point with too little behind the claim to be worth splitting stays one
     paragraph; `splitClaimFromEvidence` decides that, not this file. */
  const point = record.bottomLine[0]?.text;
  const survives = point ? splitClaimFromEvidence(point) : null;
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
            <ResearchText>{survives.claim ?? survives.evidence}</ResearchText>
          </p>
          {survives.claim ? (
            <p className={styles.survivesEvidence}>
              <ResearchText>{survives.evidence}</ResearchText>
            </p>
          ) : null}
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
