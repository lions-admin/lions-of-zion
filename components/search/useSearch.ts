"use client";

/**
 * The query loop behind both the overlay and `/search`.
 *
 * "Must feel instantaneous" is a latency budget, not a style, and three things
 * buy it:
 *
 *   1. **A per-request cache.** Backspacing through a word re-visits queries
 *      already answered; re-asking the network for them is the single most
 *      visible way a search box feels slow. Paging back to a page already seen
 *      is the same move, which is why the cache is keyed by the whole request
 *      — query, kind and page — rather than by the query alone. It is a
 *      keystroke buffer, not a data store, and it lives and dies with the panel.
 *   2. **Last results stay on screen.** A list that empties on every keystroke
 *      flickers, and the flicker reads as slower than the request actually is.
 *      While a newer query is in flight the previous answer is still rendered,
 *      dimmed, rather than replaced by nothing.
 *   3. **One request in flight.** Every new keystroke aborts the last, so a
 *      slow early request can never land after a fast later one and overwrite
 *      it — and the abort never surfaces as an error.
 *
 * The debounce is 300ms, up from 120ms (UX-27, 2026-09-08). 120ms was chosen
 * as "under the ~150ms where a person perceives lag", and for a fast typist it
 * was: at 30–80ms a key the panel sent one or two requests per query. It was
 * the *slow* typist it failed. Measured in the browser at 200ms a key — a
 * phone, or anyone hunting for keys — it sent one request per keystroke,
 * fifteen for "hezbollah rockets", and the abort below cancels only the
 * client's wait: the server has already counted the request against the
 * 120-a-minute ceiling in `SEARCH_QUERIES`. Eight such queries in a minute
 * was a 429 inside one short session. 300ms is longer than the gap between
 * two keys of a word being typed at any speed, so a request now means a
 * pause, and the per-request cache still makes a backspace free.
 *
 * **Everything the panel renders is derived here, not stored.** The status, the
 * hits and the error are all functions of the request, the cache and the last
 * failure — so the effect below starts network work and writes state only from
 * inside a promise continuation. Storing a `status` beside the cache would let
 * the two disagree, and would need exactly the cascading effect that
 * `react-hooks/set-state-in-effect` refuses.
 *
 * The same rule shapes how the page number resets. A new query, or a new kind
 * filter, must start at page one — and doing that in an effect is the
 * cascading render again. So the page is stored *with the request it belongs
 * to*, and a page held against a stale request reads as zero. No effect, no
 * `setState` during render, and no window in which page 3 of the previous
 * query is requested for the current one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EntityType } from "@/server/contracts/enums";
import type { SearchFacet, SearchHit, SearchResult } from "@/server/contracts/search";
import { ApiProblem, isAbort, requestJson } from "./http";
import { redactQuery } from "@/components/measurement/redact";

function measureSearch(name: string, detail: Record<string, unknown>) {
  try {
    window.dispatchEvent(new CustomEvent("lz:measure", { detail: { name, ...detail } }));
  } catch {
    /* ignore */
  }
}


/**
 * The user-visible search contract. `fallback` is a successful lexical-only
 * answer, not an error and not an empty state. Keeping it explicit prevents a
 * deployment without the semantic arm from presenting partial retrieval as
 * the full search capability.
 */
export type SearchState =
  | "idle"
  | "invalid-query"
  | "loading"
  | "results"
  | "no-results"
  | "fallback"
  | "error";

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
  /** The kind filter, or null for every kind. */
  entityType: EntityType | null;
  setEntityType: (next: EntityType | null) => void;
  /** Counts per kind over the whole result set, from the server. Empty until
   *  an answer lands, so the filter row appears with its counts or not at all. */
  facets: SearchFacet[];
  /** Every result this query has, not the number on this page. */
  total: number;
  /** `total` is a floor: retrieval hit its candidate ceiling. */
  totalIsFloor: boolean;
  /** 0-based, and always within `pageCount`. The page that has been *asked
   *  for*, which is what the pager marks current — it moves the moment the
   *  reader clicks, before the answer lands. */
  page: number;
  /**
   * Where the hits on screen actually start, echoed by the server.
   *
   * Not `page * pageSize`, and the difference is visible: while page 2 is in
   * flight the panel is still showing page 1's rows, dimmed, and numbering them
   * from `page` renumbered those rows 11–20 for the length of the request. The
   * ordinals and the "Showing 11–15 of 15" line both describe the rows a reader
   * is looking at, so both read this.
   */
  answeredOffset: number;
  pageCount: number;
  setPage: (next: number) => void;
  pageSize: number;
}

