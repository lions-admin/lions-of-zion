import React from "react";
import { Badge, BADGE_GRAMMAR, type BadgeDomain, type BadgeStatus } from "./Badge";
import styles from "./explainer.module.css";

/**
 * The visible key to a ledger's grades (2026-09-16).
 *
 * Every grade on the site — a verdict, a confidence, an evidence class, an
 * identity status — renders through `Badge`, and until now its *meaning*
 * lived in a `title` attribute: a tooltip that a pointer sees after a
 * second's hover and that a touch screen, a keyboard and a screen reader
 * never see at all. Recognition over recall: a reader should not have to
 * remember what "Probable" meant on the previous page, so the key is printed
 * once per ledger, beside the ledger, behind a single native disclosure.
 *
 * Keyed by the grammar: each entry names a `BadgeStatus`, so the mark and
 * the ramp in the key are the ones the ledger itself draws, and a status the
 * grammar does not know cannot appear here. The explanation is the caller's —
 * the same sentence `VerificationBadge`, `EvidenceGrade` and `RosterTable`
 * already own — so the two never drift.
 *
 * A `<details>`, not state: it works with scripting off, the summary is a
 * real control at the coarse target floor, and it carries no ARIA of its own.
 */
export type ExplainerItem = {
  status: BadgeStatus;
  /** The word the ledger prints. Defaults to the grammar's label. */
  label?: string;
  /** One sentence: what the grade means on this ledger. */
  explanation: string;
};

export type ExplainerProps = {
  /** The control's label — "What the grades mean". */
  summary?: string;
  items: readonly ExplainerItem[];
  domain?: BadgeDomain;
  className?: string;
  /** Start open — for a ledger short enough that the key is not a cost. */
  open?: boolean;
};

export function Explainer({
  summary = "What the grades mean",
  items,
  domain,
  className,
  open,
}: ExplainerProps) {
  if (items.length === 0) return null;
  return (
    <details
      className={[styles.explainer, className].filter(Boolean).join(" ")}
      open={open || undefined}
      data-explainer=""
    >
      <summary className={styles.summary}>{summary}</summary>
      <dl className={styles.key}>
        {items.map((item) => (
          <div className={styles.row} key={item.status}>
            <dt className={styles.term}>
              <Badge status={item.status} domain={domain}>
                {item.label ?? BADGE_GRAMMAR[item.status].label}
              </Badge>
            </dt>
            <dd className={styles.detail}>{item.explanation}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
