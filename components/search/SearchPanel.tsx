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
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchResults } from "./SearchResults";
import { useSearch } from "./useSearch";
import { ApiProblem } from "./http";
import styles from "./search.module.css";

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

  const handleChange = (next: string) => {
    setQuery(next);
    onQueryChange?.(next);
  };

  const trimmed = query.trim();
  const showingStale = state === "loading" && hits.length > 0;
  const body = useMemo(() => {
    if (state === "error" && problem) {
      return <PanelProblem problem={problem} onRetry={retry} />;
    }
    if (!trimmed) return <PanelPrimer />;
    if (state === "loading" && !hits.length) {
      return <p className={styles.notice}>Searching the index…</p>;
    }
    if (state === "ready" && !hits.length) {
      return <PanelEmpty query={answered} semantic={semantic} />;
    }
    return null;
  }, [state, problem, retry, trimmed, hits.length, answered, semantic]);

  return (
    <div className={styles.panel} data-variant={variant}>
      <div className={styles.queryRow}>
        <label className={styles.queryLabel} htmlFor={inputId}>
          Search the corpus
        </label>
        <input
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
          onKeyDown={onKeyDown}
        />
        {variant === "overlay" ? (
          <button type="button" className={styles.dismiss} onClick={() => onDismiss?.()}>
            <span aria-hidden="true">Esc</span>
            <span className={styles.srOnly}>Close search</span>
          </button>
        ) : null}
        {/* A determinate bar would be a lie — the request has no progress to
            report. This is a state indicator that happens to move. */}
        <span className={styles.pulse} data-running={state === "loading" ? "" : undefined} aria-hidden="true" />
      </div>

      {body}

      {hits.length > 0 ? (
        <SearchResults
          hits={hits}
          activeIndex={activeIndex}
          optionId={optionId}
          listboxId={listboxId}
          listboxLabel={answered ? `Results for ${answered}` : "Results"}
          onHover={setActiveIndex}
          onNavigate={() => onDismiss?.()}
          stale={showingStale}
        />
      ) : (
        /* The listbox must exist for `aria-controls` to resolve even when it
           is empty, or the combobox points at nothing. */
        <div id={listboxId} role="listbox" aria-label="Results" className={styles.emptyListbox} />
      )}

      {/* The count, for a reader who cannot see the list. The combobox pattern
          announces the active option but never how many there are, and "seven
          results" is the first thing a sighted reader gets for free. */}
      <p className={styles.srOnly} role="status" aria-live="polite">
        {state === "ready" && answered
          ? `${hits.length} ${hits.length === 1 ? "result" : "results"} for ${answered}.`
          : ""}
      </p>

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

function PanelPrimer() {
  return (
    <div className={styles.notice}>
      <p>
        This searches what the desk has published — briefs, analyses and updates — and the
        claims behind them. Names and transliterations match even when spelled differently.
      </p>
    </div>
  );
}

function PanelEmpty({ query, semantic }: { query: string; semantic: boolean }) {
  return (
    <div className={styles.notice}>
      <p className={styles.noticeLead}>Nothing in the index matches “{query}”.</p>
      <p>
        {semantic
          ? "Try fewer words, or the name of a person or place."
          : "This deployment matches words and names rather than meaning, so a paraphrase will miss. Try the words as they would appear in the text, or a name."}
      </p>
    </div>
  );
}

function PanelProblem({ problem, onRetry }: { problem: ApiProblem; onRetry: () => void }) {
  const limited = problem.code === "RATE_LIMITED";
  return (
    <div className={styles.notice} data-tone="alert">
      <p className={styles.noticeLead}>{limited ? "Too many searches, too fast." : "The search failed."}</p>
      {/* The API's own `detail` names the ceiling and the window; restating it
          in our words would drift from the real limit the moment it changes. */}
      <p>{problem.detail}</p>
      {limited ? <p>Wait a moment and search again — nothing is lost.</p> : (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
