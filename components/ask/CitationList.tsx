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
 *
 * The ordinals are the shared ordinal gutter this desk and the search results
 * both use — two-digit, tabular, in the data face, with the hairline that
 * separates the number from what it numbers. A citation number is a machine
 * value; it never takes the text face.
 *
 * ## The one thing derived from the href, and why it is not a claim
 *
 * Stage 7 gives a record's headline the same `view-transition-name` on every
 * surface that links to it, so the thing a reader pressed is the thing that
 * opens. A citation carries no `publicId` — but an article's address *is* its
 * public id, and `/articles/<id>` is the only route in the system where that
 * holds. `recordName()` reads it from there and from nowhere else. It is not
 * the "publisher invented from a path" this file refuses above: a transition
 * identity that fails to match costs a morph, not a fact, and the page it
 * would have matched is the page the link goes to.
 */

import Link from "next/link";
import { ViewTransition } from "@/components/motion";
import type { Citation } from "@/server/contracts/chat";
import styles from "./ask.module.css";

/** `/articles/<publicId>` → the publicId. Every other shape → null. */
function recordName(href: string | null): string | null {
  const match = href ? /^\/articles\/([A-Za-z0-9_-]+)\/?$/.exec(href) : null;
  return match ? `record-${match[1]}-headline` : null;
}

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
        {citations.map((citation, index) => {
          const name = recordName(citation.href);
          const title = citation.title ?? "Untitled record";
          const link = citation.href ? (
            <Link className={styles.sourceLink} href={citation.href}>
              {title}
            </Link>
          ) : (
            <p className={styles.sourceTitle}>{title}</p>
          );

          return (
            <li className={styles.source} key={citation.documentId}>
              <span className={styles.sourceOrdinal} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className={styles.sourceBody}>
                {name ? (
                  <ViewTransition name={name} share="morph" default="none">
                    {link}
                  </ViewTransition>
                ) : (
                  link
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
          );
        })}
      </ol>
    </section>
  );
}
