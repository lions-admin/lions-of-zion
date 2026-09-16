import { Badge, type BadgeStatus } from "@/components/ui/Badge";
import styles from "./explainer.module.css";

export type ExplainerEntry = {
  /** The shared status key the grade renders through — its mark and ramp. */
  status: BadgeStatus;
  /** The visible name of the grade, as the ledger prints it. */
  label: string;
  /** The one sentence that says what the grade claims and what it does not. */
  text: string;
};

export type ExplainerProps = {
  /**
   * The key the reader is being handed — "How to read the grades", "What the
   * evidence classes mean". It sits in the summary, so a closed disclosure
   * still names what it opens.
   */
  heading: string;
  entries: ExplainerEntry[];
  className?: string;
};

/**
 * The visible key behind a set of grades (2026-09-16).
 *
 * Grade explanations used to live on `title` tooltips — knowledge a reader
 * had to already know where to look for, invisible on touch and keyboard.
 * Recognition over recall says the meaning travels with the mark: every
 * ledger that stamps grades carries this key beside them, each entry showing
 * the same `Badge` the ledger itself renders, so the mark, the label and the
 * sentence are learned together in one place.
 *
 * A `<details>` because the key is reference matter, not prose: it is one
 * gesture away, it never pushes the evidence down the page uninvited, and it
 * works with no script. The entries stay in the document when collapsed.
 */
export function Explainer({ heading, entries, className }: ExplainerProps) {
  if (!entries.length) return null;
  return (
    <details className={[styles.key, className].filter(Boolean).join(" ")}>
      <summary className={styles.summary}>{heading}</summary>
      <dl className={styles.entries}>
        {entries.map((entry) => (
          <div key={entry.status} className={styles.entry}>
            <dt className={styles.term}>
              <Badge status={entry.status}>{entry.label}</Badge>
            </dt>
            <dd className={styles.definition}>{entry.text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** The confidence grades the evidence ledger stamps, in ledger order. */
export const CONFIDENCE_KEY: ExplainerEntry[] = [
  {
    status: "high",
    label: "High confidence",
    text: "Multiple independent methods or sources agree.",
  },
  {
    status: "medium",
    label: "Medium confidence",
    text: "Supported, with material gaps acknowledged.",
  },
  {
    status: "limited",
    label: "Limited confidence",
    text: "A single line of evidence, or an unresolved alternative explanation.",
  },
  {
    status: "low",
    label: "Low confidence",
    text: "One source, and the research flags it as weak on its own.",
  },
];

/** The evidence classes a relationship is drawn from, in strength order. */
export const EVIDENCE_CLASS_KEY: ExplainerEntry[] = [
  {
    status: "documented",
    label: "Documented",
    text: "Stated on the record, by the parties or by reporting.",
  },
  {
    status: "observed",
    label: "Observed",
    text: "Seen happening in public posts — behaviour, not a declared tie.",
  },
  {
    status: "inferred",
    label: "Inferred",
    text: "A pattern consistent with coordination that was not established.",
  },
];
