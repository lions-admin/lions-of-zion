import Link from "next/link";
import type { PublicPublication } from "@/server/contracts/publication";
import { isAnalysisBasis } from "@/server/contracts/publication";
import { VERIFICATION_STATES } from "@/components/live/publication-labels";
import styles from "./narrative-record.module.css";

/** Status precedes the claim so a circulating allegation is never styled as news. */
export function NarrativeRecord({ item, compact = false }: { item: PublicPublication; compact?: boolean }) {
  const details = item.narrativeWatchDetails;
  const status = details ? VERIFICATION_STATES[details.verificationState] : null;
  const title = item.title.replace(/^(Reported claim|Analysis):\s*/, "");
  return (
    <article className={[styles.record, compact ? styles.compact : ""].join(" ")}>
      <div className={styles.meta}>
        <span className={styles.status} data-tone={status?.tone ?? "neutral"}>{status?.label ?? "Assessment unavailable"}</span>
        <time dateTime={item.publishedAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(item.publishedAt))}</time>
      </div>
      <p className={styles.label}>Claim in circulation</p>
      <h3><Link href={`/articles/${item.publicId}`}>{title}</Link></h3>
      {status ? <p className={styles.meaning}>{status.meaning}</p> : null}
      {!compact && details?.propagators.length ? <p className={styles.propagators}><span>Named in the record</span> {details.propagators.join(" · ")}</p> : null}
      {!compact && item.summary ? <div className={styles.context}><span className={styles.label}>Published context</span><p>{item.summary}</p></div> : null}
      {details && isAnalysisBasis(details) ? <p className={styles.basis}>Organisation analysis — no source cited.</p> : null}
      {!compact ? <Link className={styles.read} href={`/articles/${item.publicId}`}>{details && isAnalysisBasis(details) ? "Read the analysis" : "Read the assessment"} <span aria-hidden="true">→</span></Link> : null}
    </article>
  );
}
