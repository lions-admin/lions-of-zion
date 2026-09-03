"use client";

/**
 * The sources under an answer — the reason this surface exists.
 *
 * A citation here is exactly `citationSchema`: `documentId`, `quote`, `title`,
 * `href`. There is no publisher and no status field. Inventing either from a
 * path would be a claim this desk cannot check, so the list shows what the
 * contract actually carries: the title, where it goes, and the span the
 * answer rests on. All three are in the document, not behind a hover.
 *
 * Three states, all stated rather than implied:
 *
 *   * **cited and reachable** — title, the href as destination, the quote.
 *   * **cited and unreachable** — the document is in the index and has no
 *     public page (`href: null`; see `searchHitSchema`). Destination reads
 *     "Indexed · no public page". Concealing what an answer rested on to
 *     keep the list tidy is the opposite of the point.
 *   * **nothing cited** — printed as loudly as a citation would be. The
 *     assistant holds ordinary conversations as well as evidence-backed ones,
 *     and "this answer rests on nothing in the index" is the single most
 *     useful sentence this component can print.
 */

import Link from "next/link";
import type { Citation } from "@/server/contracts/chat";
import styles from "./ask.module.css";

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations.length) {
    return (
      <p className={styles.noSources}>
        <span className={styles.noSourcesMark} aria-hidden="true" />
        No document in the index was cited for this answer. Treat it as
        conversation, not as a finding.
      </p>
    );
  }

  return (
    <section className={styles.sources} aria-label="Sources for this answer">
      <p className={styles.sourcesHead}>
        <span>{citations.length === 1 ? "Source" : "Sources"}</span>
        <span className={styles.sourcesCount}>{String(citations.length).padStart(2, "0")}</span>
      </p>
      <ol className={styles.sourceList}>
        {citations.map((citation, index) => (
          <li className={styles.source} key={citation.documentId}>
            <span className={styles.sourceOrdinal} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className={styles.sourceBody}>
              {citation.href ? (
                <Link className={styles.sourceLink} href={citation.href}>
                  {citation.title ?? "Untitled record"}
                </Link>
              ) : (
                <p className={styles.sourceTitle}>{citation.title ?? "Untitled record"}</p>
              )}
              <p className={styles.sourceDestination}>
                {citation.href ? (
                  citation.href
                ) : (
                  <span className={styles.sourceUnreachable}>Indexed · no public page</span>
                )}
              </p>
              {citation.quote ? (
                <blockquote className={styles.sourceQuote}>{citation.quote}</blockquote>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
