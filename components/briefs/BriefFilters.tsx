"use client";

import Form from "next/form";
import { useFormStatus } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { SelectField } from "@/components/ui/SelectField";
import styles from "./live-brief.module.css";

const FILTER_ACTION = "/geopolitical-brief#news-archive";

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
 * The submit, with the wait shown on it (Doherty, 2026-09-16). `next/form`
 * turns the GET submission into a client-side navigation inside a
 * transition, so `useFormStatus` reports the archive read as pending from
 * the click until the filtered rows have replaced the old ones; the button
 * keeps its width while busy (`Button` lays the spinner over the label) and
 * the result count under the form is a live region, so the answer is
 * announced when it lands. With scripting off the same form is a plain GET.
 */
function FilterSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="md" isLoading={pending} leftIcon={<Icon name="filter" size={16} />}>
      {pending ? "Filtering the archive" : "Filter archive"}
    </Button>
  );
}

/**
 * Desktop is a GET form; below the phone seam a Filters control opens the
 * same fields in a drawer. `@media (scripting: none)` shows the GET form at
 * every width and hides the trigger, so filtering works without JavaScript.
 *
 * This component also opens the archive it lives in when the page arrives
 * on, or moves to, `#news-archive` (the masthead's jump and the "Clear
 * filters" action both point there): a `<details>` reached by fragment used
 * to stay shut, so the jump scrolled the reader to a closed summary.
 */
export function BriefFilters({ filters, actors, topics, arenas }: BriefFiltersProps) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const disclosure = rootRef.current?.closest("details");
    if (!disclosure?.id) return;
    const openOnFragment = () => {
      if (window.location.hash === `#${disclosure.id}`) disclosure.open = true;
    };
    openOnFragment();
    window.addEventListener("hashchange", openOnFragment);
    return () => window.removeEventListener("hashchange", openOnFragment);
  }, []);

  return (
    <div className={styles.filterCluster} ref={rootRef}>
      <Form
        className={styles.filterBar}
        action={FILTER_ACTION}
        scroll={false}
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
        <FilterSubmit />
        {hasFilters ? (
          <ButtonLink href={FILTER_ACTION} variant="ghost" size="md">
            Clear all
          </ButtonLink>
        ) : null}
      </Form>

      <div className={styles.filterMobile}>
        <Button
          ref={triggerRef}
          type="button"
          variant="ghost"
          size="md"
          className={styles.filterTrigger}
          aria-expanded={open}
          aria-controls={dialogId}
          onClick={() => setOpen((isOpen) => !isOpen)}
          leftIcon={<Icon name="filter" size={16} />}
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
        <Form
          className={styles.filterDrawerForm}
          action={FILTER_ACTION}
          scroll={false}
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
            <FilterSubmit />
            {hasFilters ? (
              <ButtonLink href={FILTER_ACTION} variant="ghost" size="md">
                Clear all
              </ButtonLink>
            ) : null}
          </div>
        </Form>
      </Dialog>
    </div>
  );
}
