import Link from 'next/link';
import type { ArchiveIndexEntry } from '@/lib/content/archive';
import styles from './archive.module.css';

export type ArchiveRecordListProps = {
  records: ArchiveIndexEntry[];
  /** Builds each record's URL; the two archives shape theirs differently. */
  href: (entry: ArchiveIndexEntry) => string;
};

/**
 * A list of archive records.
 *
 * Deliberately text-only. These archives document a massacre, and a grid of
 * thumbnails turns evidence into a gallery — the record's own page is where
 * its imagery belongs, in the context its caption and credit give it.
 */
export function ArchiveRecordList({ records, href }: ArchiveRecordListProps) {
  return (
    <ul className={styles.recordList}>
      {records.map((entry) => (
        <li key={entry.id} className={styles.recordItem}>
          <Link className={styles.recordLink} href={href(entry)}>
            <span className={styles.recordItemTitle}>{entry.title ?? entry.id}</span>
            <span className={styles.recordItemMeta}>{meta(entry)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function meta(entry: ArchiveIndexEntry): string {
  const parts: string[] = [];
  if (entry.date) {
    const date = new Date(entry.date);
    if (!Number.isNaN(date.getTime())) {
      parts.push(String(date.getUTCFullYear()));
    }
  }
  // Only worth saying when there is a choice to make.
  if (entry.languages.length > 1) parts.push(`${entry.languages.length} languages`);
  return parts.join(' · ');
}
