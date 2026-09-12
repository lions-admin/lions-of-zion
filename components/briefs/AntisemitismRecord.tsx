import Link from "next/link";
import type { PublicPublication } from "@/server/contracts/publication";
import styles from "./antisemitism-record.module.css";
import { publicationCta } from "@/lib/publication-routing";
import { formatDay } from "@/lib/format-date";

/** A documented record, kept visually and semantically distinct from a circulating claim. */
export function AntisemitismRecord({ item, compact = false }: { item: PublicPublication; compact?: boolean }) {
  const date = formatDay(item.publishedAt);
  return (
    <article className={[styles.record, compact ? styles.compact : ""].join(" ")}>
      <div className={styles.meta}>
        <span>Antisemitism record</span>
        <time dateTime={item.publishedAt}>{date}</time>
      </div>
      <h3><Link href={`/articles/${item.publicId}`}>{item.title}</Link></h3>
      {item.summary ? <p>{item.summary}</p> : null}
      <dl className={styles.context}>
        {item.arena ? <div><dt>Location or platform</dt><dd>{item.arena}</dd></div> : null}
        {item.editorialTopic ? <div><dt>Record type</dt><dd>{item.editorialTopic}</dd></div> : null}
      </dl>
      {!compact ? <Link className={styles.read} href={`/articles/${item.publicId}`}>{publicationCta(item.section)} <span aria-hidden="true">→</span></Link> : null}
    </article>
  );
}
