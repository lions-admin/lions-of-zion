import Link from "next/link";
import type { PublicPublication } from "@/server/contracts/publication";
import styles from "./antisemitism-record.module.css";
import { publicationCta } from "@/lib/publication-routing";
import { measurePublicationCard } from "@/components/measurement/attrs";
import { formatDay } from "@/lib/format-date";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { SectionKicker } from "@/components/ui/Section";

/**
 * A documented record, kept visually and semantically distinct from a
 * circulating claim. Its stamp renders through the one badge grammar as
 * `documented` — the affirming square in the ok ramp — and never in the
 * ember that marks a contested claim: documented antisemitism is not drawn
 * in the "fake claim" ramp (clarity; 2026-09-16). Until then the label sat
 * in `--data-ember-peak`, the same hue as "Refuted" one row up.
 */
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
        <Badge status="documented" domain="evidence">Antisemitism record</Badge>
        <time dateTime={item.publishedAt}>{date}</time>
      </div>
      <h3><Link href={`/articles/${item.publicId}`}>{item.title}</Link></h3>
      {item.summary ? <p>{item.summary}</p> : null}
      <dl className={styles.context}>
        {item.arena ? <div><SectionKicker as="dt">Location or platform</SectionKicker><dd>{item.arena}</dd></div> : null}
        {item.editorialTopic ? <div><SectionKicker as="dt">Record type</SectionKicker><dd>{item.editorialTopic}</dd></div> : null}
      </dl>
      {!compact ? <Link className={styles.read} href={`/articles/${item.publicId}`}>{publicationCta(item.section)} <Icon name="arrow-right" inline className="arrow" /></Link> : null}
    </article>
  );
}
