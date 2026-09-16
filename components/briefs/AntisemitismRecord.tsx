import Link from "next/link";
import type { PublicPublication } from "@/server/contracts/publication";
import { RecordShare } from "@/components/motion/view-transition";
import { RECORD_TRANSITION_TYPE, recordViewNames } from "@/lib/record-view-names";
import { Icon } from "@/components/ui/Icon";
import styles from "./antisemitism-record.module.css";
import { publicationCta } from "@/lib/publication-routing";
import { measurePublicationCard } from "@/components/measurement/attrs";
import { formatDay } from "@/lib/format-date";

/** A documented record, kept visually and semantically distinct from a circulating claim. */
export function AntisemitismRecord({ item, compact = false, surface = compact ? "fr-antisemitism" : "antisemitism" }: {
  item: PublicPublication;
  compact?: boolean;
  /** Measurement surface: the hub's compact excerpt, or the full listing. */
  surface?: string;
}) {
  const date = formatDay(item.publishedAt);
  return (
    <article className={[styles.record, compact ? styles.compact : ""].join(" ")} {...measurePublicationCard(surface, item)}>
      <div className={styles.meta}>
        <span>Antisemitism record</span>
        <time dateTime={item.publishedAt}>{date}</time>
      </div>
      <h3>
        <RecordShare name={recordViewNames(item.publicId).headline}>
          <Link href={`/articles/${item.publicId}`} transitionTypes={[RECORD_TRANSITION_TYPE]}>{item.title}</Link>
        </RecordShare>
      </h3>
      {item.summary ? <p>{item.summary}</p> : null}
      <dl className={styles.context}>
        {item.arena ? <div><dt>Location or platform</dt><dd>{item.arena}</dd></div> : null}
        {item.editorialTopic ? <div><dt>Record type</dt><dd>{item.editorialTopic}</dd></div> : null}
      </dl>
      {!compact ? <Link className={styles.read} href={`/articles/${item.publicId}`} transitionTypes={[RECORD_TRANSITION_TYPE]}>{publicationCta(item.section)} <Icon name="arrow-right" size={14} /></Link> : null}
    </article>
  );
}
