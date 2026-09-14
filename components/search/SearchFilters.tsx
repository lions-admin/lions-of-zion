"use client";

/**
 * The kind filter — the `entityType` parameter, finally given a control.
 *
 * `searchQuerySchema` has carried `entityType` since Phase 5 and the service
 * has always applied it; nothing in the interface ever sent one, so a reader
 * looking for an analysis among thirty results had no way to say so. This is
 * that control and nothing more: it sets the parameter that already exists.
 *
 * **It is built from the server's facet counts, not from the enum.** Offering
 * every kind would mean offering "Scenario" against a corpus that holds none,
 * and a filter chip that leads to an empty list is a control lying about what
 * is there. So the row shows exactly the kinds this query actually returned,
 * each with its real count, and disappears entirely when there is only one kind
 * to show — a filter with a single option filters nothing.
 *
 * The counts are computed over the *unfiltered* result set (see `facets` in
 * `server/contracts/search.ts`), which is what lets the row stay whole while a
 * filter is active: selecting "Analysis" must not delete the chip that would
 * take the reader back.
 *
 * ## Why these are toggle buttons and not a `<select>`
 *
 * Three or four options, all visible, one tap each. A select costs a tap to
 * open, hides the counts until it is open, and on a phone opens a native wheel
 * over the results the reader is filtering. The selected state is carried by
 * `aria-pressed` — `Button`'s `isActive` emits it — so it is announced rather
 * than merely drawn, and the pressed chip is marked by its border weight and
 * its ink as well as its plate, never by colour alone.
 */

import { Button } from "@/components/ui/Button";
import type { EntityType } from "@/server/contracts/enums";
import type { SearchFacet } from "@/server/contracts/search";
import { entityLabelPlural, entityRank } from "./vocabulary";
import styles from "./search.module.css";

interface SearchFiltersProps {
  facets: SearchFacet[];
  selected: EntityType | null;
  onSelect: (next: EntityType | null) => void;
  /** Names the group for a screen reader, since the visible label is a word
   *  ("Kind") that means little on its own in a list of controls. */
  label: string;
}

export function SearchFilters({ facets, selected, onSelect, label }: SearchFiltersProps) {
  /* One kind is not a choice: the row would say "Analyses 9" beside "All 9"
     and do nothing at all.

     Unless a filter is *on*, in which case it renders however few kinds there
     are, because it is the only way back. A reader who filters to Analyses and
     then types a query that has none would otherwise be left looking at an
     empty result set with no visible cause and no control to undo it. */
  if (facets.length < 2 && selected === null) return null;

  /* Summed from the facets rather than taken from `total`, which is the count
     *after* the filter: with a filter on, "All" would read 0 while offering to
     show everything. */
  const all = facets.reduce((sum, facet) => sum + facet.count, 0);

  /* The editorial ranking from `vocabulary.ts`, so the filter row reads in the
     same order as the groups below it. The server sorts facets by count, which
     is the right order for deciding *whether* to show a chip and the wrong one
     for a reader matching the row against the list. */
  const ordered = [...facets].sort((a, b) => entityRank(a.entityType) - entityRank(b.entityType));

  return (
    <div className={styles.filters} role="group" aria-label={label}>
      <span className={styles.filtersLabel} aria-hidden="true">
        Kind
      </span>
      <Button
        type="button"
        variant="filter"
        size="sm"
        isActive={selected === null}
        onClick={() => onSelect(null)}
        className={styles.filterChip}
      >
        All
        <span className={styles.filterCount}>{all}</span>
      </Button>
      {ordered.map((facet) => (
        <Button
          key={facet.entityType}
          type="button"
          variant="filter"
          size="sm"
          isActive={selected === facet.entityType}
          onClick={() => onSelect(selected === facet.entityType ? null : facet.entityType)}
          className={styles.filterChip}
        >
          {entityLabelPlural(facet.entityType)}
          <span className={styles.filterCount}>{facet.count}</span>
        </Button>
      ))}
    </div>
  );
}
