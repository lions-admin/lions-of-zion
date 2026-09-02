"use client";

/**
 * The sources under an answer — the reason this surface exists.
 *
 * This is a verification desk, so the citations are given more structure and
 * more weight than the prose above them: numbered, ruled, each carrying the
 * span the answer claims to rest on. The database has already refused any
 * citation naming a document that retrieval did not return, so what appears
 * here is checked before it is rendered — but a reader cannot see a guarantee,
 * only a link, which is why the link matters.
 *
 * Three states, all stated rather than implied:
 *
 *   * **cited and reachable** — a link to the document.
 *   * **cited and unreachable** — the document is in the index and has no
 *     public page (`href: null`; see `searchHitSchema`). It is still listed,
 *     because concealing what an answer rested on to keep the list tidy is the
 *     opposite of the point.
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
                  <span className={styles.sourceArrow} aria-hidden="true">↗</span>
                </Link>
              ) : (
                <p className={styles.sourceTitle}>
                  {citation.title ?? "A record that has since left the index"}
                  <span className={styles.sourceUnreachable}>
                    {citation.title ? "Indexed · no public page" : "No longer indexed"}
                  </span>
                </p>
              )}
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
