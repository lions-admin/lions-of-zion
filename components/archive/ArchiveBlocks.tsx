import {
  type ArchiveBlock,
  type ArchiveMedia,
  type ArchivePackageName,
  assetSrcSet,
  assetUrl,
} from '@/lib/content/archive';
import styles from './archive.module.css';

export type ArchiveBlocksProps = {
  pkg: ArchivePackageName;
  blocks: ArchiveBlock[];
  media: Map<string, ArchiveMedia>;
  /**
   * The title the page already renders as its `h1`. A leading `heading` block
   * that repeats it is dropped — see `dropLeadingChrome`.
   */
  renderedTitle?: string;
};

/**
 * Renders a record's `content_blocks` in publication order.
 *
 * Both archives are served by this one component — one's block types are a
 * strict subset of the other's, so there is nothing here that branches on
 * which package a record came from.
 *
 * Two rules from `.ai/DECISIONS.md` (2026-08-26) are enforced structurally
 * rather than left to whoever edits next:
 *
 *  - **Nothing in a record body is a hyperlink.** Credits and captions are
 *    text. `source_url` travels in metadata and JSON-LD instead, so a reader
 *    is never invited out of the record mid-sentence.
 *  - **Credits always render.** They are provenance, not decoration: an
 *    unsourced archive cannot answer denial, which is what this section
 *    exists to do.
 */
/** Whitespace-collapsed, case-insensitive — the records vary in both. */
const normalise = (value: string | null | undefined) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Two pieces of source-site furniture that only ever appear at position 0.
 *
 * Both are dropped at *render* time and the stored record is untouched, which
 * is the precedent `displayTitle()` already set in `lib/content/archive.ts`
 * for the same class of chrome.
 *
 * **The breadcrumb.** The crawler captured october7.org's nav as the first
 * paragraph on 367 of 505 testimony versions, so the first sentence a reader
 * met was "October 7 > Gaza Border Communities > Testimony of Gili Y" — set
 * in the witness's own body voice, two lines under an `h1` whose text is that
 * breadcrumb's last segment. Matched on shape rather than on a leading
 * "October 7": 37 versions open with a localised root ("7 de outubro > …"),
 * and a length cap of ~120 would miss 71 of them (the longest real breadcrumb
 * is 163 characters). Verified against both packages: the shape matches all
 * 367 at index 0 and **nothing at any later position**, so there is no
 * mid-record false positive to worry about.
 *
 * **The repeated title.** Every one of the 670 hamas-massacre versions opens
 * with a `heading` block whose text is the record title, which the page has
 * already set as its `h1` directly above. No text is lost by dropping it —
 * the same string still renders, once, at the top.
 *
 * Deliberately *not* handled here: the paragraph that repeats the title on
 * 336 of those records. A byte-equality skip catches only half of them, on
 * ~215 Spanish versions the duplicate is the untranslated English sentence —
 * an import problem rather than a rendering one — and suppressing a record's
 * only paragraph would contradict the provenance footer's promise that the
 * text is "reproduced as published … unaltered".
 */
function dropLeadingChrome(blocks: ArchiveBlock[], renderedTitle?: string): ArchiveBlock[] {
  const first = blocks[0];
  if (!first) return blocks;

  const isBreadcrumb =
    first.type === 'paragraph' &&
    typeof first.text === 'string' &&
    first.text.includes('\n>') &&
    first.text.length < 200;

  const repeatsTitle =
    first.type === 'heading' &&
    !!renderedTitle &&
    normalise(first.text) === normalise(renderedTitle);

  return isBreadcrumb || repeatsTitle ? blocks.slice(1) : blocks;
}

export function ArchiveBlocks({ pkg, blocks, media, renderedTitle }: ArchiveBlocksProps) {
  const ordered = dropLeadingChrome(
    [...blocks].sort((a, b) => a.position - b.position),
    renderedTitle,
  );

  return (
    <>
      {ordered.map((block, i) => (
        <Block key={`${block.type}-${block.position}-${i}`} pkg={pkg} block={block} media={media} />
      ))}
    </>
  );
}

function Block({
  pkg,
  block,
  media,
}: {
  pkg: ArchivePackageName;
  block: ArchiveBlock;
  media: Map<string, ArchiveMedia>;
}) {
  switch (block.type) {
    case 'heading':
      return block.text ? <h2 className={styles.heading}>{block.text}</h2> : null;

    case 'paragraph':
      return block.text ? <p className={styles.paragraph}>{block.text}</p> : null;

    case 'quote':
      return block.text ? (
        <blockquote className={styles.quote}>
          <p>{block.text}</p>
        </blockquote>
      ) : null;

    // A standalone caption belongs to the block above it. It is rendered as a
    // caption rather than a paragraph so it does not read as the record's own
    // prose — the distinction matters when the record is testimony.
    case 'caption':
      return block.text ? <p className={styles.standaloneCaption}>{block.text}</p> : null;

    // The contract allows a link block; neither archive uses one. If a future
    // import brings one, it renders as text — see the no-hyperlinks rule above.
    case 'link':
      return block.text ? <p className={styles.paragraph}>{block.text}</p> : null;

    case 'image':
      return <ImageBlock pkg={pkg} block={block} media={media} />;

    case 'video':
      return <VideoBlock pkg={pkg} block={block} media={media} />;

    default:
      return null;
  }
}

