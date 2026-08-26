import { Fragment } from 'react';
import {
  type ArchiveBlock,
  type ArchiveMedia,
  type ArchivePackageName,
  assetSrcSet,
  assetUrl,
} from '@/lib/content/archive';
import { ArchiveImage } from './ArchiveImage';
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

/**
 * A heading's anchor id, derived from its own text.
 *
 * The contents rail reads the rendered DOM rather than a per-page list, so a
 * heading with no `id` is invisible to it — `SectionToc` drops every heading
 * it cannot resolve to an anchor. Slugifying here is what makes the rail
 * possible at all, and deriving it from the text means the anchor cannot drift
 * from the heading the way a hand-written list would.
 *
 * Unicode-aware: 661 of the 1,175 versions are not English, and stripping to
 * ASCII would collapse most of a Japanese or Portuguese record's headings to
 * the same empty string. `seen` disambiguates the records that genuinely
 * repeat a heading, so an anchor always points at one place.
 */
function headingId(text: string, seen: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'section';
  const n = seen.get(base) ?? 0;
  seen.set(base, n + 1);
  return n === 0 ? base : `${base}-${n + 1}`;
}

/**
 * The blocks grouped under the heading that introduces them.
 *
 * Flat blocks were enough while nothing navigated them. The contents rail
 * observes a *region* rather than a heading — a heading is a few pixels tall
 * and clears the active band immediately, which reads right scrolling down and
 * wrong scrolling back up — and `SectionToc` finds that region with
 * `closest('section, article')`. Without these `<section>`s every heading
 * resolves to the one `<article>` the page shell owns, so the rail marks entry
 * one and never moves.
 *
 * Anything before the first heading stays ungrouped: a record that opens with
 * prose has no section to put it in, and inventing one would give the rail an
 * entry with no heading to name it.
 */
type BlockGroup = { id: string | null; heading: ArchiveBlock | null; body: ArchiveBlock[] };

function groupByHeading(blocks: ArchiveBlock[]): BlockGroup[] {
  const seen = new Map<string, number>();
  const groups: BlockGroup[] = [{ id: null, heading: null, body: [] }];
  for (const block of blocks) {
    if (block.type === 'heading' && block.text) {
      groups.push({ id: headingId(block.text, seen), heading: block, body: [] });
    } else {
      groups[groups.length - 1].body.push(block);
    }
  }
  return groups.filter((g) => g.heading || g.body.length > 0);
}

export function ArchiveBlocks({ pkg, blocks, media, renderedTitle }: ArchiveBlocksProps) {
  /* Sort only when the whole package is annotated. `position` is absent on
     every october7 block, so `a.position - b.position` was NaN on all 16,265
     of them — a contract enforced by a comparator that cannot fire. Rule 3 is
     honoured by array order itself, so falling back to it is the contract
     rather than a workaround.

     Not `(b.position ?? i)`: that silently interleaves two numbering spaces
     if a package is ever only partly annotated. */
  const positioned = blocks.every((b) => typeof b.position === 'number');
  const ordered = dropLeadingChrome(
    positioned ? [...blocks].sort((a, b) => a.position! - b.position!) : blocks,
    renderedTitle,
  );

  return (
    <>
      {groupByHeading(ordered).map((group, gi) => {
        const body = group.body.map((block, i) => (
          <Block key={`${block.type}-${i}`} pkg={pkg} block={block} media={media} />
        ));
        if (!group.heading || !group.id) {
          return <Fragment key={`lede-${gi}`}>{body}</Fragment>;
        }
        return (
          <section key={group.id} aria-labelledby={group.id}>
            <h2 className={styles.heading} id={group.id}>
              {group.heading.text}
            </h2>
            {body}
          </section>
        );
      })}
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
    // A heading with text never reaches here — `groupByHeading` lifts it out
    // to open its own `<section>`. Only an empty one falls through, and an
    // empty heading is nothing.
    case 'heading':
      return null;

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
  // exists it is the honest alternative.
  //
  // Where neither does — 109 of the documentation archive's 119 images, and 11
  // of the testimonies' 284 — `alt=""` was the wrong answer. It marks the
  // image decorative, so a screen reader is not told an image is there at all;
  // on a surface whose whole purpose is to answer denial, silently omitting a
  // piece of evidence is worse than admitting the archive holds no words for
  // it. The sentence below invents no description: it says what the thing is
  // and that the source published nothing about it, which is the same register
  // as the note standing in for the two videos this archive does not hold.
  const alt =
    item.alt_text ?? caption ?? 'Image published with this record. The archive holds no description of it.';

  return (
    <figure className={styles.figure}>
      <ArchiveImage
        src={assetUrl(pkg, item.package_path)}
        srcSet={srcSet || undefined}
        sizes={srcSet ? '(max-width: 720px) 100vw, 720px' : undefined}
        width={item.width ?? undefined}
        height={item.height ?? undefined}
        alt={alt}
        unavailableNote="An image published with this record is not loading from this archive."
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
