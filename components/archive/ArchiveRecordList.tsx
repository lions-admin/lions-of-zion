import Link from 'next/link';
import type { ArchiveIndexEntry } from '@/lib/content/archive';
/* From the pure module, not the seam: this list renders inside
   `ArchiveIndexFilter`, a client component, and the seam reads the filesystem. */
import { displayTitle, displayWitness } from '@/lib/content/archive-display';
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
  /**
   * Whether each row carries a meta line under its title. Default on.
   *
   * The documentation index turns it off. Its records have no witness, every
   * one has exactly two languages, and the date is the source CMS's crawl
   * timestamp rather than the event's — so `meta()` resolves to two strings
   * across all 335 rows ("2023 · 2 languages" ×314, "2024 · 2 languages"
   * ×21), and the 21 attach a wrong year to a 2023 event. Testimonies keep
   * it: 177 of their 179 rows are distinct, because the witness carries real
   * signal there.
   */
  showMeta?: boolean;
  /**
   * Explicit file number per record, aligned to `records`.
   *
   * `startAt + i` is right for an unfiltered list and wrong the moment rows
   * are hidden: the number is the record's identity, not its position in the
   * current view, so filtering must not renumber what is left.
   */
  numbers?: number[];
};

/**
 * An index of archive records, in the register of the rest of the site: each
 * row is a numbered file entry, and the whole row is one link.
 *
 * Deliberately text-only. These archives document a massacre, and a grid of
 * thumbnails turns evidence into a gallery — the record's own page is where
 * its imagery belongs, in the context its caption and credit give it.
 */
export function ArchiveRecordList({
  records,
  href,
  startAt = 1,
  showMeta = true,
  numbers,
}: ArchiveRecordListProps) {
  return (
    <ol className={styles.recordList} start={startAt}>
      {records.map((entry, i) => (
        <li key={entry.id} className={styles.recordItem}>
          <Link className={styles.recordLink} href={href(entry)}>
            <span className={styles.recordNum} aria-hidden="true">
              {String(numbers?.[i] ?? startAt + i).padStart(3, '0')}
            </span>
            <span className={styles.recordBody}>
              <span className={styles.recordItemTitle}>
                {displayTitle(entry.title ?? entry.id)}
              </span>
              {showMeta ? (
                <span className={styles.recordItemMeta}>{meta(entry)}</span>
              ) : null}
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
  if (entry.witness) parts.push(displayWitness(entry.witness));
  if (entry.date) {
    const date = new Date(entry.date);
    if (!Number.isNaN(date.getTime())) parts.push(String(date.getUTCFullYear()));
  }
  // Only worth saying when there is a choice to make.
  if (entry.languages.length > 1) parts.push(`${entry.languages.length} languages`);
  return parts.join(' · ');
}
