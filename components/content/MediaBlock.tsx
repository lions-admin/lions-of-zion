import type { CSSProperties, ReactNode } from "react";
import type { EditorialMediaRole } from "@/server/contracts/editorial-media";
import styles from "./media-block.module.css";

/**
 * What a manufactured image is not, when its record does not say it itself.
 *
 * An archival photograph or a portrait describes itself in its caption and
 * carries a disclosure only when one is needed for that picture. An
 * illustration or a safe cover must always say what it is not, before
 * anything else about it is read — so those two, and only those two, get a
 * default here rather than being allowed to render bare.
 */
export const ROLE_DISCLOSURE: Partial<Record<EditorialMediaRole, string>> = {
  "editorial-illustration": "Editorial illustration — not evidence",
  "safe-cover": "Safe cover — not the original material",
};

/**
 * Whether this picture was made rather than taken.
 *
 * `documentation`, `portrait` and `archival-context` are records of something
 * that happened in front of a lens; `editorial-illustration` and `safe-cover`
 * are produced by us to stand in for one. Only the second pair can form a
 * reader's first impression of a contested claim out of nothing, so only the
 * second pair is moved below the claim's status and headline (VA-13).
 *
 * Written as a positive test on the two manufactured roles on purpose: a
 * sixth role added to the contract falls to "documentary" and keeps its
 * position, which is the reading that never silently demotes a photograph.
 */
export function isManufacturedMedia(role: EditorialMediaRole): boolean {
  return role === "editorial-illustration" || role === "safe-cover";
}

/**
 * The one line a picture must say about itself, from the record if it has
 * one and from its role otherwise. `undefined` only for a documentary role
 * whose record chose to say nothing, which is the contract's intent.
 */
export function mediaDisclosure(media: {
  role: EditorialMediaRole;
  disclosure?: string;
}): string | undefined {
  return media.disclosure ?? ROLE_DISCLOSURE[media.role];
}

export type MediaBlockProps = {
  children: ReactNode;
  caption?: ReactNode;
  credit?: ReactNode;
  provenance?: ReactNode;
  /**
   * What this image is *not*, in one line — "Editorial illustration — not
   * evidence". Rendered first in the caption and **never** inside the
   * `provenanceLabel` disclosure. An editorial illustration presented as
   * documentation is the failure this whole system exists to prevent, so the
   * line that prevents it is not something a reader has to press for.
   */
  disclosure?: ReactNode;
  /**
   * When set, `credit` and `provenance` move into a native `<details>` under
   * this label, one press away, and the caption keeps only the disclosure and
   * the description. Absent — the archive's usage — they stay inline exactly
   * as before.
   */
  provenanceLabel?: string;
  className?: string;
  /**
   * CSS `aspect-ratio` when the asset recorded width/height. The frame
   * otherwise uses `16 / 10` so it does not collapse before media arrives.
   */
  aspectRatio?: string;
  /**
   * `thumb` is a small square plate for list covers. Default `record` is
   * the editorial 16/10 frame. Thumbs must not pick up that strip.
   * `reading` is the article hero: the reading measure, no plate border.
   */
  layout?: "record" | "thumb" | "reading";
};

/**
 * SYS-013 — shared media anatomy: frame, caption, credit, provenance.
 * Sensitive media still wraps this (or its children) in `SensitiveContent`.
 *
 * VA-13 — the caption is ordered, not just present: the disclosure line, then
 * the description, then the provenance a reader can expand. Nothing that
 * states what the picture is not may sit behind a control.
 */
export function MediaBlock({
  children,
  caption,
  credit,
  provenance,
  disclosure,
  provenanceLabel,
  className = "",
  aspectRatio,
  layout = "record",
}: MediaBlockProps) {
  const hasCaption = Boolean(caption || credit || provenance || disclosure);
  /* Something readable always stays outside the control. A picture whose
     record states no disclosure and no caption has only its credit to show,
     and a caption collapsed down to the words "Image credit and provenance"
     is a photograph with its attribution taken away — so that one keeps its
     credit inline and the disclosure requirement is met by there being
     nothing to disclose. */
  const expandsProvenance =
    Boolean(provenanceLabel) && Boolean(credit || provenance) && Boolean(disclosure || caption);
  const style = aspectRatio
    ? ({ "--media-aspect": aspectRatio } as CSSProperties)
    : undefined;
  const creditRow = (
    <>
      {credit ? <span className={styles.credit}>{credit}</span> : null}
      {provenance ? <span className={styles.provenance}>{provenance}</span> : null}
    </>
  );
  return (
    <figure
      className={[
        styles.block,
        layout === "thumb" ? styles.thumb : "",
        layout === "reading" ? styles.reading : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-layout={layout}
      style={style}
    >
      <div className={styles.frame}>{children}</div>
      {hasCaption ? (
        <figcaption className={styles.caption}>
          {disclosure ? <span className={styles.disclosure}>{disclosure}</span> : null}
          {caption ? <span className={styles.captionText}>{caption}</span> : null}
          {expandsProvenance ? (
            <details className={styles.provenanceDetails}>
              <summary>{provenanceLabel}</summary>
              <div className={styles.provenanceBody}>{creditRow}</div>
            </details>
          ) : (
            creditRow
          )}
        </figcaption>
      ) : null}
    </figure>
  );
}
