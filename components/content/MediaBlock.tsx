import type { CSSProperties, ReactNode } from "react";
import styles from "./media-block.module.css";

export type MediaBlockProps = {
  children: ReactNode;
  caption?: ReactNode;
  credit?: ReactNode;
  provenance?: ReactNode;
  className?: string;
  /**
   * CSS `aspect-ratio` when the asset recorded width/height. The frame
   * otherwise uses `16 / 10` so it does not collapse before media arrives.
   */
  aspectRatio?: string;
  /**
   * `thumb` is a small square plate for list covers. Default `record` is
   * the editorial 16/10 frame. Thumbs must not pick up that strip.
   */
  layout?: "record" | "thumb";
};

/**
 * SYS-013 — shared media anatomy: frame, caption, credit, provenance.
 * Sensitive media still wraps this (or its children) in `SensitiveContent`.
 */
export function MediaBlock({
  children,
  caption,
  credit,
  provenance,
  className = "",
  aspectRatio,
  layout = "record",
}: MediaBlockProps) {
  const hasCaption = Boolean(caption || credit || provenance);
  const style = aspectRatio
    ? ({ "--media-aspect": aspectRatio } as CSSProperties)
    : undefined;
  return (
    <figure
      className={[styles.block, layout === "thumb" ? styles.thumb : "", className]
        .filter(Boolean)
        .join(" ")}
      data-layout={layout}
      style={style}
    >
      <div className={styles.frame}>{children}</div>
      {hasCaption ? (
        <figcaption className={styles.caption}>
          {caption ? <span className={styles.captionText}>{caption}</span> : null}
          {credit ? <span className={styles.credit}>{credit}</span> : null}
          {provenance ? <span className={styles.provenance}>{provenance}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