function ImageBlock({
  pkg,
  block,
  media,
}: {
  pkg: ArchivePackageName;
  block: ArchiveBlock;
  media: Map<string, ArchiveMedia>;
}) {
  const item = block.media_id ? media.get(block.media_id) : undefined;
  // Only the two external videos lack a file, never an image — but a record
  // that referenced a missing one would crash the whole build rather than
  // lose one figure, so the guard is here too.
  if (!item?.package_path) return null;

  const srcSet = assetSrcSet(pkg, item);
  const caption = block.caption ?? item.caption ?? null;
  const credit = block.credit ?? item.credit ?? null;

  // `alt_text` is null on most items because the source published none, and
  // rule 3 of the package contract forbids inventing one. Where a caption
  // exists it is the honest alternative; where neither does, the image is
  // marked decorative and the record's prose carries the meaning.
  const alt = item.alt_text ?? caption ?? '';

  return (
    <figure className={styles.figure}>
      {/* eslint-disable-next-line @next/next/no-img-element -- these are
          CDN-hosted archive assets with dimensions already known from the
          package; next/image would re-optimise 1.8 GB of already-derived
          WebP for no gain. */}
      <img
        className={styles.image}
        src={assetUrl(pkg, item.package_path)}
        srcSet={srcSet || undefined}
        sizes={srcSet ? '(max-width: 720px) 100vw, 720px' : undefined}
        width={item.width ?? undefined}
        height={item.height ?? undefined}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
      <Caption caption={caption} credit={credit} />
    </figure>
  );
}

function VideoBlock({
  pkg,
  block,
  media,
}: {
  pkg: ArchivePackageName;
  block: ArchiveBlock;
  media: Map<string, ArchiveMedia>;
}) {
  const item = block.media_id ? media.get(block.media_id) : undefined;
  if (!item) return null;

  const caption = block.caption ?? item.caption ?? null;
  const credit = block.credit ?? item.credit ?? null;

  // Two videos across both archives are hosted on YouTube; the packages record
  // them without downloading them, so there is no file to play. Saying so is
  // better than dropping the block: the reader learns something exists here
  // that this archive does not hold. The pointer stays out of the prose and
  // travels in the record's provenance note instead.
  if (!item.package_path) {
    return (
      <figure className={styles.figure}>
        <p className={styles.externalMedia}>
          A video published with this record is hosted on{' '}
          {item.external_platform ?? 'an external platform'} and is not held in
          this archive.
        </p>
        <Caption caption={caption} credit={credit} />
      </figure>
    );
  }

  // Every locally held video carries a poster — verified, not assumed.
  const posterId = block.thumbnail_media_id ?? item.thumbnail_media_id ?? null;
  const poster = posterId ? media.get(posterId) : undefined;

  return (
    <figure className={styles.figure}>
      {/* All 209 videos are H.264 + AAC with `moov` ahead of `mdat`, so they
          begin playing without downloading the whole file. `preload="metadata"`
          keeps a page of records from pulling megabytes nobody asked for.

          Dimensions fall back to the poster's: every october7 video item
          carries null width/height, so without this the element lays out at
          the 300x150 intrinsic default and jumps when metadata arrives —
          mid-read, on records holding up to 25 clips. The poster is always
          there to ask: `tests/archive-content.test.ts:107` asserts every
          locally held video has one, and all 74 posters carry both values.
          No `aspect-ratio` floor — these are overwhelmingly portrait phone
          clips, so a 16/9 default would reserve a wrong-shaped box and cause
          the jump it was meant to prevent. */}
      <video
        className={styles.video}
        controls
        preload="metadata"
        poster={poster?.package_path ? assetUrl(pkg, poster.package_path) : undefined}
        width={item.width ?? poster?.width ?? undefined}
        height={item.height ?? poster?.height ?? undefined}
      >
        <source src={assetUrl(pkg, item.package_path)} type={item.mime_type ?? 'video/mp4'} />
        Your browser cannot play this video.
      </video>
      <Caption caption={caption} credit={credit} />
    </figure>
  );
}

/** Caption and credit as text. Never a link — see the rule at the top. */
function Caption({ caption, credit }: { caption: string | null; credit: string | null }) {
  if (!caption && !credit) return null;
  return (
    <figcaption className={styles.caption}>
      {caption ? <span className={styles.captionText}>{caption}</span> : null}
      {credit ? <span className={styles.credit}>{credit}</span> : null}
    </figcaption>
  );
}
