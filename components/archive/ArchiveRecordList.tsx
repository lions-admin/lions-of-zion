'use client';

import { useState } from 'react';
import Link from 'next/link';
import type {
  ArchiveIndexDisplayEntry,
  ArchiveIndexEntry,
  ArchiveRecordDigest,
} from '@/lib/content/archive';
/* From the pure module, not the seam: this list renders inside `ArchiveIndex`,
   a client component, and the seam reads the filesystem. (The entry types
   arrive as types only — those cross the boundary.) */
import {
  displayTitle,
  displayWitness,
  formatArchiveDay,
  groupDigits,
} from '@/lib/content/archive-display';
import { MediaBlock } from '@/components/content/MediaBlock';
import styles from './archive.module.css';
import { Icon } from '@/components/ui/Icon';

/**
 * What a row paints.
 *
 * `thumb` and its dimensions are the entry's cover already resolved
 * server-side — resolution needs the media registry, and the registry must
 * never reach the client. They are optional because only one of the two
 * archives has a plate: the documentation index resolves no covers at all
 * since 2026-09-16, so 335 derivative URLs no longer travel in a payload for
 * a row that must not show them. `digest` is what `getRecordDigests` derives
 * from the record itself: which medium the source published, how much text
 * the record holds, how far it is sectioned.
 */
export type ArchiveListEntry = ArchiveIndexEntry &
  Partial<ArchiveIndexDisplayEntry> & {
    digest?: ArchiveRecordDigest;
  };

/** Which archive a row belongs to — and therefore what shape it takes. */
export type ArchiveRowVariant = 'testimony' | 'documentation';

export type ArchiveRecordListProps = {
  records: ArchiveListEntry[];
  variant: ArchiveRowVariant;
  /** Builds each record's URL; the two archives shape theirs differently. */
  href: (entry: ArchiveListEntry) => string;
  /**
   * Explicit file number per record, aligned to `records`. Documentation only
   * — the number is the exhibit's identity and runs through the whole archive,
   * so filtering must never renumber what is left.
   */
  numbers?: number[];
  /** The category a documentation row belongs to, aligned to `records`. */
  categories?: (string | undefined)[];
  /** Names the list for a screen reader listing landmarks. */
  label: string;
};

/**
 * Two archives, two row anatomies — the point of OCT-003.
 *
 * They were one list, and being one list was the defect: a first-person
 * account and a piece of captured footage arrived as the same numbered strip
 * with the same square plate, distinguishable only by reading the URL. The
 * archives are not the same kind of thing and the rows no longer pretend they
 * are.
 *
 *  - **Testimony** is a person. The row leads with the witness, then the line
 *    the source gave their account, then the account's own opening words, then
 *    what is held: when it was published, how long the account runs, which
 *    languages it exists in. No file number — a witness is not an exhibit —
 *    and the portrait plate sits at the end of the row, after the words.
 *
 *  - **Documentation** is an exhibit, and it is shown **without a plate**. The
 *    index's own advisory says "no film or photograph on this site is shown
 *    until you ask for it", and a window of 24 cover frames painted directly
 *    under that sentence made it untrue — 24 requests for stills of the attack,
 *    lifted from the films themselves, none of them asked for (owner decision,
 *    2026-09-16). The exhibit number, the filing line and the caption carry the
 *    row; the record's own page shows the material behind the gate that the
 *    advisory promises, and a revealed film gets its poster there.
 *
 * Documentation rows deliberately do not print the excerpt. The importer takes
 * it from the record's own text, and on this archive the record's text *is*
 * the caption: 277 of 335 excerpts are byte-identical to the title and the
 * other 58 differ by a stray space or a trailing digit. Printing both put the
 * same sentence twice on almost every row.
 */
export function ArchiveRecordList({
  records,
  variant,
  href,
  numbers,
  categories,
  label,
}: ArchiveRecordListProps) {
  return (
    <ol className={styles.recordList} data-variant={variant} aria-label={label}>
      {records.map((entry, i) => (
        <li key={entry.id} className={styles.recordItem}>
          <Link className={styles.recordLink} href={href(entry)}>
            {variant === 'testimony' ? (
              <TestimonyRow entry={entry} />
            ) : (
              <DocumentationRow
                entry={entry}
                number={numbers?.[i]}
                category={categories?.[i]}
              />
            )}
          </Link>
        </li>
      ))}
    </ol>
  );
}

