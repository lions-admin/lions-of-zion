"use client";

/**
 * The search instrument itself: one input, one list, one honest footer.
 *
 * Used twice — inside the overlay and inline on `/search` — because a reader
 * who lands on the page directly should get the same instrument, not a lesser
 * one. `variant` changes chrome and nothing else.
 *
 * ## Keyboard
 *
 * This is the ARIA 1.2 combobox-with-listbox pattern, which is the one that
 * lets a reader keep typing while moving through results: focus never leaves
 * the input, and `aria-activedescendant` carries the selection. The bindings:
 *
 *   ↓ / ↑        move, wrapping at both ends
 *   Home / End   first / last result
 *   Enter        open the active result (nothing, if it has no page)
 *   Escape       clear the query; on an already-empty query, close
 *
 * Escape clearing before closing is deliberate. The alternative — always
 * close — throws away a half-typed query on a keypress people use to mean
 * "undo the last thing", and re-opening starts from nothing.
 *
 * Combobox ARIA lives on the input, not on FieldShell. FieldShell owns the
 * visible label; a second label would compete with it.
 *
 * Live regions (STATE-002): one polite region for counts and invalid-query;
 * blocking errors use StatusState `status="error"` (`role="alert"`). Ambient
 * loading is visible (pulse + copy) and is not announced.
 *
 * States on `data-search-state`: idle, loading, results, no-results,
 * fallback, invalid-query, error. Retry is the error action, not a separate
 * view. Fallback means the lexical index answered while semantic matching was
 * unavailable; its results remain real and interactive.
 *
 * ## Order (VA-17)
 *
 * Query field, result status, notices, results, keyboard grammar — and, on
 * `/search`, the no-JavaScript index last, in the page rather than here. That
 * is the DOM order, and `search.module.css` pins it again with `order` inside
 * the narrow branch so a later edit that moves a node cannot put the
 * documentation back above the answer.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { FieldControl, FieldShell } from "@/components/ui/Field";
import { StatusState } from "@/components/ui/StatusState";
import { politeLive } from "@/components/ui/live-region";
import { SearchFilters } from "./SearchFilters";
import { SearchPager } from "./SearchPager";
import { SearchResults } from "./SearchResults";
import { resultStatus } from "./vocabulary";
import { useSearch, type SearchScope } from "./useSearch";
import { ApiProblem } from "./http";
import type { EntityType } from "@/server/contracts/enums";
import styles from "./search.module.css";

/**
 * Idle primer chips. These are queries, not records — they fill the box.
 * Wording is taken from published product language (a claim, a name, a
 * place); none of them names an unpublished file.
 *
 *   staged footage  — Fake Resistance, Arma 3 combat-video case
 *   Yahya Sinwar    — October 7 timeline
 *   Haifa           — Fake Resistance, evacuation-video case
 *   October 7       — published section
 *   Nahal Oz        — Our Heroes (Tibon)
 */
const PRIMER_QUERIES = ["staged footage", "Yahya Sinwar", "Haifa", "October 7", "Nahal Oz"] as const;

const RECENTS_KEY = "loz.search.recent";
const RECENTS_EVENT = "loz-search-recents";
const RECENTS_MAX = 5;
const EMPTY_RECENTS: string[] = [];

export interface SearchPanelProps {
  variant: "overlay" | "page";
  initialQuery?: string;
  /** The kind filter and page a linked result set arrived with, already
   *  validated by the server component that read them. */
  initialScope?: SearchScope;
  autoFocus?: boolean;
  /** Called when the reader leaves — Escape on an empty query, or a result
   *  opened. The page variant passes nothing. */
  onDismiss?: () => void;
  /** Mirrors the query into the address bar on `/search`, so a result set is
   *  linkable and survives a reload. */
  onQueryChange?: (query: string) => void;
  /**
   * Mirrors the kind filter and the page number alongside the query, so a
   * linked result set is the one the reader was actually looking at.
   *
   * Separate from `onQueryChange` rather than folded into it because the two
   * fire on different rhythms — the query on every keystroke, this on a
   * deliberate click — and because the overlay wants neither.
   */
  onScopeChange?: (scope: { entityType: EntityType | null; page: number }) => void;
}

const NO_SCOPE: SearchScope = {};

