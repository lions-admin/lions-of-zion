'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ArchiveIndexEntry } from '@/lib/content/archive';
/* From the pure module, not the seam: this list renders inside
   `ArchiveIndexFilter`, a client component, and the seam reads the filesystem.
   (`ArchiveIndexEntry` arrives as a type only — types cross that boundary.) */
import { displayTitle, displayWitness } from '@/lib/content/archive-display';
import styles from './archive.module.css';

/**
 * What a row paints. `thumb` is the entry's cover already resolved to a URL —
 * `withCoverThumbs` does that server-side, because resolution needs the media
 * registry and the registry must never reach the client.
 */
export type ArchiveListEntry = ArchiveIndexEntry & { thumb?: string | null };

export type ArchiveRecordListProps = {
  records: ArchiveListEntry[];
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
 * The rows carry the record's cover and an excerpt of its own words — an
 * owner decision (2026-08-27) reversing the earlier text-only stance. The
 * form holds the line the old comment was defending: this is a *file list*
 * with a small identifying image per row, not a gallery — the image is
 * decorative (`alt=""`, the title is the description), square, small, and
 * lazy, so 335 rows do not become the heaviest page on the site.
 *
 * A hover preview was considered and rejected in review: hover has no touch
 * equivalent, and a rich row reads the same on every device.
 */
function RecordThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className={styles.recordThumb} aria-hidden="true" />;
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- a CDN
       archive derivative, same reasoning as `ArchiveImage`. */
    <img
      className={styles.recordThumb}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

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
            {entry.thumb ? (
              <RecordThumb src={entry.thumb} />
            ) : (
              /* Every entry carries a cover today; if one ever does not, the
                 grid keeps its shape and the gap reads as a quiet blank. */
              <span className={styles.recordThumb} aria-hidden="true" />
            )}
            <span className={styles.recordBody}>
              <span className={styles.recordItemTitle}>
                {displayTitle(entry.title ?? entry.id)}
              </span>
              {entry.excerpt ? (
                <span className={styles.recordExcerpt}>{entry.excerpt}</span>
              ) : null}
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
