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
 * invalid-query, error. Retry is the error action, not a separate view.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FieldShell } from "@/components/ui/Field";
import { StatusState } from "@/components/ui/StatusState";
import fieldStyles from "@/components/ui/field.module.css";
import { politeLive } from "@/components/ui/live-region";
import { SearchResults } from "./SearchResults";
import { useSearch } from "./useSearch";
import { ApiProblem } from "./http";
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
  autoFocus?: boolean;
  /** Called when the reader leaves — Escape on an empty query, or a result
   *  opened. The page variant passes nothing. */
  onDismiss?: () => void;
  /** Mirrors the query into the address bar on `/search`, so a result set is
   *  linkable and survives a reload. */
  onQueryChange?: (query: string) => void;
}

export function SearchPanel({
  variant,
  initialQuery = "",
  autoFocus = false,
  onDismiss,
  onQueryChange,
}: SearchPanelProps) {
  const router = useRouter();
  const { query, setQuery, answered, hits, state, semantic, problem, retry } = useSearch(initialQuery);
  const recents = useSyncExternalStore(subscribeRecents, readRecents, () => EMPTY_RECENTS);

  /* The selection resets when a new result set lands. Adjusted during render
     rather than in an effect: React runs the extra pass before painting, so
     nothing flashes, and the alternative is the cascading render that
     `react-hooks/set-state-in-effect` refuses. */
  const [selection, setSelection] = useState({ query: answered, index: 0 });
  if (selection.query !== answered) setSelection({ query: answered, index: 0 });

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

  const trimmed = query.trim();
  const tooShort = trimmed.length === 1;
  const showingStale = state === "loading" && hits.length > 0;
  const searchState =
    state === "error" && problem
      ? "error"
      : !trimmed
        ? "idle"
        : tooShort
          ? "invalid-query"
          : state === "loading"
            ? "loading"
            : state === "ready" && !hits.length
              ? "no-results"
              : "results";
  const body = useMemo(() => {
    if (state === "error" && problem) {
      return <PanelProblem problem={problem} onRetry={retry} />;
    }
    if (!trimmed) return <PanelPrimer recents={recents} onPick={fillQuery} />;
    if (tooShort) {
      return <p className={styles.notice}>Type at least two characters to search.</p>;
    }
    if (state === "loading" && !hits.length) {
      return <p className={styles.notice}>Searching the index…</p>;
    }
    if (state === "ready" && !hits.length) {
      return <PanelEmpty query={answered} semantic={semantic} />;
    }
    return null;
  }, [state, problem, retry, trimmed, tooShort, hits.length, answered, semantic, recents, fillQuery]);

  /* Counts and invalid-query only. Loading is visible, not announced.
     Blocking errors are the assertive notice, not this region. */
  const liveMessage = tooShort
    ? "Query too short"
    : trimmed && state === "ready"
      ? `${hits.length} ${hits.length === 1 ? "result" : "results"}${answered ? ` for ${answered}` : ""}.`
      : "";

  return (
    <div className={styles.panel} data-variant={variant} data-search-state={searchState}>
      <div className={styles.queryRow}>
        <FieldShell fieldId={inputId} label="Search the corpus" className={styles.queryField}>
          <div className={styles.queryControl}>
            <input
              ref={inputRef}
              id={inputId}
              className={`${fieldStyles.control} ${styles.queryInput}`}
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
              onKeyDown={onKeyDown}
            />
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
        />
      ) : (
        /* The listbox must exist for `aria-controls` to resolve even when it
           is empty, or the combobox points at nothing. */
        <div id={listboxId} role="listbox" aria-label="Results" className={styles.emptyListbox} />
      )}

      <p className={styles.foot}>
        <span className={styles.footFact}>
          {semantic
            ? "Matching on words, names and meaning."
            : "Matching on words and names. Semantic matching is off in this deployment."}
        </span>
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
        This searches what the desk has published — briefs, analyses and updates — and the
        claims behind them. Names and transliterations match even when spelled differently.
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

function PanelEmpty({ query, semantic }: { query: string; semantic: boolean }) {
  return (
    <StatusState
      status="empty"
      className={styles.status}
      eyebrow="SEARCH"
      title={`Nothing in the index matches “${query}”.`}
      description={
        semantic
          ? "Try fewer words, or the name of a person or place."
          : "This deployment matches words and names rather than meaning, so a paraphrase will miss. Try the words as they would appear in the text, or a name."
      }
    />
  );
}

function PanelProblem({ problem, onRetry }: { problem: ApiProblem; onRetry: () => void }) {
  const limited = problem.code === "RATE_LIMITED";
  return (
    <StatusState
      status="error"
      className={styles.status}
      eyebrow="SEARCH"
      title={limited ? "Too many searches, too fast." : "The search failed."}
      description={
        limited
          ? `${problem.detail} Wait a moment and search again — nothing is lost.`
          : problem.detail
      }
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