export function classifySearchState(
  query: string,
  answer: Pick<SearchResult, "hits" | "semantic"> | undefined,
  problem: ApiProblem | null,
): SearchState {
  const trimmed = query.trim();
  if (!trimmed) return "idle";
  if (trimmed.length < 2) return "invalid-query";
  if (problem) return "error";
  if (!answer) return "loading";
  if (answer.hits.length === 0) return "no-results";
  return answer.semantic ? "results" : "fallback";
}

const DEBOUNCE_MS = 300;
const REQUEST_TIMEOUT_MS = 15_000;
/**
 * Ten, not the twenty-five this hard-coded before there was any way past the
 * first page.
 *
 * Twenty-five was the whole answer, so it had to be large enough to hold one.
 * With a pager under the list the page is a reading unit instead: ten rows,
 * each now carrying a summary, is about one screen of scanning on a laptop and
 * a short scroll on a phone — and the pager renders only when there is a second
 * page, so the common small answer looks exactly as it did.
 */
const PAGE_SIZE = 10;
const EMPTY: SearchHit[] = [];
const EMPTY_FACETS: SearchFacet[] = [];

/** One request, as a cache key. The page is part of it: page 2 of a query is a
 *  different answer from page 1 of the same query, and conflating them is how a
 *  cache serves the wrong rows. Built with `JSON.stringify`, so
 *  it needs no separator character that the three can be trusted never to
 *  contain. */
const requestKeyFor = (query: string, entityType: EntityType | null, page: number) =>
  JSON.stringify([query, entityType, page]);

/** What `/search` restores from the address bar. Validated on the server, in
 *  `app/search/page.tsx`, because validating it here would mean importing the
 *  entity-type enum as a *value* — and that one word links the whole of `zod`
 *  into the client graph of every route that renders the site header. See the
 *  note at the top of `vocabulary.ts`; it was measured at 62.7 kB gzip. */
export interface SearchScope {
  entityType?: EntityType | null;
  page?: number;
}

/** The scope a page number belongs to: one query, one kind filter. Two requests
 *  share a page counter exactly when they share these. */
const scopeOf = (query: string, entityType: EntityType | null) =>
  JSON.stringify([query.trim(), entityType]);