export function SearchPanel({
  variant,
  initialQuery = "",
  initialScope = NO_SCOPE,
  autoFocus = false,
  onDismiss,
  onQueryChange,
  onScopeChange,
}: SearchPanelProps) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const {
    query,
    setQuery,
    answered,
    hits,
    state,
    semantic,
    problem,
    retry,
    entityType,
    setEntityType,
    facets,
    total,
    totalIsFloor,
    page,
    answeredOffset,
    pageCount,
    setPage,
  } = useSearch(initialQuery, composing, initialScope);
  const recents = useSyncExternalStore(subscribeRecents, readRecents, () => EMPTY_RECENTS);

  /* The selection resets when a new result set lands. Adjusted during render
     rather than in an effect: React runs the extra pass before painting, so
     nothing flashes, and the alternative is the cascading render that
     `react-hooks/set-state-in-effect` refuses.

     The key is the whole answer — query, kind and page — not the query alone.
     Page two of "October 7" answers the same query as page one, so a key of
     `answered` would carry the seventh row's highlight onto a page that has
     three, and the reader would find the selection already somewhere they did
     not put it. */
  const answerKey = JSON.stringify([answered, entityType, page]);
  const [selection, setSelection] = useState({ key: answerKey, index: 0 });
  if (selection.key !== answerKey) setSelection({ key: answerKey, index: 0 });

  /* Clamped here, so a shorter result set can never leave the selection
     pointing past the end — and `aria-activedescendant` can never name an id
     that is not in the document. */
  const activeIndex = hits.length ? Math.min(Math.max(selection.index, 0), hits.length - 1) : -1;
  const setActiveIndex = useCallback(
    (index: number) => setSelection((current) => ({ ...current, index })),
    [],
  );

  const baseId = useId();
  const listboxId = `${baseId}-results`;
  const inputId = `${baseId}-query`;
  const inputRef = useRef<HTMLInputElement>(null);
  const optionId = useCallback((index: number) => `${baseId}-option-${index}`, [baseId]);
  const remember = useCallback((value: string) => {
    rememberQuery(value);
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, optionId]);

  const move = (delta: number) => {
    if (!hits.length) return;
    const next = activeIndex + delta;
    setActiveIndex(next < 0 ? hits.length - 1 : next >= hits.length ? 0 : next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || composing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        if (!hits.length) break;
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        if (!hits.length) break;
        event.preventDefault();
        setActiveIndex(hits.length - 1);
        break;
      case "Enter": {
        const hit = hits[activeIndex];
        if (!hit?.href) break;
        event.preventDefault();
        remember(query);
        router.push(hit.href);
        onDismiss?.();
        break;
      }
      case "Escape":
        event.preventDefault();
        if (query) {
          setQuery("");
          onQueryChange?.("");
        } else {
          onDismiss?.();
        }
        break;
      default:
        break;
    }
  };

  const handleChange = useCallback(
    (next: string) => {
      setQuery(next);
      onQueryChange?.(next);
    },
    [setQuery, onQueryChange],
  );

  const fillQuery = useCallback(
    (next: string) => {
      handleChange(next);
      remember(next);
      inputRef.current?.focus();
    },
    [handleChange, remember],
  );

  /* Focus returns to the input on both of these.

     For the pager it is a correctness fix rather than a nicety: the step
     buttons are really `disabled` at the ends, so clicking "Next" onto the last
     page would disable the control the reader had just activated and drop focus
     to the document body. The combobox pattern already says focus belongs in
     the input — from there the reader can arrow straight into the new page. */
  const pickKind = useCallback(
    (next: EntityType | null) => {
      setEntityType(next);
      onScopeChange?.({ entityType: next, page: 0 });
      inputRef.current?.focus();
    },
    [setEntityType, onScopeChange],
  );

  const goToPage = useCallback(
    (next: number) => {
      setPage(next);
      onScopeChange?.({ entityType, page: next });
      inputRef.current?.focus();
    },
    [setPage, onScopeChange, entityType],
  );

  const trimmed = query.trim();
  const tooShort = trimmed.length === 1;
  const showingStale = state === "loading" && hits.length > 0;
  /* "There is an answer on screen", which includes the previous one held while
     the next loads. The filter row and the pager are chrome belonging to the
     answer, and unmounting them for the 300ms of a page change would make the
     list jump under the reader's pointer each time they used one. */
  const answering =
    state === "results" || state === "fallback" || state === "no-results" || showingStale;
  const body = useMemo(() => {
    if (state === "error" && problem) {
      return <PanelProblem problem={problem} onRetry={retry} />;
    }
    if (!trimmed) return <PanelPrimer recents={recents} onPick={fillQuery} />;
    if (tooShort) {
      return <p className={styles.notice}>Type at least two characters to search.</p>;
    }
    if (state === "loading" && !hits.length) {
      return <p className={styles.notice}>Searching…</p>;
    }
    if (state === "no-results") {
      return <PanelEmpty query={answered} semantic={semantic} />;
    }
    return null;
  }, [state, problem, retry, trimmed, tooShort, hits.length, answered, semantic, recents, fillQuery]);

  /* The count and the matcher, rendered above the list — see `resultStatus`
     in `vocabulary.ts` for why they are not in the footer any more. The range
     is passed so a paged answer says which part of itself is on screen. */
  const status = resultStatus(state, hits.length, answered, {
    offset: answeredOffset,
    total,
    totalIsFloor,
  });

  /* Counts and invalid-query only. Loading is visible, not announced.
     Blocking errors are the assertive notice, not this region.

     It reads the same sentence the status line does, rather than composing a
     second one: they described the same answer in two wordings, and a paged
     answer made them disagree outright — "10 results" spoken over "Showing
     11–20 of 34" on screen. Typographic quotes and the en dash go, because a
     screen reader pronounces them. */
  const liveMessage = tooShort
    ? "Query too short"
    : trimmed && status.count
      ? `${status.count.replace(/[“”]/g, "").replace("–", " to ")}.`
      : trimmed && state === "no-results"
        ? `No results${answered ? ` for ${answered}` : ""}.`
        : "";

  return (
    <div className={styles.panel} data-variant={variant} data-search-state={state} data-measure-id="search-panel" data-measure-section="search">
      <div className={styles.queryRow}>
        <FieldShell fieldId={inputId} label="Search the site" className={styles.queryField}>
          <div className={styles.queryControl}>
            <FieldControl
              ref={inputRef}
              id={inputId}
              className={styles.queryInput}
              type="search"
              value={query}
              placeholder="A claim, a name, a place"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              role="combobox"
              aria-expanded={hits.length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
              onChange={(event) => handleChange(event.target.value)}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={() => setComposing(false)}
              onKeyDown={onKeyDown}
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                iconOnly
                aria-label="Clear search"
                onClick={() => {
                  handleChange("");
                  inputRef.current?.focus();
                }}
              >
                <Icon name="close" size={18} />
              </Button>
            ) : null}
            {variant === "overlay" ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onDismiss?.()} aria-label="Close search">
                Esc
              </Button>
            ) : null}
          </div>
        </FieldShell>
        {/* A determinate bar would be a lie — the request has no progress to
            report. This is a state indicator that happens to move. */}
        <span className={styles.pulse} data-running={state === "loading" ? "" : undefined} aria-hidden="true" />
      </div>

      {status.count || status.matching ? (
        <p className={styles.resultStatus}>
          {status.count ? (
            /* The polite region below already announces this count on every
               change; a visible second copy in the accessibility tree would
               make a screen reader say it twice. The matcher sentence beside
               it is not hidden — it was reachable from the footer before and
               it is the honest half of the line. */
            <span className={styles.resultCount} aria-hidden="true">
              {status.count}
            </span>
          ) : null}
          {status.matching ? <span className={styles.resultFact}>{status.matching}</span> : null}
        </p>
      ) : null}

      {/* Between the count and the list, where a filter belongs: it narrows the
          number above it and the rows below it, and it renders only when there
          is more than one kind to choose between. */}
      {answering && !tooShort ? (
        <SearchFilters
          facets={facets}
          selected={entityType}
          onSelect={pickKind}
          label={answered ? `Filter results for ${answered} by kind` : "Filter results by kind"}
        />
      ) : null}

      {body}

      <p className={styles.srOnly} {...politeLive}>
        {liveMessage}
      </p>

      {hits.length > 0 && !tooShort ? (
        <SearchResults
          hits={hits}
          activeIndex={activeIndex}
          optionId={optionId}
          listboxId={listboxId}
          listboxLabel={answered ? `Results for ${answered}` : "Results"}
          onHover={setActiveIndex}
          onNavigate={() => {
            remember(query);
            onDismiss?.();
          }}
          stale={showingStale}
          offset={answeredOffset}
        />
      ) : (
        /* The listbox must exist for `aria-controls` to resolve even when it
           is empty, or the combobox points at nothing. */
        <div id={listboxId} role="listbox" aria-label="Results" className={styles.emptyListbox} />
      )}

      {answering && !tooShort ? (
        <SearchPager
          page={page}
          pageCount={pageCount}
          onSelect={goToPage}
          label={answered ? `Result pages for ${answered}` : "Result pages"}
          busy={showingStale}
        />
      ) : null}

      {/* The footer is the keyboard grammar and nothing else: the matcher
          sentence that used to share it now rides with the count, above the
          list. It stays last in the DOM, and a phone — which has neither
          arrow keys nor Escape — hides it outright in the narrow branch. */}
      <p className={styles.foot}>
        <span className={styles.footKeys} aria-hidden="true">
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          <span>move</span>
          <kbd>↵</kbd>
          <span>open</span>
          <kbd>esc</kbd>
          <span>{variant === "overlay" ? "close" : "clear"}</span>
        </span>
      </p>
    </div>
  );
}

