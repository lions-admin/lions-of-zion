"use client";

/**
 * The chrome Ask and Search share, because they are one instrument.
 *
 * A reader meets these two next to each other in the masthead and uses them
 * for the same thing — putting a question to this desk — so a suggestion chip
 * must be the same chip in both, and a keyboard legend the same legend. Until
 * 2026-09-16 they were not: the search panel built chips out of `Button` in a
 * labelled `<ul>`, the desk built them out of a vendored registry's horizontal
 * pill rail, and each had its own `<kbd>` row with its own idea of what a key
 * looks like. Two surfaces, three grammars.
 *
 * It lives beside `http.ts` for the reason that module already records: these
 * two directories are one surface, and this workstream owns no neutral
 * directory to put a shared helper in. `components/ui` is the site-wide
 * primitive layer, and a chip that exists for exactly two screens does not
 * belong there.
 */

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./search.module.css";

export interface SuggestionChipsProps {
  /** The line above the chips. One label, sentence case, never stacked. */
  label: string;
  queries: readonly string[];
  onPick: (query: string) => void;
  disabled?: boolean;
  /** Extra class for the list, where a surface needs a different flow. */
  className?: string;
}

/**
 * A row of queries to take. They are chips rather than links because nothing
 * is navigated: each one fills the box the reader is already in.
 *
 * `ghost` with the control boundary drawn (A11Y-004 — the ghost's own line is
 * transparent), wrapping rather than scrolling sideways, and `white-space:
 * normal` so a whole-sentence suggestion stacks instead of running off a
 * 390px drawer.
 */
export function SuggestionChips({
  label,
  queries,
  onPick,
  disabled = false,
  className,
}: SuggestionChipsProps) {
  const labelId = useId();
  if (!queries.length) return null;

  return (
    <div className={styles.suggestions}>
      <p className={styles.suggestionsLabel} id={labelId}>
        {label}
      </p>
      <ul className={[styles.chips, className].filter(Boolean).join(" ")} aria-labelledby={labelId}>
        {queries.map((query) => (
          <li key={query}>
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

export interface KeyLegendProps {
  /** Pairs of [key glyphs, what the key does]. */
  items: ReadonlyArray<readonly [readonly string[], string]>;
  className?: string;
}

/**
 * The keyboard grammar of a surface, in one shape.
 *
 * `aria-hidden`: it describes bindings a screen-reader user reaches through
 * the combobox pattern itself, and read aloud it is a string of arrow
 * characters. A phone has neither arrow keys nor Escape, so the stylesheet
 * hides it outright in the narrow branch — the legend is never the only place
 * a control is stated.
 */
export function KeyLegend({ items, className }: KeyLegendProps) {
  return (
    <p className={[styles.foot, className].filter(Boolean).join(" ")}>
      <span className={styles.footKeys} aria-hidden="true">
        {items.map(([keys, action]) => (
          <span className={styles.footItem} key={action}>
            {keys.map((key) => (
              <kbd key={key}>{key}</kbd>
            ))}
            <span>{action}</span>
          </span>
        ))}
      </span>
    </p>
  );
}
