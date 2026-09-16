"use client";

import { useId } from "react";
import { Button } from "./Button";
import styles from "./chip.module.css";

/**
 * The one suggestion-chip primitive (Midnight Signal, workstream F).
 *
 * A labelled list of queries a reader can take into a box: the search
 * primer's recent and starter queries, and the ask desk's suggested
 * questions, were three near-identical copies of this control. One now owns
 * it. The chips are plain buttons — the search overlay's combobox pattern
 * does not extend to suggestions, which are complete queries, not result
 * rows.
 *
 * `label` is the visible kicker above the list and also its accessible name;
 * pass `listLabel` instead when the list should be named without a visible
 * label (the ask page's chips sit directly under the composer, which is the
 * only introduction they need). `action` is the one quiet control beside the
 * label — the search recents' Clear.
 */
export interface SuggestionChipsProps {
  /** Visible kicker above the list, and the list's accessible name. */
  label?: string;
  /** Accessible name for the list when no visible label is wanted. */
  listLabel?: string;
  /** The id for the visible label, when the caller needs to control it. */
  labelId?: string;
  queries: readonly string[];
  onPick: (query: string) => void;
  disabled?: boolean;
  /** The one quiet control beside the label, when there is one. */
  action?: { label: string; onClick: () => void };
}

export function SuggestionChips({
  label,
  listLabel,
  labelId: labelIdProp,
  queries,
  onPick,
  disabled = false,
  action,
}: SuggestionChipsProps) {
  /* A visible label is the list's name; without one, `listLabel` is. */
  const generatedId = useId();
  const labelId = label && !labelIdProp ? generatedId : labelIdProp;
  return (
    <div className={styles.group}>
      {label || action ? (
        <div className={styles.head}>
          {label ? (
            <p className={styles.label} id={labelId}>
              {label}
            </p>
          ) : null}
          {action ? (
            <Button type="button" variant="ghost" size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          ) : null}
        </div>
      ) : null}
      <ul
        className={styles.list}
        aria-label={label ? undefined : listLabel}
        aria-labelledby={label ? labelId : undefined}
      >
        {queries.map((query) => (
          <li key={query} className={styles.item}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={disabled}
              onClick={() => onPick(query)}
            >
              {query}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
