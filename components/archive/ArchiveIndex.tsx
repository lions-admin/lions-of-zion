'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from 'react';
import { Button, Pagination, StatusState, absenceStatus } from '@/components/ui';
import {
  displayTitle,
  displayWitness,
  groupDigits,
} from '@/lib/content/archive-display';
import { politeLive } from '@/components/ui/live-region';
import {
  type ArchiveListEntry,
  type ArchiveRowVariant,
  ArchiveRecordList,
} from './ArchiveRecordList';
import styles from './archive.module.css';

/** One value of the archive's own filing axis, with the count it really has. */
export type ArchiveFacet = {
  value: string;
  label: string;
  count: number;
};

export type ArchiveIndexProps = {
  variant: ArchiveRowVariant;
  /** The whole archive, in the order the index page decided. */
  records: ArchiveListEntry[];
  /** The index route's own path — `/october-7/testimonies`. */
  basePath: string;
  /**
   * Documentation only: the segment standing in for a record the source left
   * uncategorised. Passed rather than imported so this module never reaches
   * into the filesystem seam.
   */
  uncategorised?: string;
  /** Category (documentation) or language (testimony) values, with counts. */
  facets: ArchiveFacet[];
  /** Names the facet row — "Category", "Language". */
  facetLegend: string;
  /** Names the filter and its results for a screen reader. */
  searchLabel: string;
  searchHint: string;
};

/** How many rows are on screen at once. See the note on PERF-004 below. */
const PAGE_SIZE = 24;

/* ---------------------------------------------------------------------------
 * The query string as an external store.
 *
 * The filter state lives in the URL, not in this component, so it can be
 * shared, bookmarked and walked back through with the browser's own Back
 * button. `useSyncExternalStore` is how React is told to read it: `popstate`
 * covers Back and Forward, and `writeUrl` notifies the same subscribers for
 * the pushes and replaces this component makes itself, which the History API
 * does not announce.
 *
 * `serverSnapshot` returns an empty query on purpose. Both index routes are
 * prerendered with the unfiltered first page, and React uses this snapshot for
 * the hydrating render too — so the first client render matches the HTML
 * exactly and a deep link's state is applied on the render immediately after.
 * ------------------------------------------------------------------------ */

const urlListeners = new Set<() => void>();

function subscribeToUrl(onChange: () => void) {
  urlListeners.add(onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    urlListeners.delete(onChange);
    window.removeEventListener('popstate', onChange);
  };
}

const urlSnapshot = () => window.location.search;
const urlServerSnapshot = () => '';

function writeUrl(url: string, mode: 'push' | 'replace') {
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
  for (const listener of urlListeners) listener();
}

/** Cheap, accent-insensitive enough for these corpora, and allocation-free. */
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * The archive index: a query, the archive's own filing axis, a stated result,
 * and one page of rows.
 *
 * **What this replaces (OCT-002, PERF-004).** Both indexes used to emit every
 * record — 335 of them on documentation — as an equal, equally-weighted row,
 * 31,000px of them, under a text input that hid rows without ever saying how
 * many were left or how to get back. Finding one record meant scrolling or
 * trusting find-in-page; the sticky category row jumped rather than filtered;
 * and none of the state a reader had reached was in the URL, so it could not
 * be shared, bookmarked, or returned to.
 *
 * **Scale strategy: paginate, and keep the pages real URLs.** One window of
 * `PAGE_SIZE` rows is in the DOM at a time, so a phone lays out 24 rows and 24
 * lazy plates rather than 335 — that is the whole of PERF-004, and it is what
 * keeps filtering prompt, because the work per keystroke is a pass over an
 * in-memory array and a 24-row render. Virtualisation was considered and
 * rejected: it costs a scroll container, breaks find-in-page and the browser's
 * own scroll restoration, and buys nothing over a pager on a list this size.
 *
 * **Why the URL is written by hand rather than by the router.** Both index
 * routes are prerendered at build from imported JSON and must stay that way:
 * `content-packages/` is read through `process.cwd()`, which server-side file
 * tracing cannot follow, so making the route dynamic to read `searchParams`
 * would risk a production route that cannot find its own data. The History API
 * gives the same shareable URL with none of that risk, and the page stays
 * static.
 *
 * The pager's entries are real links — a new tab, a copied link and a crawler
 * all land on the right window — and an ordinary left click is intercepted so
 * the reader gets the instant version instead of a round trip.
 *
 * With scripting off none of this runs, which is what `ArchiveFullIndex` is
 * for: it ships every record as plain links inside `<noscript>`.
 */
