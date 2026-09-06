import type { CaseOverturned } from '@/lib/content/fake-resistance-cases';
import { ResearchText } from '@/components/content';
import styles from './research.module.css';

/**
 * What this rebuild killed.
 *
 * A research desk that only ever adds to its findings is not checking them,
 * and this section is the visible proof that these cases were checked: each
 * row is a reading the desk published in August and its own new data
 * withdrew — a "70% same-hour amplification" statistic that recomputed to
 * 36.3%, a seven-community model that came back as five, a bidirectional flow
 * that turned out to run one way.
 *
 * It renders directly under the bottom line rather than at the end, because a
 * reader who met the earlier version of a case needs the correction before the
 * conclusion, not after it.
 *
 * One case writes its corrections as numbered prose rather than a table. Those
 * rows carry `now` alone and render as a statement; splitting the sentence
 * into a before and an after would be inventing a structure the research did
 * not write.
 */
export function OverturnedList({ rows }: { rows: CaseOverturned[] }) {
  if (rows.length === 0) return null;

  return (
    <ol className={styles.overturned}>
      {rows.map((row) => (
        <li key={row.now.slice(0, 60)} className={styles.overturnedRow}>
          {row.prior ? (
            <p className={styles.overturnedPrior}>
              <span className={styles.overturnedLabel}>Published in August</span>
              <ResearchText>{row.prior}</ResearchText>
            </p>
          ) : null}
          <p className={styles.overturnedNow}>
            {row.prior ? (
              <span className={styles.overturnedLabel}>What the new data shows</span>
            ) : null}
            <ResearchText>{row.now}</ResearchText>
          </p>
          {row.status ? (
            <p className={styles.overturnedStatus}>
              <ResearchText>{row.status}</ResearchText>
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
