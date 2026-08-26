import Link from 'next/link';
import { type ArchiveIndexEntry, displayTitle } from '@/lib/content/archive';
import styles from './archive.module.css';

export type ArchiveRecordListProps = {
  records: ArchiveIndexEntry[];
  /** Builds each record's URL; the two archives shape theirs differently. */
  href: (entry: ArchiveIndexEntry) => string;
  /**
   * Where this list's numbering starts, 1-based. The documentation index
   * renders one list per category but the file numbers run through the whole
   * archive — restarting at 001 in every category would make the number a
   * row counter instead of an identity.
   */
  startAt?: number;
};

/**
 * An index of archive records, in the register of the rest of the site: each
 * row is a numbered file entry, and the whole row is one link.
 *
 * Deliberately text-only. These archives document a massacre, and a grid of
 * thumbnails turns evidence into a gallery — the record's own page is where
 * its imagery belongs, in the context its caption and credit give it.
 */
export function ArchiveRecordList({ records, href, startAt = 1 }: ArchiveRecordListProps) {
  return (
    <ol className={styles.recordList} start={startAt}>
      {records.map((entry, i) => (
        <li key={entry.id} className={styles.recordItem}>
          <Link className={styles.recordLink} href={href(entry)}>
            <span className={styles.recordNum} aria-hidden="true">
              {String(startAt + i).padStart(3, '0')}
            </span>
            <span className={styles.recordBody}>
              <span className={styles.recordItemTitle}>
                {displayTitle(entry.title ?? entry.id)}
              </span>
              <span className={styles.recordItemMeta}>{meta(entry)}</span>
            </span>
            <span className={styles.recordArrow} aria-hidden="true">
              →
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function meta(entry: ArchiveIndexEntry): string {
  const parts: string[] = [];
  if (entry.witness) parts.push(entry.witness);
  if (entry.date) {
    const date = new Date(entry.date);
    if (!Number.isNaN(date.getTime())) parts.push(String(date.getUTCFullYear()));
  }
  // Only worth saying when there is a choice to make.
  if (entry.languages.length > 1) parts.push(`${entry.languages.length} languages`);
  return parts.join(' · ');
}
