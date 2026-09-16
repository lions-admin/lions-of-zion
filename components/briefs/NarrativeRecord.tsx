import Image from "next/image";
import Link from "next/link";
import type { EditorialMedia } from "@/server/contracts/editorial-media";
import { isArticleSafeMedia } from "@/server/contracts/editorial-media";
import type { PublicPublication } from "@/server/contracts/publication";
import { isAnalysisBasis } from "@/server/contracts/publication";
import { VERIFICATION_STATES } from "@/components/live/publication-labels";
import { Icon } from "@/components/ui/Icon";
import { Badge, BADGE_GRAMMAR, type BadgeStatus } from "@/components/ui/Badge";
import styles from "./narrative-record.module.css";
import { publicationCta } from "@/lib/publication-routing";
import { measurePublicationCard } from "@/components/measurement/attrs";
import { formatDateTime } from "@/lib/format-date";
import { mediaSensitivityGate } from "@/components/content/SensitiveContent";
import { SensitiveContent } from "@/components/content/SensitiveContent";

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
export function NarrativeRecord({ item, compact = false, surface = compact ? "fr-watch" : "watch" }: {
  item: PublicPublication;
  compact?: boolean;
  /** Measurement surface: the hub's compact excerpt, or the full listing. */
  surface?: string;
}) {
  const details = item.narrativeWatchDetails;
  const status = details ? VERIFICATION_STATES[details.verificationState] : null;
  const title = item.title.replace(/^(Reported claim|Analysis):\s*/, "");
  /* Checked rather than assumed: the projection filters on clearance, but a
     record that trusts its input is where an uncleared image surfaces first. */
  const media = item.media && isArticleSafeMedia(item.media) ? item.media : null;
  const sensitivityGate = media ? mediaSensitivityGate(media) : null;
  return (
    <article className={[styles.record, compact ? styles.compact : ""].join(" ")} {...measurePublicationCard(surface, item)}>
      <div className={styles.meta}>
        <Badge status={badgeStatus(details?.verificationState)}>
          {status?.label ?? "Assessment unavailable"}
        </Badge>
        <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt)}</time>
      </div>
      <p className={styles.label}>Claim in circulation</p>
      <h3><Link href={`/articles/${item.publicId}`}>{title}</Link></h3>
      {status ? <p className={styles.meaning}>{status.meaning}</p> : null}
      {!compact && details?.propagators.length ? <p className={styles.propagators}><span>Named in the record</span> {details.propagators.join(" · ")}</p> : null}
      {/* Below the status, the claim and the finding, and never above them:
          the picture illustrates the record, it does not establish it. */}
      {media ? (
        <figure className={styles.media}>
          {sensitivityGate ? (
            <SensitiveContent layout="frame" category={sensitivityGate.category} warning={sensitivityGate.warning}>
              <Image
                src={media.src}
                alt={media.alt}
                width={media.width}
                height={media.height}
                loading="lazy"
                sizes={compact ? "180px" : "(max-width: 44.99rem) 100vw, 30rem"}
                style={{ objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%` }}
              />
            </SensitiveContent>
          ) : (
            <Image
              src={media.src}
              alt={media.alt}
              width={media.width}
              height={media.height}
              loading="lazy"
              sizes={compact ? "180px" : "(max-width: 44.99rem) 100vw, 30rem"}
              style={{ objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%` }}
            />
          )}
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
      {!compact ? <Link className={styles.read} href={`/articles/${item.publicId}`}>{publicationCta(item.section)} <Icon name="arrow-right" size={14} /></Link> : null}
    </article>
  );
}

/** A verdict the grammar has never heard of falls to the unassessed mark,
    never to a filled disc that would read as affirmed. */
function badgeStatus(value: string | undefined): BadgeStatus {
  return value && Object.hasOwn(BADGE_GRAMMAR, value) ? (value as BadgeStatus) : "unverified";
}
