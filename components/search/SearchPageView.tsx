"use client";

/**
 * `/search` as a page rather than an overlay.
 *
 * The query is mirrored into the address bar so a result set can be linked,
 * bookmarked and reloaded — but with `history.replaceState` rather than
 * `router.replace`. A router replace would re-run the server component on
 * every keystroke, which is a network round trip to render markup that has not
 * changed; the native call updates the URL and nothing else. Next supports
 * this directly and keeps its own history in step.
 *
 * The initial query arrives as a prop from the server component, not from
 * `useSearchParams()`. That hook forces the page under a Suspense boundary
 * during prerender, and a Suspense boundary is precisely what broke this
 * site's no-JavaScript render once already (`app/loading.tsx`,
 * `.ai/DECISIONS.md`). Reading `searchParams` in the page and passing it down
 * costs nothing and cannot do that.
 */

import { useCallback } from "react";
import { SearchPanel } from "./SearchPanel";

export function SearchPageView({ initialQuery }: { initialQuery: string }) {
  const onQueryChange = useCallback((query: string) => {
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }, []);

  /* Focused on an empty page, where the box is the only thing to do — and
     deliberately not when a query arrived in the URL, because then the reader
     came for the results and moving focus past them would make the first thing
     their keyboard does be "clear that query". */
  return (
    <SearchPanel
      variant="page"
      initialQuery={initialQuery}
      autoFocus={!initialQuery.trim()}
      onQueryChange={onQueryChange}
    />
  );
}
