import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./hub-masthead.module.css";

export type HubJumpLink = { href: string; label: string };

interface HubMastheadProps {
  /** Short data-face label above the title: "The present", "The claim and the record". */
  kicker?: string;
  title: ReactNode;
  /** One sentence under the title. */
  standfirst?: ReactNode;
  /** Right-hand facts: last published, record counts. Rendered as a definition list. */
  facts?: { label: string; value: ReactNode }[];
  /** In-page destinations along the masthead's foot. */
  jumps?: HubJumpLink[];
  className?: string;
}

/**
 * The masthead of a hub route — News & Analysis, Narratives & fact checks.
 *
 * Both hubs used to open with a 28px title on one line and a grey sentence on
 * the other, which is the register of a settings page. A hub is a front: it
 * carries the site's display face at display size, a kicker that says which
 * part of the record this is, the facts that describe the edition, and the
 * in-page destinations a reader would otherwise have to scroll to discover.
 *
 * Server component. The root carries `id="page-content"` so the shell's skip
 * link and the footer's "Back to the top" both land here.
 */
export function HubMasthead({ kicker, title, standfirst, facts, jumps, className }: HubMastheadProps) {
  return (
    <header
      className={[styles.masthead, className].filter(Boolean).join(" ")}
      id="page-content"
      tabIndex={-1}
    >
      <div className={styles.headline}>
        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {standfirst ? <p className={styles.standfirst}>{standfirst}</p> : null}
      </div>

      {facts?.length ? (
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {jumps?.length ? (
        <nav className={styles.jumps} aria-label="Jump to">
          {jumps.map((jump) => (
            <Link key={jump.href} href={jump.href} className={styles.jump}>
              {jump.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
