"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, SelectField } from "@/components/ui";
import styles from "./live-brief.module.css";

const FILTER_ACTION = "/geopolitical-brief";

export type BriefFilterValues = {
  date?: string;
  actor?: string;
  topicLabel?: string;
  arena?: string;
};

export type BriefFiltersProps = {
  filters: BriefFilterValues;
  actors: string[];
  topics: string[];
  arenas: string[];
};

function activeParts(filters: BriefFilterValues): string[] {
  return [filters.date, filters.actor, filters.topicLabel, filters.arena].filter(
    (value): value is string => Boolean(value),
  );
}

function FilterFields({
  idPrefix,
  filters,
  actors,
  topics,
  arenas,
  fieldClassName,
}: {
  idPrefix: string;
  filters: BriefFilterValues;
  actors: string[];
  topics: string[];
  arenas: string[];
  fieldClassName?: string;
}) {
  return (
    <>
      <Field
        id={`${idPrefix}-date`}
        className={fieldClassName}
        label="Date"
        type="date"
        name="date"
        defaultValue={filters.date}
      />
      <SelectField
        id={`${idPrefix}-actor`}
        className={fieldClassName}
        label="Actor"
        name="actor"
        defaultValue={filters.actor ?? ""}
      >
        <option value="">All actors</option>
        {actors.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </SelectField>
      <SelectField
        id={`${idPrefix}-topic`}
        className={fieldClassName}
        label="Topic"
        name="topicLabel"
        defaultValue={filters.topicLabel ?? ""}
      >
        <option value="">All topics</option>
        {topics.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </SelectField>
      <SelectField
        id={`${idPrefix}-arena`}
        className={fieldClassName}
        label="Arena"
        name="arena"
        defaultValue={filters.arena ?? ""}
      >
        <option value="">All arenas</option>
        {arenas.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </SelectField>
    </>
  );
}

/**
 * Desktop is a GET form; below ~44rem a Filters control opens the same
 * fields in a drawer. `@media (scripting: none)` shows the GET form at
 * every width and hides the trigger, so filtering works without JavaScript.
 */
export function BriefFilters({ filters, actors, topics, arenas }: BriefFiltersProps) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const parts = activeParts(filters);
  const hasFilters = parts.length > 0;
  const summary = parts.join(" · ");

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 45rem)");
    const onChange = () => {
      if (query.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div className={styles.filterCluster}>
      <form
        className={styles.filterBar}
        action={FILTER_ACTION}
        method="get"
        aria-label="Filter archive"
      >
        <FilterFields
          idPrefix="brief-bar"
          filters={filters}
          actors={actors}
          topics={topics}
          arenas={arenas}
          fieldClassName={styles.filterField}
        />
        <Button type="submit" variant="primary" size="md">
          Filter archive
        </Button>
        {hasFilters ? (
          <ButtonLink href={FILTER_ACTION} variant="ghost" size="md">
            Clear all
          </ButtonLink>
        ) : null}
      </form>

      <div className={styles.filterMobile}>
        <Button
          ref={triggerRef}
          type="button"
          variant="secondary"
          size="md"
          className={styles.filterTrigger}
          aria-expanded={open}
          aria-controls={dialogId}
          onClick={() => setOpen((isOpen) => !isOpen)}
        >
          <span className={styles.filterTriggerCopy}>
            <span className={styles.filterTriggerLabel}>Filters</span>
            {summary ? (
              <span className={styles.filterTriggerSummary}>{summary}</span>
            ) : (
              <span className={styles.filterTriggerSummary}>All records</span>
            )}
          </span>
        </Button>
        {hasFilters ? (
          <ButtonLink href={FILTER_ACTION} variant="ghost" size="md">
            Clear all
          </ButtonLink>
        ) : null}
      </div>

      <Dialog
        id={dialogId}
        open={open}
        onClose={close}
        title="Filters"
        description="Narrow the archive by date, actor, topic, or arena."
        variant="drawer"
      >
        <form
          className={styles.filterDrawerForm}
          action={FILTER_ACTION}
          method="get"
          aria-label="Filter archive"
        >
          <FilterFields
            idPrefix="brief-drawer"
            filters={filters}
            actors={actors}
            topics={topics}
            arenas={arenas}
          />
          <div className={styles.filterDrawerActions}>
            <Button type="submit" variant="primary" size="md">
              Filter archive
            </Button>
            {hasFilters ? (
              <ButtonLink href={FILTER_ACTION} variant="ghost" size="md">
                Clear all
              </ButtonLink>
            ) : null}
          </div>
        </form>
      </Dialog>
    </div>
  );
}