export function ArchiveIndex({
  variant,
  records,
  basePath,
  uncategorised = 'uncategorized',
  facets,
  facetLegend,
  searchLabel,
  searchHint,
}: ArchiveIndexProps) {
  const inputId = useId();
  const resultsRef = useRef<HTMLDivElement | null>(null);
  /* Set only by an in-page action, so arriving at a deep link does not steal
     the caret from the top of the document. */
  const moveFocus = useRef(false);

  const facetParam = variant === 'documentation' ? 'category' : 'language';

  const search = useSyncExternalStore(subscribeToUrl, urlSnapshot, urlServerSnapshot);
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const urlQuery = params.get('q') ?? '';
  const facet = params.get(facetParam) ?? '';
  const rawPage = Number(params.get('page'));
  const requestedPage = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  /* The input keeps its own copy so typing is immediate while the URL write is
     debounced. When the URL's query changes from outside — Back, Forward, a
     pasted link — the copy is corrected during render rather than in an
     effect: this is React's own "adjust state when the input changes" pattern,
     and it re-renders before the browser paints the stale value. */
  const [draft, setDraft] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setDraft(urlQuery);
  }

  /* The committed query — what the URL carries once the 300ms debounce has
     settled. Everything downstream filters and announces against it: the rows
     and the results sentence change together, once, on the timer, so the live
     region never reads a reader every keystroke of a word they are still
     typing. The input's own copy stays live (below). */
  const committed = urlQuery.trim();

  const buildUrl = useCallback(
    (next: { q: string; facet: string; page: number }) => {
      const query = new URLSearchParams();
      if (next.q.trim()) query.set('q', next.q.trim());
      if (next.facet) query.set(facetParam, next.facet);
      if (next.page > 1) query.set('page', String(next.page));
      const encoded = query.toString();
      return encoded ? `${basePath}?${encoded}` : basePath;
    },
    [basePath, facetParam],
  );

  /* Typing rewrites the current history entry; choosing a facet or a page
     pushes a new one. A reader who typed six characters does not want six Back
     presses to undo it, and a reader who paged forward does want Back to page
     back. */
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    },
    [],
  );

  const onQuery = (value: string) => {
    setDraft(value);
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      writeUrl(buildUrl({ q: value, facet, page: 1 }), 'replace');
    }, 300);
  };

  const onFacet = (value: string) => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    const next = value === facet ? '' : value;
    writeUrl(buildUrl({ q: draft, facet: next, page: 1 }), 'push');
  };

  const onPage = (value: number) => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    moveFocus.current = true;
    writeUrl(buildUrl({ q: draft, facet, page: value }), 'push');
  };

  const onReset = () => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    setDraft('');
    moveFocus.current = true;
    writeUrl(basePath, 'push');
  };

  /* ---- filtering -------------------------------------------------------- */

  /* Numbers are assigned before any filtering, so a hidden row never renumbers
     the ones after it: the number is the exhibit's identity, not its position
     in the current view. */
  const numbered = useMemo(
    () => records.map((entry, i) => ({ entry, number: i + 1 })),
    [records],
  );

  const facetLabels = useMemo(
    () => new Map(facets.map((f) => [f.value, f.label])),
    [facets],
  );

  const needle = fold(committed);

  const matches = useMemo(
    () =>
      numbered.filter(({ entry }) => {
        if (facet) {
          const inFacet =
            variant === 'documentation'
              ? (entry.category ?? uncategorised) === facet
              : entry.languages.includes(facet);
          if (!inFacet) return false;
        }
        if (!needle) return true;
        const haystack = fold(
          [
            displayTitle(entry.title ?? entry.id),
            entry.witness ? displayWitness(entry.witness) : '',
            facetLabels.get(entry.category ?? uncategorised) ?? entry.category ?? '',
            // The excerpt is on the testimony rows, so "Find" finds what the
            // reader can actually see there. Documentation rows do not carry
            // one — its excerpt is its title — so searching it would only make
            // the same words match twice.
            variant === 'testimony' ? (entry.excerpt ?? '') : '',
          ].join(' '),
        );
        return haystack.includes(needle);
      }),
    [numbered, needle, facet, variant, uncategorised, facetLabels],
  );

  const total = records.length;
  const shown = matches.length;
  const pageCount = Math.max(1, Math.ceil(shown / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const start = (page - 1) * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);

  /* A pager that only scrolls is a pager a keyboard user loses: focus moves to
     the results region, which is named, so the next page is announced and the
     next Tab lands in it rather than back at the top of the document. */
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    resultsRef.current?.focus();
  }, [page, shown]);

  const filtered = Boolean(needle) || Boolean(facet);
  const facetLabel = facet ? (facetLabels.get(facet) ?? facet) : null;

  const onPagerClick = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    if (!anchor) return;
    if (anchor.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      return;
    }
    const target = new URL(anchor.getAttribute('href') ?? '', window.location.href);
    const wanted = Number(target.searchParams.get('page') ?? '1');
    if (!Number.isFinite(wanted) || wanted < 1) return;
    event.preventDefault();
    onPage(Math.min(Math.floor(wanted), pageCount));
  };

  return (
    <div className={styles.index}>
      {/* `data-needs-js` marks the two regions that are inert without a
          client: the filter controls, and a pager whose `?page=N` targets are
          served by the same prerendered HTML as page 1. `ArchiveFullIndex`
          hides both from inside its own `<noscript>` and lists every record
          in their place, so scripting off yields a complete archive rather
          than eight dead controls above a truncated one. */}
      <div className={styles.controls} data-needs-js="">
        <div className={styles.searchField}>
          {/* "Find in this archive" took a line of its own on a phone to
              restate the placeholder beside it. "Find" sits inline at every
              width down to 320px and is still a real `<label>` — the field
              keeps a name after the first keystroke, which a placeholder
              does not. */}
          <label className={styles.searchLabel} htmlFor={inputId}>
            Find
          </label>
          <input
            id={inputId}
            type="search"
            className={styles.searchInput}
            value={draft}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={searchHint}
            autoComplete="off"
            /* A11Y-007: the summary sentence below is this field's
               description — what the current query and category actually
               resolved to. It doubles as the polite live region, so a reader
               using the box hears results settle as they type and a reader
               who tabs back into it is re-told where they are. */
            aria-describedby={`${inputId}-summary`}
          />
          {draft ? (
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={() => {
                if (writeTimer.current) clearTimeout(writeTimer.current);
                setDraft('');
                writeUrl(buildUrl({ q: '', facet, page: 1 }), 'replace');
                document.getElementById(inputId)?.focus();
              }}
            >
              Clear search
            </Button>
          ) : null}
        </div>

        {facets.length > 1 ? (
          /* A named `role="group"` rather than `fieldset`/`legend`, which is
             what this was. The two are equivalent to assistive technology for
             a set of toggle buttons — these are not form fields — and a
             `<legend>` is the one element CSS cannot lay out as a flex item
             in any engine, so it was forced onto a line of its own. Inline, it
             costs nothing and the whole filter reads as one bar. */
          <div
            className={styles.facets}
            role="group"
            aria-labelledby={`${inputId}-facets`}
          >
            <span className={styles.facetLegend} id={`${inputId}-facets`}>
              {facetLegend}
            </span>
            <div className={styles.facetRow}>
              {facets.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant="filter"
                  size="sm"
                  className={styles.facet}
                  isActive={facet === option.value}
                  onClick={() => onFacet(option.value)}
                  /* Below 540px this row is a horizontal scroller, and the
                     browser does not reliably bring a focused child of one
                     into view: measured in headed Chrome, tabbing from the
                     search field to the second category left it 143px past the
                     rail's right edge with `scrollLeft` still at 0, which is a
                     focused control the reader cannot see. Asking explicitly
                     is deterministic and costs nothing where the row wraps
                     instead — `nearest` scrolls nothing that is already in
                     view. */
                  onFocus={(event) =>
                    event.currentTarget.scrollIntoView({
                      block: 'nearest',
                      inline: 'nearest',
                    })
                  }
                >
                  {option.label}
                  <span className={styles.facetCount}>{option.count}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* The state the reader is in, written out. Announced politely so a
          screen-reader user hears the result settle rather than every
          keystroke, and it is a sentence rather than a bare ratio, because
          "24 of 99" does not say which 99 or why. */}
      <div className={styles.summary}>
        <p id={`${inputId}-summary`} className={styles.summaryLine} {...politeLive}>
          {shown === 0
            ? `No record matches. The archive holds ${groupDigits(total)}.`
            : `Showing ${groupDigits(start + 1)}–${groupDigits(start + visible.length)} of ${groupDigits(shown)}${
                filtered ? ` matching, from ${groupDigits(total)} held` : ' records'
              }.`}
          {facetLabel ? ` Filed under ${facetLabel}.` : ''}
          {needle ? ` Text “${committed}”.` : ''}
        </p>
        {filtered ? (
          <Button type="button" variant="text" size="sm" onClick={onReset}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {/* A region, named by its own heading — a reader listing landmarks
          hears this as a place, and the heading is the one it is announced
          by. The heading is visually hidden: the visible summary sentence
          above already states the state the list is in. */}
      <h2 className={styles.srOnly} id={`${inputId}-results-heading`}>
        {searchLabel} results
      </h2>
      <div
        className={styles.results}
        ref={resultsRef}
        tabIndex={-1}
        role="region"
        aria-labelledby={`${inputId}-results-heading`}
      >
        {shown === 0 ? (
          /* STATE-005: "nothing matches" and "there is nothing" are different
             facts, and only the first has a recovery. Offering "Clear filters"
             on an archive that holds no records at all would hand the reader a
             control that changes nothing and implies they narrowed something
             they did not. */
          total === 0 ? (
            <StatusState
              status={absenceStatus("empty-record")}
              eyebrow="Empty index"
              title="This archive holds no records yet."
              description="The index loaded and carries nothing. Nothing is filtered out and nothing failed to load — there is simply nothing filed here so far."
            />
          ) : (
            <StatusState
              status={absenceStatus("no-matches")}
              eyebrow="No match"
              title="Nothing in the archive matches this."
              description={`The archive holds ${groupDigits(total)} records. Try ${searchHint.toLowerCase()}, or a different ${
                facetParam === 'category' ? 'category' : 'language'
              } — or clear the search text and the ${facetParam} filter to start again.`}
              actionText="Clear filters"
              onAction={onReset}
            />
          )
        ) : (
          <ArchiveRecordList
            variant={variant}
            label={`${searchLabel} results`}
            records={visible.map((r) => r.entry)}
            numbers={variant === 'documentation' ? visible.map((r) => r.number) : undefined}
            categories={
              /* The row's filing line repeats its category — useful while the
                 whole archive is showing, where it is one of six and the eye
                 sorts by it; noise once a facet is active, where every row is
                 the same answer the chips above already state. */
              variant === 'documentation' && !facet
                ? visible.map((r) => facetLabels.get(r.entry.category ?? uncategorised))
                : undefined
            }
            href={(entry) => {
              const base =
                variant === 'documentation'
                  ? `${basePath}/${entry.category ?? uncategorised}/${entry.id}`
                  : `${basePath}/${entry.id}`;
              /* The row carries the view it was found in: a reader who opens
                 a record and presses Back — or copies the record's link to
                 share the filtered list it came from — lands back on this
                 state, not on the unfiltered top of the index. */
              const query = new URLSearchParams();
              if (committed) query.set('q', committed);
              if (facet) query.set(facetParam, facet);
              if (page > 1) query.set('page', String(page));
              const encoded = query.toString();
              return encoded ? `${base}?${encoded}` : base;
            }}
          />
        )}
      </div>

      {pageCount > 1 ? (
        <div className={styles.pager} data-needs-js="" onClick={onPagerClick}>
          <Pagination
            page={page}
            pageCount={pageCount}
            label={`${searchLabel} pages`}
            hrefForPage={(p) => buildUrl({ q: draft, facet, page: p })}
          />
        </div>
      ) : null}
    </div>
  );
}
