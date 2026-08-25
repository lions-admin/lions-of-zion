/**
 * Host shim for `next/image`.
 *
 * GeopoliticalBrief and SectionPage import baked SVG/PNG assets. The
 * converter's esbuild config already loads `.svg`/`.png` as data URLs, so the
 * import gives a `StaticImageData`-shaped object (or a bare string); this
 * renders it with a plain `<img>`. No optimizer exists outside Next, and for
 * an already-tiny inline asset there was nothing to optimize anyway.
 */
import type { ImgHTMLAttributes } from 'react';

type StaticImageData = { src: string; width?: number; height?: number };
type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | StaticImageData;
  alt: string;
  /* Next-only knobs; accepted and ignored, never forwarded to the DOM. */
  priority?: boolean;
  quality?: number;
  fill?: boolean;
  placeholder?: string;
  blurDataURL?: string;
  loader?: unknown;
  unoptimized?: boolean;
  sizes?: string;
};

export default function Image({
  src, alt, priority, quality, fill, placeholder, blurDataURL, loader, unoptimized, style, ...rest
}: ImageProps) {
  const resolved = typeof src === 'string' ? src : src.src;
  const dims = typeof src === 'string' ? {} : { width: src.width, height: src.height };
  return (
    <img
      src={resolved}
      alt={alt}
      {...dims}
      {...rest}
      style={fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...style } : style}
    />
  );
}
