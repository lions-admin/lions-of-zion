"use client";

/**
 * `/search` as a page rather than an overlay.
 *
 * The result set is mirrored into the address bar so it can be linked,
 * bookmarked and reloaded — the query, the kind filter and the page number,
 * since a link to "page 3, analyses only" that opens on page 1 of everything is
 * not a link to what the reader was looking at.
 *
 * All three are written with `history.replaceState` rather than
 * `router.replace`. A router replace would re-run the server component on every
 * keystroke, which is a network round trip to render markup that has not
 * changed; the native call updates the URL and nothing else. Next supports this
 * directly and keeps its own history in step.
 *
 * The initial values arrive as props from the server component, not from
 * `useSearchParams()`. That hook forces the page under a Suspense boundary
 * during prerender, and a Suspense boundary is precisely what broke this
 * site's no-JavaScript render once already (`app/loading.tsx`,
 * `.ai/DECISIONS.md`). Reading `searchParams` in the page and passing it down
 * costs nothing and cannot do that — and it is also where the `type` parameter
 * is validated against the entity-type enum, which is a Zod value the client
 * graph must not import (see `vocabulary.ts`).
 */

import { useCallback, useRef } from "react";
import type { EntityType } from "@/server/contracts/enums";
import { SearchPanel } from "./SearchPanel";

export interface SearchPageViewProps {
  initialQuery: string;
  /** Already validated against the enum by the route; null when the URL named
   *  no kind, or named one that is not a kind. */
  initialEntityType?: EntityType | null;
  /** 0-based. */
  initialPage?: number;
}

export function SearchPageView({
  initialQuery,
  initialEntityType = null,
  initialPage = 0,
}: SearchPageViewProps) {
  /* The three parameters are written by two callbacks that fire independently
     — the query on a keystroke, the scope on a click — and each writes the
     whole URL. Without a shared record of the other's value, whichever fired
     last would erase what the other had put there: typing a letter would drop
     the reader back to page 1 in the address bar while the panel stayed on
     page 3. A ref, not state: nothing renders from it. */
  const scope = useRef({ entityType: initialEntityType, page: initialPage });
  const query = useRef(initialQuery);

  const write = useCallback(() => {
    const url = new URL(window.location.href);
    const trimmed = query.current.trim();
    if (trimmed) url.searchParams.set("q", trimmed);
    else url.searchParams.delete("q");

    if (trimmed && scope.current.entityType) url.searchParams.set("type", scope.current.entityType);
    else url.searchParams.delete("type");

    /* One-based in the URL, and absent on the first page: `?page=1` is noise in
       a link, and a reader who copies one expects it to be the address of what
       they are looking at, not of the machinery. */
    if (trimmed && scope.current.page > 0) url.searchParams.set("page", String(scope.current.page + 1));
    else url.searchParams.delete("page");

    window.history.replaceState(null, "", url);
  }, []);

  const onQueryChange = useCallback(
    (next: string) => {
      /* Compared against the last value written rather than the one the page
         loaded with, so typing a letter and deleting it again is correctly a
         no-op. A new query is a new result set, and the page number it carried
         describes an answer that no longer exists — `useSearch` has already
         dropped it, and the URL must say the same thing. The kind filter
         survives, because it does there too. */
      const changed = next.trim() !== query.current.trim();
      query.current = next;
      if (changed) scope.current = { ...scope.current, page: 0 };
      write();
    },
    [write],
  );

  const onScopeChange = useCallback(
    (next: { entityType: EntityType | null; page: number }) => {
      scope.current = next;
      write();
    },
    [write],
  );

  /* Focused on an empty page, where the box is the only thing to do — and
     deliberately not when a query arrived in the URL, because then the reader
     came for the results and moving focus past them would make the first thing
     their keyboard does be "clear that query". */
  return (
    <SearchPanel
      variant="page"
      initialQuery={initialQuery}
      initialScope={{ entityType: initialEntityType, page: initialPage }}
      autoFocus={!initialQuery.trim()}
      onQueryChange={onQueryChange}
      onScopeChange={onScopeChange}
    />
  );
}
