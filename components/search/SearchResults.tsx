"use client";

/**
 * The result list — grouped by kind, ordered by relevance inside each group.
 *
 * Two decisions here are contract, not taste.
 *
 * **The RRF score is never rendered.** `searchHitSchema` says so in as many
 * words: it is a fusion value, comparable only within one result set, and
 * showing it as a percentage or a confidence would be an invented number on a
 * page about not inventing numbers. It orders the list and appears nowhere.
 *
 * **A hit with no `href` renders as a hit with no href.** Publications are
 * addressable only through `/articles/[publicId]`, which is briefing-only, and
 * information items have a public id and no page at all. Fabricating a URL
 * from `publicId` would turn a search result into a 404. So an unreachable hit
 * is a `<div>`, not an `<a>`: it is announced as disabled, it cannot be
 * focused into by mistake, and it says in words that the record is indexed and
 * has no page. Hiding those rows instead was the alternative and is worse —
 * it would mean a reader searching for a claim we hold is told we do not hold
 * it.
 */

import Link from "next/link";
import type { SearchHit } from "@/server/contracts/search";
import { entityLabel, entityLabelPlural, groupByEntity } from "./vocabulary";
import styles from "./search.module.css";

interface SearchResultsProps {
  hits: SearchHit[];
  /** Index into the flattened list, or -1. Drives `aria-activedescendant`. */
  activeIndex: number;
  optionId: (index: number) => string;
  listboxId: string;
  listboxLabel: string;
  onHover: (index: number) => void;
  onNavigate: () => void;
  /** Dims the list while a newer query is in flight, rather than emptying it. */
  stale: boolean;
}

export function SearchResults({
  hits,
  activeIndex,
  optionId,
  listboxId,
  listboxLabel,
  onHover,
  onNavigate,
  stale,
}: SearchResultsProps) {
  const groups = groupByEntity(hits);
  let flat = -1;

  return (
    <div
      className={styles.results}
      id={listboxId}
      role="listbox"
      aria-label={listboxLabel}
      aria-busy={stale || undefined}
      data-stale={stale ? "" : undefined}
    >
      {groups.map((group) => (
        <div className={styles.group} key={group.type}>
          <p className={styles.groupHead}>
            <span>{group.items.length === 1 ? entityLabel(group.type) : entityLabelPlural(group.type)}</span>
            <span className={styles.groupCount}>{String(group.items.length).padStart(2, "0")}</span>
          </p>
          {group.items.map((hit) => {
            const index = ++flat;
            const active = index === activeIndex;
            const id = optionId(index);
            const ordinal = String(index + 1).padStart(2, "0");

            if (!hit.href) {
              return (
                <div
                  key={hit.documentId}
                  id={id}
                  role="option"
                  aria-selected={active}
                  aria-disabled="true"
                  className={`${styles.hit} ${styles.hitInert}`}
                  data-active={active ? "" : undefined}
                  onPointerMove={() => onHover(index)}
                >
                  <span className={styles.hitOrdinal} aria-hidden="true">{ordinal}</span>
                  <span className={styles.hitBody}>
                    <span className={styles.hitTitle}>{hit.title}</span>
                    <span className={styles.hitMeta}>
                      {entityLabel(hit.entityType)}
                      <span className={styles.hitUnreachable}>Indexed · no public page</span>
                    </span>
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={hit.documentId}
                id={id}
                href={hit.href}
                role="option"
                aria-selected={active}
                className={styles.hit}
                data-active={active ? "" : undefined}
                tabIndex={-1}
                onPointerMove={() => onHover(index)}
                onClick={onNavigate}
              >
                <span className={styles.hitOrdinal} aria-hidden="true">{ordinal}</span>
                <span className={styles.hitBody}>
                  <span className={styles.hitTitle}>{hit.title}</span>
                  <span className={styles.hitMeta}>
                    {entityLabel(hit.entityType)}
                    <span className={styles.hitPath}>{hit.href}</span>
                  </span>
                </span>
                <span className={styles.hitArrow} aria-hidden="true">↗</span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
