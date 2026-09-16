import styles from "./signal-mark.module.css";

/**
 * The signal rule — the identity's one signature (2026-09-15).
 *
 * A 1px line in `currentColor` whose head is a short spectrum stub: five
 * 1.5px bars on a 4px pitch at fixed heights 3 / 7 / 11 / 5 / 9 — the last of
 * the cover lion's dispersing particles held as a line, the "mane into bars"
 * idea of the site's own first mark. "Truth has a signal" made literal, once.
 *
 * Rationed, by design, to three places: the head of the cover rule where it
 * is born, the head of a page's masthead rule (once per page, in place of the
 * kicker dash), and the head of the colophon's closing rule. Everywhere else
 * a rule is a plain hairline doing structural work. On October 7 the rule is
 * unbroken and unlit: `main[data-memorial]` re-points `--signal-rule-color`
 * to `--ink-lo` and this component is not rendered there.
 *
 * A server component with no client JavaScript. The stub is inline SVG so it
 * takes the text colour; the line is a flex child so its length is whatever
 * the composing rule gives the mark (`--signal-rule-w` by default).
 * `aria-hidden`: it is decoration beside a label, never the label.
 */
export function SignalMark({ className, rule = true }: { className?: string; rule?: boolean }) {
  return (
    <span className={[styles.mark, className].filter(Boolean).join(" ")} aria-hidden="true">
      <svg className={styles.stub} viewBox="0 0 18 11" width="18" height="11" focusable="false">
        <rect x="0" y="8" width="1.5" height="3" />
        <rect x="4" y="4" width="1.5" height="7" />
        <rect x="8" y="0" width="1.5" height="11" />
        <rect x="12" y="6" width="1.5" height="5" />
        <rect x="16" y="2" width="1.5" height="9" />
      </svg>
      {rule ? <span className={styles.rule} /> : null}
    </span>
  );
}
