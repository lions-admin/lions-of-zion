import Image from "next/image";
import Link from "next/link";
import type { EditorialMedia } from "@/server/contracts/editorial-media";
import { isArticleSafeMedia } from "@/server/contracts/editorial-media";
import type { PublicPublication } from "@/server/contracts/publication";
import { isAnalysisBasis } from "@/server/contracts/publication";
import { VERIFICATION_STATES } from "@/components/live/publication-labels";
import { RecordShare } from "@/components/motion/view-transition";
import { RECORD_TRANSITION_TYPE, recordViewNames } from "@/lib/record-view-names";
import { Icon } from "@/components/ui/Icon";
import { Badge, BADGE_GRAMMAR, type BadgeStatus } from "@/components/ui/Badge";
import styles from "./narrative-record.module.css";
import { publicationCta } from "@/lib/publication-routing";
import { measurePublicationCard } from "@/components/measurement/attrs";
import { formatDateTime } from "@/lib/format-date";
import { mediaSensitivityGate } from "@/components/content/sensitivity-gate";
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
  const claim = details?.exactClaim ?? null;
  /* Checked rather than assumed: the projection filters on clearance, but a
     record that trusts its input is where an uncleared image surfaces first. */
  const media = item.media && isArticleSafeMedia(item.media) ? item.media : null;

  const badge = (
    <Badge status={badgeStatus(details?.verificationState)}>
      {status?.label ?? "Assessment unavailable"}
    </Badge>
  );
  const names = recordViewNames(item.publicId);
  const link = (
    <Link
      href={`/articles/${item.publicId}`}
      transitionTypes={[RECORD_TRANSITION_TYPE]}
    >
      {title}
    </Link>
  );
  const readLink = !compact ? (
    <Link className={styles.read} href={`/articles/${item.publicId}`} transitionTypes={[RECORD_TRANSITION_TYPE]}>
      {publicationCta(item.section)} <Icon name="arrow-right" size={14} />
    </Link>
  ) : null;

  /* The compact excerpt keeps its own shape — status row, label, headline. */
  if (compact) {
    return (
      <article className={[styles.record, styles.compact].join(" ")} {...measurePublicationCard(surface, item)}>
        <div className={styles.meta}>
          {badge}
          <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt)}</time>
        </div>
        <p className={styles.label}>Claim in circulation</p>
        <h3><RecordShare name={names.headline}>{link}</RecordShare></h3>
        {status ? <p className={styles.meaning}>{status.meaning}</p> : null}
        {media ? <CompactMedia media={media} viewName={names.plate} /> : null}
        {readLink}
      </article>
    );
  }

  return (
    <article className={styles.record} {...measurePublicationCard(surface, item)}>
      {/* The verdict-first lead (stage 7): the claim in circulation is quoted
          verbatim in the site's one quoted voice, and the verdict sits beside
          it — before the record's own headline, so a circulating allegation is
          never read as a finding (pinned by
          tests/fake-resistance-watch.test.ts). Source order puts the finding
          first; on wide screens the claim takes the left column and the
          finding the right, and the arrangement stacks below the canonical
          phone seam. The finding side is the record's own summary — the
          narrative projection carries no separate finding field. */}
      <div className={styles.meta}>
        {!claim ? badge : null}
        <time dateTime={item.publishedAt}>{formatDateTime(item.publishedAt)}</time>
      </div>
      {claim ? (
        <div className={styles.lead}>
          <div className={styles.finding}>
            <p className={styles.verdict}>{badge}</p>
            {status ? <p className={styles.meaning}>{status.meaning}</p> : null}
            {item.summary ? <p className={styles.findingText}>{item.summary}</p> : null}
          </div>
          <div className={styles.claim}>
            <p className={styles.label}>Claim in circulation</p>
            <p className={styles.quote}>&ldquo;{claim}&rdquo;</p>
          </div>
        </div>
      ) : (
        <p className={styles.label}>Claim in circulation</p>
      )}
      <h3><RecordShare name={names.headline}>{link}</RecordShare></h3>
      {!claim && status ? <p className={styles.meaning}>{status.meaning}</p> : null}
      {details?.propagators.length ? <p className={styles.propagators}><span>Named in the record</span> {details.propagators.join(" · ")}</p> : null}
      {/* Below the status, the claim and the finding, and never above them:
          the picture illustrates the record, it does not establish it. */}
      {media ? <RecordMedia media={media} viewName={names.plate} /> : null}
      {details && isAnalysisBasis(details) ? <p className={styles.basis}>Organisation analysis — no source cited.</p> : null}
      {readLink}
    </article>
  );
}

/**
 * The full record's picture, with its caption and its disclosure.
 */
function RecordMedia({ media, viewName }: { media: EditorialMedia; viewName: string }) {
  const gate = mediaSensitivityGate(media);
  const picture = (
    <Image
      src={media.src}
      alt={media.alt}
      width={media.width}
      height={media.height}
      loading="lazy"
      sizes="(max-width: 44.99rem) 100vw, 30rem"
      style={{ objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%` }}
    />
  );
  return (
    <RecordShare name={viewName}>
      <figure className={styles.media}>
        {gate ? (
          <SensitiveContent layout="frame" category={gate.category} warning={gate.warning}>
            {picture}
          </SensitiveContent>
        ) : (
          picture
        )}
        <figcaption>
          <span className={styles.mediaNote}>{media.disclosure ?? IMAGE_NOTE[media.role] ?? DEFAULT_IMAGE_NOTE}</span>
          <span className={styles.mediaCredit}>{media.credit}</span>
        </figcaption>
      </figure>
    </RecordShare>
  );
}

/** The compact excerpt's picture: the image alone, no caption row. */
function CompactMedia({ media, viewName }: { media: EditorialMedia; viewName: string }) {
  const gate = mediaSensitivityGate(media);
  const picture = (
    <Image
      src={media.src}
      alt={media.alt}
      width={media.width}
      height={media.height}
      loading="lazy"
      sizes="180px"
      style={{ objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%` }}
    />
  );
  return (
    <RecordShare name={viewName}>
      <figure className={styles.media}>
        {gate ? (
          <SensitiveContent layout="frame" category={gate.category} warning={gate.warning}>
            {picture}
          </SensitiveContent>
        ) : (
          picture
        )}
      </figure>
    </RecordShare>
  );
}

/** A verdict the grammar has never heard of falls to the unassessed mark,
    never to a filled disc that would read as affirmed. */
function badgeStatus(value: string | undefined): BadgeStatus {
  return value && Object.hasOwn(BADGE_GRAMMAR, value) ? (value as BadgeStatus) : "unverified";
}
