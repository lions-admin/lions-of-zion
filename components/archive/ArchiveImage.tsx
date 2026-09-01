'use client';

/**
 * An archived image, and what stands in its place when it does not arrive.
 *
 * Everything else in `ArchiveBlocks` is a server component; this is the one
 * piece that cannot be. A missing asset is a 404 on a request the browser
 * makes, and CSS has no selector for that — an image that fails to load is
 * styleable but not *detectable*, so it renders as a bordered translucent
 * rectangle with nothing in it. On an evidentiary surface a blank frame is
 * worse than a stated gap: the reader cannot tell whether the record is
 * incomplete, the site is broken, or something was removed. `onError` is the
 * only way to know, and `onError` needs a client.
 *
 * Deliberately *not* gated on whether a CDN base is configured. The documented
 * development path is the `/archive` default with a gitignored symlink
 * (`lib/content/archive.ts`, `.vercelignore`), so a build-time check would
 * replace every image with a "not held" note on exactly the machine where the
 * assets do resolve. Provisioning stays the job of the gate that already owns
 * it, `scripts/verify-archive-assets.mjs`.
 *
 * The fallback borrows `.externalMedia`, the treatment the two YouTube videos
 * already use, so the archive says "this is a gap in the holding" in one voice
 * rather than two.
 */
import { useState } from 'react';
import styles from './archive.module.css';

export type ArchiveImageProps = {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  alt: string;
  /**
   * How the image is described when it fails — never the alt text, which may
   * be empty. Kept separate so the note reads as a sentence about the archive
   * rather than as a caption about a picture nobody can see.
   */
  unavailableNote: string;
};

export function ArchiveImage({
  src,
  srcSet,
  sizes,
  width,
  height,
  alt,
  unavailableNote,
}: ArchiveImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    // The frame keeps the image's shape where the package recorded one, so
    // the record does not reflow around the gap and the note sits where the
    // picture was. `--frame-ratio` is read by `.imageUnavailable`.
    const frame =
      width && height
        ? ({ '--frame-ratio': `${width} / ${height}` } as React.CSSProperties)
        : undefined;
    return (
      <p className={`${styles.externalMedia} ${styles.imageUnavailable}`} style={frame}>
        {unavailableNote}
      </p>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element -- these are
       CDN-hosted archive assets with dimensions already known from the
       package; next/image would re-optimise 1.8 GB of already-derived
       WebP for no gain. */
    <img
      className={styles.image}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      width={width}
      height={height}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
