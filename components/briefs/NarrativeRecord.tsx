import Image from "next/image";
import Link from "next/link";
import type { EditorialMedia } from "@/server/contracts/editorial-media";
import { isArticleSafeMedia } from "@/server/contracts/editorial-media";
import type { PublicPublication } from "@/server/contracts/publication";
import { isAnalysisBasis } from "@/server/contracts/publication";
import { VERIFICATION_STATES } from "@/components/live/publication-labels";
import styles from "./narrative-record.module.css";

/**
 * What the picture is, said before it is read as anything else.
 *
 * A record on this desk is a verdict about a claim, and a photograph beside a
 * claim is the oldest way of making the claim look documented. So the caption
 * always leads with what the image is *not*, and the default says it plainly
 * for an asset whose registry entry did not.
 */
const IMAGE_NOTE: Partial<Record<EditorialMedia["role"], string>> = {
  "editorial-illustration": "Editorial illustration — not evidence",
  "safe-cover": "Safe cover — not the original material",
};
const DEFAULT_IMAGE_NOTE = "Context image — not evidence for the claim";

/** Status precedes the claim so a circulating allegation is never styled as news. */
export function NarrativeRecord({ item, compact = false }: { item: PublicPublication; compact?: boolean }) {
  const details = item.narrativeWatchDetails;
  const status = details ? VERIFICATION_STATES[details.verificationState] : null;
  const title = item.title.replace(/^(Reported claim|Analysis):\s*/, "");
  /* Checked rather than assumed: the projection filters on clearance, but a
     record that trusts its input is where an uncleared image surfaces first. */
  const media = item.media && isArticleSafeMedia(item.media) ? item.media : null;
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
      {/* Below the status, the claim and the finding, and never above them:
          the picture illustrates the record, it does not establish it. */}
      {media ? (
        <figure className={styles.media}>
          <Image
            src={media.src}
            alt={media.alt}
            width={media.width}
            height={media.height}
            loading="lazy"
            sizes={compact ? "180px" : "(max-width: 44.99rem) 100vw, 30rem"}
            style={{ objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%` }}
          />
          {!compact ? (
            <figcaption>
              <span className={styles.mediaNote}>{media.disclosure ?? IMAGE_NOTE[media.role] ?? DEFAULT_IMAGE_NOTE}</span>
              <span className={styles.mediaCredit}>{media.credit}</span>
            </figcaption>
          ) : null}
        </figure>
      ) : null}
      {!compact && item.summary ? <div className={styles.context}><span className={styles.label}>Published context</span><p>{item.summary}</p></div> : null}
      {details && isAnalysisBasis(details) ? <p className={styles.basis}>Organisation analysis — no source cited.</p> : null}
      {!compact ? <Link className={styles.read} href={`/articles/${item.publicId}`}>{details && isAnalysisBasis(details) ? "Read the analysis" : "Read the assessment"} <span aria-hidden="true">→</span></Link> : null}
    </article>
  );
}