export function useSearch(initialQuery = "", composing = false, initial: SearchScope = {}): UseSearch {
  const [query, setQueryState] = useState(initialQuery);
  const [entityType, setEntityTypeState] = useState<EntityType | null>(initial.entityType ?? null);
  /** Answered requests. Replaced rather than mutated, so a landed result
   *  re-renders the panel. */
  const [answers, setAnswers] = useState<ReadonlyMap<string, SearchResult>>(() => new Map());
  const [failure, setFailure] = useState<{ key: string; problem: ApiProblem } | null>(null);
  /** Bumped by `retry()` to re-run a request the cache no longer holds. */
  const [attempt, setAttempt] = useState(0);

  /**
   * The page, stored against the *scope* it belongs to — the query and the kind
   * filter together. When the scope changes, the stored page describes a
   * different question and is read as zero, so a new query can never be asked
   * for page 3. Derivation rather than an effect, deliberately: see the module
   * note above.
   */
  const [pageState, setPageState] = useState(() => ({
    /* Seeded against the scope the URL described, so a linked `?q=…&page=3`
       opens on page three — and against *that* scope only, so the first
       keystroke drops it. */
    scope: scopeOf(initialQuery, initial.entityType ?? null),
    page: Math.max(initial.page ?? 0, 0),
  }));

  /** The most recent answer of any request, kept so the list can stay on screen
   *  while the next one loads. State rather than a ref, because it is read
   *  during render — which is the definition of "needed for rendering". */
  const [carried, setCarried] = useState<SearchResult | null>(null);

  const controller = useRef<AbortController | null>(null);
  /** The last query measured from this box, for `search_refine`. */
  const measuredQuery = useRef<string | null>(null);

  const trimmed = query.trim();
  const scope = scopeOf(query, entityType);
  const page = pageState.scope === scope ? pageState.page : 0;
  const key = requestKeyFor(trimmed, entityType, page);

  const answer = answers.get(key);
  const problem = failure && failure.key === key ? failure.problem : null;

  const state = classifySearchState(trimmed, answer, problem);

  useEffect(() => {
    controller.current?.abort();
    if (composing || trimmed.length < 2 || answer || problem) return;

    const abort = new AbortController();
    controller.current = abort;

    let requestTimeout: number | undefined;
    const timer = window.setTimeout(() => {
      requestTimeout = window.setTimeout(() => {
        setFailure({
          key,
          problem: new ApiProblem(
            "TIMEOUT",
            0,
            "The search did not respond within fifteen seconds. Try again.",
          ),
        });
        abort.abort();
      }, REQUEST_TIMEOUT_MS);
      void (async () => {
        try {
          const params = new URLSearchParams({ q: trimmed, limit: String(PAGE_SIZE) });
          if (entityType) params.set("entityType", entityType);
          if (page > 0) params.set("offset", String(page * PAGE_SIZE));
          const result = await requestJson<SearchResult>(`/api/v1/search?${params}`, {
            signal: abort.signal,
          });
          setAnswers((current) => new Map(current).set(key, result));
          setCarried(result);
          /* Every answered query is a `search_query`; an empty answer is
             also a `search_zero_results`, and a query after an earlier one in
             the same box is a `search_refine`. The text only ever leaves
             redacted — truncated, emails and phone numbers stripped.

             Only the first page reports. Paging is one reader continuing to
             read one answer, and counting page 3 as a fourth `search_query`
             would inflate every search figure by however far people read. The
             count reported is `total`, the whole answer, not the ten rows this
             request happened to carry. */
          if (page === 0) {
            const detail = {
              query_redacted: redactQuery(trimmed) ?? undefined,
              payload: { result_count: result.total, zero_results: result.total === 0 },
            };
            measureSearch("search_query", detail);
            if (result.total === 0) measureSearch("search_zero_results", detail);
            if (measuredQuery.current && measuredQuery.current !== trimmed) measureSearch("search_refine", detail);
            measuredQuery.current = trimmed;
          }
        } catch (cause) {
          if (isAbort(cause)) return;
          setFailure({
            key,
            problem:
              cause instanceof ApiProblem
                ? cause
                : new ApiProblem("UNKNOWN", 0, "The search could not be completed."),
          });
        } finally {
          if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
      abort.abort();
    };
  }, [key, trimmed, entityType, page, answer, problem, attempt, composing]);

  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((n) => n + 1);
  }, []);

  const setPage = useCallback(
    (next: number) => setPageState({ scope, page: Math.max(next, 0) }),
    [scope],
  );

  /**
   * Changing the query or the filter is a new question, and it starts at page
   * one. Both **stamp page zero against the scope they are moving to**, rather
   * than relying on the stored scope no longer matching.
   *
   * Measured in the browser 2026-09-14: relying on the mismatch alone is only
   * half a reset, because a reader can come *back*. Page 2 of everything →
   * filter to Briefs (scope differs, page reads 0, correct) → back to All, and
   * the stored `{scope: everything, page: 1}` matched again and page 2
   * reappeared — with `?q=October+7` in the address bar, which said page 1.
   * Overwriting the stamp is what makes the reset survive a return.
   */
  const setEntityType = useCallback(
    (next: EntityType | null) => {
      setEntityTypeState(next);
      setPageState({ scope: scopeOf(query, next), page: 0 });
    },
    [query],
  );

  const setQuery = useCallback(
    (next: string) => {
      setQueryState(next);
      setPageState({ scope: scopeOf(next, entityType), page: 0 });
    },
    [entityType],
  );

  /* Only while a newer request is loading — an idle or errored panel shows the
     state it is actually in, not a set of results from a query the reader has
     already left behind. */
  const stale = state === "loading" ? carried : null;
  const shown = answer ?? stale ?? null;
  const hits = shown?.hits ?? EMPTY;
  const semantic = shown?.semantic ?? false;
  const answered = shown?.query ?? "";
  const total = shown?.total ?? 0;
  const totalIsFloor = shown?.totalIsFloor ?? false;
  const facets = shown?.facets ?? EMPTY_FACETS;
  const answeredOffset = shown?.offset ?? 0;
  const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return useMemo(
    () => ({
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
      /* Clamped against the answer on screen, so a pager can never highlight a
         page that no longer exists — the reader who filters while on page 4 of
         an unfiltered set would otherwise see "4" marked current over one page
         of results. */
      page: Math.min(page, pageCount - 1),
      answeredOffset,
      pageCount,
      setPage,
      pageSize: PAGE_SIZE,
    }),
    [
      query,
      /* `setQuery` is a `useCallback` over `entityType` since the page-reset
         fix, not the raw `useState` setter it used to be — so it is no longer
         stable and has to be listed. A stale copy here would be a copy closed
         over the previous filter, stamping the reset page against the wrong
         scope: the exact bug this callback exists to prevent. */
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
    ],
  );
}
