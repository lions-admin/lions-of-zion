"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ShareControls } from "@/components/support/ShareControls";
import { Icon } from "@/components/ui/Icon";
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
};

function subscribeMotion(update: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
}
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverMotion = () => true;
const ROTATION_MS = 12000;

export function ArchiveShareShowcase({
  kind, samples, count, detail,
}: {
  kind: "testimony" | "documentation";
  samples: ArchiveShareSample[];
  count: number;
  detail: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, prefersReducedMotion, serverMotion);
  const root = useRef<HTMLElement>(null);
  const slideId = useId();
  const isStory = kind === "testimony";
  const label = isStory ? "story" : "record";
  const running = !paused && !reduced && visible && samples.length > 1;
  const sample = samples[index];
  const headingId = isStory ? "survivor-stories" : "documented-records";
  const archiveHref = isStory ? "/october-7/testimonies" : "/october-7/documentation";

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.25 });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % samples.length);
    }, ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [running, samples.length]);

  function move(direction: number) {
    setPaused(true);
    setIndex((current) => (current + direction + samples.length) % samples.length);
  }

  return (
    <section ref={root} className={styles.archiveFeature} data-kind={kind} aria-labelledby={headingId}>
      <header className={styles.featureHeading}>
        <p className={styles.eyebrow}>{isStory ? "First-person accounts" : "Films & photographs"}</p>
        <h2 id={headingId}>{isStory ? "Survivor stories" : "Documented records"}</h2>
        <p>{isStory ? "Read their words. Help their stories reach others." : "See what was recorded. Share the source, not a detached clip."}</p>
        <Link className={styles.browseLink} href={archiveHref}>
          Browse all {count} {isStory ? "stories" : "records"} <Icon name="arrow-right" size={18} />
        </Link>
        <span className={styles.archiveDetail}>{detail}</span>
      </header>
      {sample ? (
        <>
          <div className={styles.rotationControls} role="group" aria-label={`Featured ${label} controls`}>
            <span>From the archive <span className={styles.sampleCount}>{index + 1} / {samples.length}</span></span>
            {samples.length > 1 && (
              <div>
                <button type="button" onClick={() => move(-1)} aria-label={`Previous ${label}`} aria-controls={slideId}>
                  <Icon name="arrow-right" size={17} className={styles.previousIcon} />
                </button>
                <button type="button" className={styles.pauseButton} disabled={reduced}
                  onClick={() => setPaused((value) => !value)}
                  aria-label={reduced ? "Automatic rotation off: reduced motion" : paused ? `Resume automatic ${label} rotation` : `Pause automatic ${label} rotation`}>
                  {reduced ? "Manual" : paused ? "Resume" : "Pause"}
                </button>
                <button type="button" onClick={() => move(1)} aria-label={`Next ${label}`} aria-controls={slideId}>
                  <Icon name="arrow-right" size={17} />
                </button>
              </div>
            )}
          </div>
          <div id={slideId} className={styles.sample} onFocusCapture={() => setPaused(true)}
            onPointerEnter={() => setPaused(true)} onPointerDown={() => setPaused(true)}>
            <div className={styles.sampleReading} aria-live={running ? "off" : "polite"} aria-atomic="true">
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
              {isStory ? "Read the full story" : "Open record with a warning"} <Icon name="arrow-right" size={18} />
            </Link>
            <div className={styles.shareSample}>
              <p className={styles.shareLabel}>{isStory ? "Share this survivor’s story" : "Share this documented record"}</p>
              <ShareControls key={sample.id} url={sample.url} title={sample.title} text={sample.shareText}
                copyVariant="primary" copyLabel={isStory ? "Copy story to share" : "Copy record to share"}
                targets={[{ label: "Share on X", href: sample.xHref }, { label: "Facebook", href: sample.facebookHref }]} />
            </div>
          </div>
          <p className={styles.rotationNote}>
            {reduced ? "Use the arrows to explore more." : paused ? "Paused while you explore. Resume when you’re ready." : "A new selection every 12 seconds. Pause to take your time."}
          </p>
        </>
      ) : (
        <p className={styles.emptySample}>No preview is available. <Link href={archiveHref}>Browse the archive</Link>.</p>
      )}
    </section>
  );
}
