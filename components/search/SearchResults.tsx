"use client";

/**
 * The result list — grouped by kind, ordered by relevance inside each group.
 *
 * Three decisions here are contract, not taste.
 *
 * **The RRF score is never rendered.** `searchHitSchema` says so in as many
 * words: it is a fusion value, comparable only within one result set, and
 * showing it as a percentage or a confidence would be an invented number on a
 * page about not inventing numbers. It orders the list and appears nowhere.
 *
 * **A URL is never rendered as prose.** Until 2026-09-14 the row's description
 * was the destination path, so a reader searching "October 7" met
 * `/articles/how-to-read-the-october-7-archive-source-taxonom-zjy4f` set in the
 * site's body face in the slot where a sentence belongs. The description is now
 * the record's own standfirst (`hit.summary`), which is the same sentence it
 * shows on its own page and in every card on the site — so a result a reader
 * recognises here is recognisable again when they arrive. A record with no
 * standfirst renders **nothing** in that slot. An empty line is honest; a path
 * dressed as a summary is not, and neither is a placeholder.
 *
 * **Every row a reader is shown can be opened.** That is enforced in
 * `server/modules/search/service.ts`, where a hit with no destination is
 * dropped from the reader's result set entirely (owner ruling, 2026-09-14) —
 * not here, because the component only ever renders what the API hands it. The
 * inert branch below survives as the honest rendering of a null `href` should
 * one ever arrive; it no longer prints "Indexed · no public page", because the
 * rows that produced that line — raw wire evidence, most of it, several items
 * hostile and uncontextualised — are no longer offered as this desk's answer to
 * a reader's question.
 */

import {
  Card,
  CardCta,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { RECORD_TRANSITION_TYPE, recordViewNamesFromHref } from "@/lib/record-view-names";
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
  /** Where this page starts in the whole result set, so the gutter ordinals
   *  count 11, 12, 13 on page two rather than starting again at 01. */
  offset: number;
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
  offset,
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
                ordinal={offset + index + 1}
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
  ordinal,
  active,
  id,
  onHover,
  onNavigate,
}: {
  hit: SearchHit;
  index: number;
  ordinal: number;
  active: boolean;
  id: string;
  onHover: (index: number) => void;
  onNavigate: () => void;
}) {
  const href = hit.href;
  /* Trimmed and emptiness-checked rather than tested for null: a stored
     standfirst of `""` or a line of whitespace must render as nothing, not as
     an empty description with the spacing of a real one. */
  const summary = hit.summary?.trim() || null;
  /* The hit's shared record elements (stage 7): a hit for a publication pairs
     its title and kind label with the record page's headline and kicker, so
     clicking the row morphs them into place. */
  const viewNames = recordViewNamesFromHref(href);
  const inner = (
    <>
      <span className={styles.hitOrdinal} aria-hidden="true">
        {String(ordinal).padStart(2, "0")}
      </span>
      <div className={styles.hitBody}>
        <CardHeader className={styles.hitHeader}>
          <CardEyebrow viewName={viewNames?.kicker ?? null}>{entityLabel(hit.entityType)}</CardEyebrow>
        </CardHeader>
        <CardTitle as="span" className={styles.hitTitle} viewName={viewNames?.headline ?? null}>
          {hit.title}
        </CardTitle>
        {summary ? (
          <CardDescription className={styles.hitSummary}>{summary}</CardDescription>
        ) : null}
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
      data-measure-id={`search-result-${hit.documentId}`}
      data-measure-event="search_result_click"
      data-measure-section="search"
      data-measure-content={hit.publicId ?? hit.entityId}
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
      transitionTypes={viewNames ? [RECORD_TRANSITION_TYPE] : undefined}
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      className={styles.hit}
      data-active={active ? "" : undefined}
      data-entity-type={hit.entityType}
      /* `search_result_click` was declared on the *inert* branch only, so the
         one thing worth measuring — a reader opening a result — was measured
         on precisely the rows nobody could open. */
      data-measure-id={`search-result-${hit.documentId}`}
      data-measure-event="search_result_click"
      data-measure-section="search"
      data-measure-content={hit.publicId ?? hit.entityId}
      onPointerMove={() => onHover(index)}
      onClick={onNavigate}
    >
      {inner}
    </Card>
  );
}
