'use client';

import { useId, useMemo, useState } from 'react';
import type { ArchiveIndexEntry } from '@/lib/content/archive';
import { displayTitle, displayWitness } from '@/lib/content/archive-display';
import { ArchiveRecordList } from './ArchiveRecordList';
import styles from './archive.module.css';

export type ArchiveFilterGroup = {
  /** Path segment between the base and the record id; '' for a flat index. */
  slug: string;
  /** Rendered as the group heading; omit for a flat index. */
  title?: string;
  records: ArchiveIndexEntry[];
};

export type ArchiveIndexFilterProps = {
  groups: ArchiveFilterGroup[];
  /** e.g. `/october-7/documentation`. */
  basePath: string;
  showMeta?: boolean;
  /** Renders the sticky category row. Pointless on a flat index. */
  showCategoryJump?: boolean;
  /** Placeholder and the label a screen reader hears. */
  label: string;
};

/** Cheap, accent-insensitive enough for these corpora, and allocation-free. */
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * A text filter over an archive index, and a jump row for its categories.
 *
 * Both index routes emitted every record as a ~77px row and stopped — no
 * filter, no sort, no pagination — so finding one of 335 documentation
 * records meant scrolling 31,000px or trusting find-in-page.
 *
 * **This is progressive enhancement, not a client-rendered list.** The rows
 * are React-rendered here but the component server-renders on first paint
 * with an empty query, so every row is in the prerendered HTML exactly as
 * before, and with JavaScript off the index is unchanged and fully usable —
 * only the input is inert. That is the bar `app/loading.tsx`'s removal set
 * and it is not negotiable on this route.
 *
 * Filtering **hides** rows; it never renumbers them. The file number is the
 * record's identity, so `numbers` carries each record's real position through
 * the filter rather than letting it become a row counter.
 */
export function ArchiveIndexFilter({
  groups,
  basePath,
  showMeta = true,
  showCategoryJump = false,
  label,
}: ArchiveIndexFilterProps) {
  const [query, setQuery] = useState('');
  const inputId = useId();

  /* File numbers run through the whole archive, assigned before any filtering
     so a hidden row does not renumber the ones after it. */
  const numbered = useMemo(() => {
    let n = 0;
    return groups.map((group) => ({
      ...group,
      records: group.records.map((entry) => ({ entry, number: ++n })),
    }));
  }, [groups]);

  const needle = fold(query.trim());

  const filtered = useMemo(() => {
    if (!needle) return numbered;
    return numbered.map((group) => ({
      ...group,
      records: group.records.filter(({ entry }) => {
        const haystack = fold(
          [
            displayTitle(entry.title ?? entry.id),
            entry.witness ? displayWitness(entry.witness) : '',
            entry.category ?? '',
            group.title ?? '',
          ].join(' '),
        );
        return haystack.includes(needle);
      }),
    }));
  }, [numbered, needle]);

  const total = useMemo(
    () => numbered.reduce((sum, g) => sum + g.records.length, 0),
    [numbered],
  );
  const shown = filtered.reduce((sum, g) => sum + g.records.length, 0);

  /* No hand-rolled scroll restoration here any more.
     It existed only because `DocPage`'s `.page` was its own scroll container,
     which browsers cannot restore across a back-navigation — a reader who
     opened row 250 and pressed Back restarted at the top of a 300-row list.
     The reading routes scroll the document as of 2026-08-27, so the browser's
     own restoration covers it, and keeping a `sessionStorage` copy alongside
     would fight it: both would write a position and the later one would win,
     which is how a reader ends up somewhere neither of them meant. */


  return (
    <div>
      <div className={styles.filterBar}>
        <label className={styles.filterLabel} htmlFor={inputId}>
          {label}
        </label>
        <input
          id={inputId}
          type="search"
          className={styles.filterInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by title, witness or category"
          autoComplete="off"
        />
        {/* Announced politely so a screen-reader user hears the count settle
            rather than every keystroke. */}
        <p className={styles.filterCount} role="status" aria-live="polite">
          {needle ? `${shown} of ${total}` : `${total} records`}
        </p>
      </div>

      {showCategoryJump ? (
        <nav className={styles.categoryJump} aria-label="Categories">
          {numbered.map((group) => (
            <a key={group.slug} href={`#${group.slug}`}>
              {group.title}
            </a>
          ))}
        </nav>
      ) : null}

      {shown === 0 ? (
        <p className={styles.filterEmpty}>
          No record matches “{query.trim()}”. The archive holds {total}; try a
          witness name, a place, or a category.
        </p>
      ) : null}

      {filtered.map((group) =>
        group.records.length === 0 ? null : (
          <section key={group.slug || 'all'} id={group.slug || undefined}>
            {group.title ? (
              <>
                <h2 className={styles.groupHeading}>{group.title}</h2>
                <p className={styles.groupCount}>
                  {group.records.length}{' '}
                  {group.records.length === 1 ? 'record' : 'records'}
                </p>
              </>
            ) : null}
            <ArchiveRecordList
              records={group.records.map((r) => r.entry)}
              numbers={group.records.map((r) => r.number)}
              showMeta={showMeta}
              href={(entry) =>
                `${basePath}/${group.slug ? `${group.slug}/` : ''}${entry.id}`
              }
            />
          </section>
        ),
      )}
    </div>
  );
}
