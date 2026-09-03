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
 *
 * `SearchHit` is only documentId, entityType, entityId, publicId, href,
 * title, score. The row renders type, title, and destination (`href`, or
 * “Indexed · no public page”). Score is never shown. Date, excerpt, and
 * verification are not on the contract — SEARCH-002 is data-blocked for
 * those three rather than inventing them.
 */

import {
  Card,
  CardCta,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
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
            return (
              <SearchHitOption
                key={hit.documentId}
                hit={hit}
                index={index}
                active={index === activeIndex}
                id={optionId(index)}
                onHover={onHover}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function SearchHitOption({
  hit,
  index,
  active,
  id,
  onHover,
  onNavigate,
}: {
  hit: SearchHit;
  index: number;
  active: boolean;
  id: string;
  onHover: (index: number) => void;
  onNavigate: () => void;
}) {
  const ordinal = String(index + 1).padStart(2, "0");
  const href = hit.href;
  const inner = (
    <>
      <span className={styles.hitOrdinal} aria-hidden="true">
        {ordinal}
      </span>
      <div className={styles.hitBody}>
        <CardHeader className={styles.hitHeader}>
          <CardEyebrow>{entityLabel(hit.entityType)}</CardEyebrow>
        </CardHeader>
        <CardTitle as="span" className={styles.hitTitle}>
          {hit.title}
        </CardTitle>
        {href ? (
          <CardDescription className={styles.hitDestination}>{href}</CardDescription>
        ) : (
          <CardDescription className={styles.hitDestination}>
            <span className={styles.hitUnreachable}>Indexed · no public page</span>
          </CardDescription>
        )}
      </div>
      {href ? <CardCta className={styles.hitCta}>Open</CardCta> : null}
    </>
  );

  if (!href) {
    return (
      <Card
        variant="row"
        as="div"
        id={id}
        role="option"
        aria-selected={active}
        aria-disabled="true"
        tabIndex={-1}
        className={`${styles.hit} ${styles.hitInert}`}
        data-active={active ? "" : undefined}
        data-entity-type={hit.entityType}
        onPointerMove={() => onHover(index)}
      >
        {inner}
      </Card>
    );
  }

  return (
    <Card
      variant="row"
      href={href}
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      className={styles.hit}
      data-active={active ? "" : undefined}
      data-entity-type={hit.entityType}
      onPointerMove={() => onHover(index)}
      onClick={onNavigate}
    >
      {inner}
    </Card>
  );
}
