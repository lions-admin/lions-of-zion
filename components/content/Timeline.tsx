import type { ReactNode } from 'react';
import type { AssessmentValue } from '@/server/contracts/enums';
import { SourceList, type Source } from './SourceList';
import { VerificationBadge } from './VerificationBadge';
import styles from './content.module.css';

export type TimelineEntry = {
  id: string;
  /** Machine-readable value for the <time dateTime> attribute. */
  datetime: string;
  /** Human-readable date shown to the reader. */
  dateLabel: string;
  title: string;
  body: ReactNode;
  region?: string;
  category?: string;
  assessment?: AssessmentValue;
  sources?: Source[];
};

export type TimelineVariant = 'feed' | 'history' | 'spread';

export type TimelineProps = {
  entries: TimelineEntry[];
  variant?: TimelineVariant;
};

export function Timeline({ entries, variant = 'feed' }: TimelineProps) {
  if (!entries.length) return null;

  return (
    <ol className={styles.timeline} data-variant={variant}>
      {entries.map((entry) => (
        <li key={entry.id} id={entry.id} className={styles.timelineEntry}>
          {/* The record and its evidence are siblings, which is what lets the
              entry become a two-track grid above 1220px and put the sources in
              the margin without either one being able to overlap the other —
              see `marginNote` in content.module.css. */}
          <div className={styles.timelineMain}>
            <div className={styles.timelineMeta}>
              <time dateTime={entry.datetime}>{entry.dateLabel}</time>
              {entry.region ? <span className={styles.timelineTag}>{entry.region}</span> : null}
              {entry.category ? <span className={styles.timelineTag}>{entry.category}</span> : null}
              {entry.assessment ? <VerificationBadge assessment={entry.assessment} /> : null}
            </div>
            <h3>{entry.title}</h3>
            <div className={styles.timelineBody}>{entry.body}</div>
          </div>
          {entry.sources?.length ? (
            <div className={styles.timelineSources}>
              <SourceList sources={entry.sources} />
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