function PanelPrimer({ recents, onPick }: { recents: string[]; onPick: (query: string) => void }) {
  const recentsId = useId();
  const primersId = useId();
  const primers = PRIMER_QUERIES.filter(
    (query) => !recents.some((recent) => recent.toLowerCase() === query.toLowerCase()),
  );

  return (
    <div className={styles.primer}>
      <p>
        Stories, investigations, claims and the sources behind them. Names and
        transliterations match even when spelled differently.
      </p>
      {recents.length > 0 ? (
        <SuggestionChips
          labelledBy={recentsId}
          label="Recent"
          queries={recents}
          onPick={onPick}
        />
      ) : null}
      {primers.length > 0 ? (
        <SuggestionChips
          labelledBy={primersId}
          label="Try a claim, a name, or a place"
          queries={primers}
          onPick={onPick}
        />
      ) : null}
    </div>
  );
}

function SuggestionChips({
  labelledBy,
  label,
  queries,
  onPick,
}: {
  labelledBy: string;
  label: string;
  queries: readonly string[];
  onPick: (query: string) => void;
}) {
  return (
    <div className={styles.suggestions}>
      <p className={styles.suggestionsLabel} id={labelledBy}>
        {label}
      </p>
      <ul className={styles.chips} aria-labelledby={labelledBy}>
        {queries.map((query) => (
          <li key={query}>
            <Button type="button" variant="ghost" size="md" onClick={() => onPick(query)}>
              {query}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* The one place the matcher is described (UX-28). A reader who got nothing
   can act on "a paraphrase will miss"; a reader looking at eight results, or
   at "Searching…", could not, so the sentence is not rendered there. */
function PanelEmpty({ query, semantic }: { query: string; semantic: boolean }) {
  return (
    <StatusState
      status="empty"
      className={styles.status}
      eyebrow="SEARCH"
      title={`No matches for “${query}”.`}
      description={
        semantic
          ? "Try a name, a place or a claim."
          : "Try a name, a place or a claim. This deployment matches words and names rather than meaning, so a paraphrase will miss."
      }
    />
  );
}

/* A 429 shows two sentences of its own and nothing from the response. The
   API's `detail` names the ceiling and the window — an operator's sentence,
   and the audit (UX-27) found it rendered under this title with an HTTP
   status in it. A reader has one thing to do with a rate limit, and it is
   in the body; `useSearch` keeps the typed query, so nothing is lost. Every
   other failure keeps the API's `detail`, which is written for a person and
   carries no status code (`fallbackDetail` in `http.ts`).
   The status is read as well as the code: the API nests its body under
   `error` (`server/http/responses.ts`) while `requestJson` reads the code
   from the top level, so a real 429 arrived here as `UNKNOWN` and took the
   generic branch — which is how the audit saw an HTTP line under a search
   box. The status is the one fact that survives any parse. */
function PanelProblem({ problem, onRetry }: { problem: ApiProblem; onRetry: () => void }) {
  const limited = problem.code === "RATE_LIMITED" || problem.status === 429;
  return (
    <StatusState
      status="error"
      className={styles.status}
      eyebrow="SEARCH"
      title={limited ? "Too many searches, too fast." : "The search failed."}
      description={limited ? "Wait a few seconds and search again." : problem.detail}
      actionText={limited ? undefined : "Try again"}
      onAction={limited ? undefined : onRetry}
    />
  );
}

function subscribeRecents(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === RECENTS_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(RECENTS_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(RECENTS_EVENT, onStoreChange);
  };
}

let recentsSnapshot: string[] = EMPTY_RECENTS;
let recentsRaw: string | null = null;

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (raw === recentsRaw) return recentsSnapshot;
    recentsRaw = raw;
    if (!raw) {
      recentsSnapshot = EMPTY_RECENTS;
      return recentsSnapshot;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      recentsSnapshot = EMPTY_RECENTS;
      return recentsSnapshot;
    }
    const next = parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      .slice(0, RECENTS_MAX);
    recentsSnapshot = next.length ? next : EMPTY_RECENTS;
    return recentsSnapshot;
  } catch {
    recentsRaw = null;
    recentsSnapshot = EMPTY_RECENTS;
    return recentsSnapshot;
  }
}

function rememberQuery(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  const next = [trimmed, ...readRecents().filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    RECENTS_MAX,
  );
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* Private mode — recents stay in this visit's memory only if the write fails. */
  }
  window.dispatchEvent(new Event(RECENTS_EVENT));
}