function TestimonyRow({ entry }: { entry: ArchiveListEntry }) {
  const words = entry.digest?.words ?? 0;
  return (
    <>
      <span className={styles.witnessBody}>
        {entry.witness ? (
          <span className={styles.witnessName}>{displayWitness(entry.witness)}</span>
        ) : null}
        <span className={styles.witnessTitle}>
          {displayTitle(entry.title ?? entry.id)}
        </span>
        {entry.excerpt ? (
          <span className={styles.witnessExcerpt}>{entry.excerpt}</span>
        ) : null}
        <span className={styles.witnessFacts}>
          {entry.date ? (
            <span className={styles.witnessFact}>{formatArchiveDay(entry.date)}</span>
          ) : null}
          {/* Transcript availability, stated as the amount actually held
              rather than as a yes/no badge: "412 words" and "7,525 words" are
              different reading commitments and a reader deciding where to
              start is owed the difference. */}
          <span className={styles.witnessFact}>
            {words > 0 ? `${groupDigits(words)} words held` : 'No transcript held'}
          </span>
        </span>
        <span className={styles.witnessLocales}>
          <span className={styles.srOnly}>Available in: </span>
          {entry.languages.map((locale) => (
            <span
              key={locale}
              className={styles.witnessLocale}
              data-default={locale === entry.defaultLanguage ? '' : undefined}
            >
              {locale.toUpperCase()}
            </span>
          ))}
        </span>
      </span>
      {/* 3/4 portrait, and after the words: the plate identifies the account,
          it does not introduce the person. */}
      <MediaBlock layout="thumb" aspectRatio="3 / 4" className={styles.witnessPlate}>
        <RecordThumb entry={entry} />
      </MediaBlock>
    </>
  );
}

function DocumentationRow({
  entry,
  number,
  category,
}: {
  entry: ArchiveListEntry;
  number?: number;
  category?: string;
}) {
  const medium = entry.digest ? MEDIUM_LABEL[entry.digest.medium] : null;
  return (
    <>
      {/* The exhibit number is the record's identity in this archive, and it
          was hidden from assistive technology as decoration — so a reader
          using a screen reader heard 24 captions with nothing to cite. The
          word is only in the accessible name; the digits carry it on screen. */}
      {number === undefined ? null : (
        <span className={styles.exhibitNum}>
          <span className={styles.srOnly}>Exhibit </span>
          {String(number).padStart(3, '0')}
        </span>
      )}
      <span className={styles.exhibitBody}>
        <span className={styles.exhibitFiling}>
          {medium ? <span className={styles.exhibitMedium}>{medium}</span> : null}
          {category ? <span className={styles.exhibitCategory}>{category}</span> : null}
        </span>
        <span className={styles.exhibitTitle}>
          {displayTitle(entry.title ?? entry.id)}
        </span>
      </span>
      <Icon name="arrow-right" inline className={`${styles.exhibitArrow} arrow`} />
    </>
  );
}

const MEDIUM_LABEL: Record<ArchiveRecordDigest['medium'], string> = {
  video: 'Film',
  image: 'Photograph',
  text: 'Written record',
};

/**
 * A row's cover, and what stands in its place when it does not arrive.
 *
 * Three states, and they are three different facts (OCT-007): the cover loads;
 * the entry has no cover at all, which is a quiet empty plate; the cover was
 * requested and refused, which is a dashed plate — a stated gap in the
 * holding, in the same voice `ArchiveImage` uses on the record page. Both
 * blanks keep the frame's box, so nothing below a failed row moves.
 *
 * Decorative by contract (`alt=""`): the title beside it is the description,
 * and inventing one would be inventing metadata the archive does not hold.
 */
function RecordThumb({ entry }: { entry: ArchiveListEntry }) {
  const [failed, setFailed] = useState(false);

  if (!entry.thumb) {
    return <span className={styles.recordPlate} data-state="empty" aria-hidden="true" />;
  }
  if (failed) {
    return <span className={styles.recordPlate} data-state="failed" aria-hidden="true" />;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- a CDN
       archive derivative, same reasoning as `ArchiveImage`. */
    <img
      className={styles.recordThumb}
      src={entry.thumb}
      srcSet={entry.thumbSrcSet || undefined}
      /* The plate is 4–6rem on the exhibit rows and 4.5–7rem on the testimony
         rows; 160px covers both at 2x, so the browser picks the w480
         derivative and never the 4K original. */
      sizes={entry.thumbSrcSet ? '160px' : undefined}
      width={entry.thumbWidth ?? undefined}
      height={entry.thumbHeight ?? undefined}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

