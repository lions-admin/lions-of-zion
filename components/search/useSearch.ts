"use client";

/**
 * The query loop behind both the overlay and `/search`.
 *
 * "Must feel instantaneous" is a latency budget, not a style, and three things
 * buy it:
 *
 *   1. **A per-query cache.** Backspacing through a word re-visits queries
 *      already answered; re-asking the network for them is the single most
 *      visible way a search box feels slow. It is a keystroke buffer, not a
 *      data store, and it lives and dies with the panel.
 *   2. **Last results stay on screen.** A list that empties on every keystroke
 *      flickers, and the flicker reads as slower than the request actually is.
 *      While a newer query is in flight the previous answer is still rendered,
 *      dimmed, rather than replaced by nothing.
 *   3. **One request in flight.** Every new keystroke aborts the last, so a
 *      slow early request can never land after a fast later one and overwrite
 *      it — and the abort never surfaces as an error.
 *
 * The debounce is deliberately short: 120ms is under the ~150ms where a person
 * begins to perceive lag, and the endpoint's own ceiling (120 queries a
 * minute) is generous enough that a fast typist will not reach it.
 *
 * **Everything the panel renders is derived here, not stored.** The status, the
 * hits and the error are all functions of the query, the cache and the last
 * failure — so the effect below starts network work and writes state only from
 * inside a promise continuation. Storing a `status` beside the cache would let
 * the two disagree, and would need exactly the cascading effect that
 * `react-hooks/set-state-in-effect` refuses.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SearchHit, SearchResult } from "@/server/contracts/search";
import { ApiProblem, isAbort, requestJson } from "./http";

export type SearchState = "idle" | "loading" | "ready" | "error";

export interface UseSearch {
  query: string;
  setQuery: (next: string) => void;
  /** The query `hits` actually describes, which is not `query` while a request
   *  is in flight. */
  answered: string;
  hits: SearchHit[];
  state: SearchState;
  /** Whether the semantic arm contributed, straight from the API. Never
   *  inferred, never assumed true. */
  semantic: boolean;
  problem: ApiProblem | null;
  retry: () => void;
}

const DEBOUNCE_MS = 120;
const LIMIT = 25;
const EMPTY: SearchHit[] = [];

export function useSearch(initialQuery = ""): UseSearch {
  const [query, setQuery] = useState(initialQuery);
  /** Answered queries. Replaced rather than mutated, so a landed result
   *  re-renders the panel. */
  const [answers, setAnswers] = useState<ReadonlyMap<string, SearchResult>>(() => new Map());
  const [failure, setFailure] = useState<{ query: string; problem: ApiProblem } | null>(null);
  /** Bumped by `retry()` to re-run a query the cache no longer holds. */
  const [attempt, setAttempt] = useState(0);

  /** The most recent answer of any query, kept so the list can stay on screen
   *  while the next one loads. State rather than a ref, because it is read
   *  during render — which is the definition of "needed for rendering". */
  const [carried, setCarried] = useState<SearchResult | null>(null);

  const controller = useRef<AbortController | null>(null);

  const trimmed = query.trim();
  const answer = answers.get(trimmed);
  const problem = failure && failure.query === trimmed ? failure.problem : null;

  const state: SearchState = !trimmed
    ? "idle"
    : problem
      ? "error"
      : answer
        ? "ready"
        : "loading";

  useEffect(() => {
    controller.current?.abort();
    if (!trimmed || answer || problem) return;

    const abort = new AbortController();
    controller.current = abort;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await requestJson<SearchResult>(
            `/api/v1/search?q=${encodeURIComponent(trimmed)}&limit=${LIMIT}`,
            { signal: abort.signal },
          );
          setAnswers((current) => new Map(current).set(trimmed, result));
          setCarried(result);
        } catch (cause) {
          if (isAbort(cause)) return;
          setFailure({
            query: trimmed,
            problem:
              cause instanceof ApiProblem
                ? cause
                : new ApiProblem("UNKNOWN", 0, "The search could not be completed."),
          });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [trimmed, answer, problem, attempt]);

  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((n) => n + 1);
  }, []);

  /* Only while a newer query is loading — an idle or errored panel shows the
     state it is actually in, not a set of results from a query the reader has
     already left behind. */
  const stale = state === "loading" ? carried : null;
  const hits = answer?.hits ?? stale?.hits ?? EMPTY;
  const semantic = (answer ?? stale)?.semantic ?? false;
  const answered = (answer ?? stale)?.query ?? "";

  return useMemo(
    () => ({ query, setQuery, answered, hits, state, semantic, problem, retry }),
    [query, answered, hits, state, semantic, problem, retry],
  );
}
