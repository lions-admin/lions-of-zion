"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { XMediaPostButton } from "@/components/archive/XMediaPostButton";
import { ShareSheet } from "@/components/content/ShareSheet";
import { measureCard } from "@/components/measurement/attrs";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { politeLive } from "@/components/ui/live-region";
import styles from "./page.module.css";

export type ArchiveShareSample = {
  id: string;
  title: string;
  excerpt: string;
  witness: string | null;
  href: string;
  url: string;
  source: string;
  date: string | null;
  category: string | null;
  medium: "video" | "image" | "text";
  shareText: string;
  xHref: string;
  facebookHref: string;
  xMedia: {
    pkg: "october7" | "hamas-massacre";
    recordId: string;
    mediaId: string;
    locale: string;
    assetUrl: string;
    medium: "video" | "image";
  } | null;
};

/**
 * One featured record from an archive, and the one way to share it (UX-22).
 *
 * Until 2026-09-08 this rotated on a twelve-second clock and laid five share
 * controls under each card — ten solid and outlined buttons on the memorial
 * destination, and an auto-advancing carousel of testimonies, which is the
 * wrong motion for the subject. The clock is gone, not paused: the arrows are
 * the only way the selection changes, so a reader is never moved off an
 * account they are still reading. Sharing is one control that opens the
 * app-owned sheet with every target inside it — copy, the system sheet, X,
 * Facebook, and the original file where the archive holds one.
 */
export function ArchiveShareShowcase({
  kind, samples, count, detail, demoted = false,
}: {
  kind: "testimony" | "documentation";
  samples: ArchiveShareSample[];
  count: number;
  detail: string;
  /**
   * One featured record per page (2026-09-16). The testimony showcase is
   * this route's one peak; the documentation showcase renders under it a
   * step down — its heading at `h3`, no lit rule of its own — rather than
   * as a second equal spread. Two full spreads made a survivor's account
   * and a reel of graphic material peers of each other on the quietest
   * surface the site has.
   */
  demoted?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const slideId = useId();
  const isStory = kind === "testimony";
  const label = isStory ? "testimony" : "record";
  const sample = samples[index];
  const headingId = isStory ? "featured-survivor-story" : "featured-documented-record";
  const archiveHref = isStory ? "/october-7/testimonies" : "/october-7/documentation";

  function move(direction: number) {
    setIndex((current) => (current + direction + samples.length) % samples.length);
  }

  return (
    <section className={styles.archiveFeature} data-kind={kind} data-demoted={demoted ? "" : undefined} aria-labelledby={headingId}>
      <header className={styles.featureHeading}>
        <p className={styles.eyebrow}>{isStory ? "From the testimony archive" : "From the documentation archive"}</p>
        {demoted
          ? <h3 id={headingId}>Featured documented record</h3>
          : <h2 id={headingId}>{isStory ? "Featured survivor story" : "Featured documented record"}</h2>}
        <p>{isStory ? "One account, shown here before you browse the rest." : "One record, shown here before you browse the rest."}</p>
        {/* UX-05 / UX-23. The verb table's hub link. The count it used to
            carry is printed once, on the collection card above. */}
        <Link className={styles.browseLink} href={archiveHref} aria-label={`All ${count} ${isStory ? "survivor stories" : "documented records"}`}>
          All {isStory ? "survivor stories" : "documented records"} <Icon name="arrow-right" size={18} />
        </Link>
        <span className={styles.archiveDetail}>{detail}</span>
      </header>
      {sample ? (
        <>
          <div className={styles.rotationControls} role="group" aria-label={`Featured ${label} controls`}>
            <span>From the archive <span className={styles.sampleCount}>{index + 1} / {samples.length}</span></span>
            {samples.length > 1 && (
              <div>
                <button type="button" onClick={() => move(-1)} aria-label={`Previous ${label}`} aria-controls={slideId} data-measure-id={`o7-${kind}-previous`}>
                  <Icon name="arrow-right" size={17} className={styles.previousIcon} />
                </button>
                <button type="button" className={styles.nextButton} onClick={() => move(1)} aria-controls={slideId} data-measure-id={`o7-${kind}-next`}>
                  {isStory ? "More testimony" : "More records"} <Icon name="arrow-right" size={17} />
                </button>
              </div>
            )}
          </div>
          {/* Polite, because every change here is the reader's own: the
              region announces the account they just asked for, and nothing
              else ever changes it. */}
          {/* The sample, the share sheet inside it and its links are all
              counted against the record on show — `<kind>:<id>`, the
              homepage's own key shape. */}
          <div id={slideId} className={styles.sample}
            {...measureCard({ id: `o7-${kind}-${sample.id}`, section: "october-7", content: `${kind}:${sample.id}`, type: kind, placement: `october-7:${kind}` })}>
            <div className={styles.sampleReading} {...politeLive}>
              <div className={styles.sampleType}>
                <Icon name={isStory ? "actor" : sample.medium === "video" ? "film" : sample.medium === "image" ? "photo" : "document"} size={22} />
                <span>{isStory ? sample.witness ?? "First-person testimony" : sample.medium === "video" ? "Video record" : sample.medium === "image" ? "Photographic record" : "Archive record"}</span>
              </div>
              <h3><Link href={sample.href}>{sample.title}</Link></h3>
              {isStory && sample.excerpt && <p className={styles.sampleExcerpt}>{sample.excerpt}</p>}
              {!isStory && (
                <div className={styles.mediaWarning}>
                  <Icon name="warning" size={19} />
                  <p>Content warning: graphic material.<br />Media is hidden until you choose to view it.</p>
                </div>
              )}
              <p className={styles.sampleProvenance}>
                {sample.category && <span>{sample.category}</span>}
                <span>Source: {sample.source}{sample.date ? ` · Published ${sample.date}` : ""}</span>
              </p>
            </div>
            <Link className={styles.readLink} href={sample.href}>
              {isStory ? "Read the testimony" : "Open with a content warning"} <Icon name="arrow-right" size={18} />
            </Link>
            <div className={styles.shareSample}>
              {/* The one solid fill on this page. */}
              <Button
                type="button"
                variant="primary"
                size="md"
                leftIcon={<Icon name="share" size={16} />}
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen(true)}
                data-measure-id={`o7-${kind}-share-open`}
              >
                {isStory ? "Share this testimony" : "Share this record"}
              </Button>
              <ShareSheet
                key={sample.id}
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                title={isStory ? "Share this testimony" : "Share this record"}
                description={isStory
                  ? "The link carries the account, its source and its date. Footage stays covered until it is opened."
                  : "The link carries the record, its source and its date. Graphic media stays behind the warning."}
                url={sample.url}
                shareTitle={sample.title}
                text={sample.shareText}
                copyLabel={isStory ? "Copy the testimony to share" : "Copy the record to share"}
                actions={sample.xMedia ? (
                  <XMediaPostButton
                    {...sample.xMedia}
                    shareTitle={sample.title}
                    shareUrl={sample.url}
                    xHref={sample.xHref}
                    returnTo={sample.href}
                  />
                ) : undefined}
                targets={[
                  ...(sample.xMedia ? [] : [{ label: "Post on X", href: sample.xHref }]),
                  { label: "Facebook", href: sample.facebookHref },
                ]}
              />
            </div>
          </div>
        </>
      ) : (
        <p className={styles.emptySample}>No preview is available. <Link href={archiveHref}>Browse the archive</Link>.</p>
      )}
    </section>
  );
}
