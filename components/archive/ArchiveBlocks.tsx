import { Fragment } from 'react';
import {
  type ArchiveBlock,
  type ArchiveMedia,
  type ArchivePackageName,
  assetSrcSet,
  assetUrl,
} from '@/lib/content/archive';
import { buildXShareText, xIntentUrl } from '@/lib/content/share-text';
import { MediaBlock } from '@/components/content/MediaBlock';
import { SensitiveContent } from '@/components/content/SensitiveContent';
import { ArchiveImage } from './ArchiveImage';
import styles from './archive.module.css';

/**
 * What this record holds that a reader should choose before seeing (OCT-005).
 *
 * Derived by `ArchiveRecordPage` from the package and the source's own
 * category — never from a judgement made here about an individual record, and
 * never from metadata the archive does not hold.
 *
 *  - `all` — the documentation archive. Every one of its 335 records *is* a
 *    photograph or a film of the attack, filed by the source under one of six
 *    categories it named itself. There is no such thing as an ungraphic record
 *    in it.
 *  - `video` — the testimony archive. The account is the record and is not
 *    gated; the footage published alongside it is from that day, and is.
 *  - `none` — nothing to gate.
 */
export type ArchiveSensitivity = {
  gate: 'all' | 'video' | 'none';
  /** The source's own filing, named on the gate. */
  category: string;
  /** How the material is described on the gate, in one sentence. */
  note: string;
};

export type ArchiveBlocksProps = {
  pkg: ArchivePackageName;
  blocks: ArchiveBlock[];
  media: Map<string, ArchiveMedia>;
  /** Which of this record's media stand behind a stated choice. */
  sensitivity?: ArchiveSensitivity;
  /**
   * `record` renders the source's publication order — the testimony archive,
   * where the account is the record and its figures sit inside it.
   *
   * `exhibit` lifts the media above the text — the documentation archive,
   * where the record is one film or photograph and the text is its
   * description. Its 335 records are stored heading-then-paragraph-then-media,
   * so publication order buried the exhibit under two restatements of the
   * page's own `h1`. Nothing is dropped or rewritten; the description is set
   * under the thing it describes.
   */
  layout?: 'record' | 'exhibit';
  /**
   * The title the page already renders as its `h1`. A leading `heading` block
   * that repeats it is dropped — see `dropLeadingChrome`.
   */
  renderedTitle?: string;
  /**
   * The record page's canonical URL, for each media item's share link.
   * Omitted (with `shareTitle`) the media action rows do not render — a
   * caller outside a record page has no URL for them to carry.
   */
  shareUrl?: string;
  /** The record's display title — the share text when a caption is absent. */
  shareTitle?: string;
};

/**
 * Renders a record's `content_blocks` in publication order.
 *
 * Both archives are served by this one component — one's block types are a
 * strict subset of the other's, so there is nothing here that branches on
 * which package a record came from.
 *
 * The rules this enforces moved once, and the history matters:
 *
 *  - **The record's content carries no hyperlinks.** A `link` block renders
 *    as text, and captions and credits are text — a reader is never invited
 *    out of the record mid-sentence (`.ai/DECISIONS.md`, 2026-08-26). The
 *    download and share affordances under each media item are *not* an
 *    exception: they are this site's own chrome, added by owner decision
 *    (`.ai/DECISIONS.md`, 2026-08-27), and none of them points back into the
 *    source site's prose.
 *  - **In-body media credits still render** (`block.credit` — six items
 *    across both archives). The 2026-08-27 split removed the *record-level*
 *    provenance footer, not these: what a source wrote against a specific
 *    photograph stays with the photograph.
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
 * only paragraph would edit the record rather than drop the source site's
 * chrome around it. (That reason used to cite the provenance footer's
 * "reproduced as published … unaltered" promise; the footer was removed on
 * 2026-08-27, but the boundary it described still governs this function —
 * chrome may be dropped, the record's own words may not.)
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

export function ArchiveBlocks({
  pkg,
  blocks,
  media,
  sensitivity,
  layout = 'record',
  renderedTitle,
  shareUrl,
  shareTitle,
}: ArchiveBlocksProps) {
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

  const render = (block: ArchiveBlock, key: string) => (
    <Block
      key={key}
      pkg={pkg}
      block={block}
      media={media}
      sensitivity={sensitivity}
      shareUrl={shareUrl}
      shareTitle={shareTitle}
    />
  );

  if (layout === 'exhibit') {
    const isMedia = (block: ArchiveBlock) =>
      block.type === 'image' || block.type === 'video';
    const exhibits = ordered.filter(isMedia);
    const description = ordered.filter((block) => !isMedia(block));
    return (
      <>
        <div className={styles.exhibit}>
          {exhibits.map((block, i) => render(block, `exhibit-${i}`))}
        </div>
        {description.length > 0 ? (
          <section className={styles.description} aria-labelledby="record-description">
            <h2 className={styles.descriptionHeading} id="record-description">
              What this shows
            </h2>
            {description.map((block, i) => render(block, `description-${i}`))}
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
      {groupByHeading(ordered).map((group, gi) => {
        const body = group.body.map((block, i) => render(block, `${block.type}-${i}`));
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

type ArchiveMediaBlockProps = {
  pkg: ArchivePackageName;
  block: ArchiveBlock;
  media: Map<string, ArchiveMedia>;
  sensitivity?: ArchiveSensitivity;
  shareUrl?: string;
  shareTitle?: string;
};

/**
 * Whether this medium stands behind a stated choice on this record, and what
 * the gate says when it does.
 *
 * The label names the thing and its filing — "Film · The Nova Party Massacre"
 * — so the reader knows what they are about to open and where it came from
 * before they open it. Nothing here describes what is *in* the material: the
 * archive published no such description, and writing one would be inventing
 * evidence on an evidentiary surface.
 */
function gateFor(
  sensitivity: ArchiveSensitivity | undefined,
  medium: 'video' | 'image',
): { category: string; warning: string } | null {
  if (!sensitivity || sensitivity.gate === 'none') return null;
  if (sensitivity.gate === 'video' && medium !== 'video') return null;
  const label = medium === 'video' ? 'Film' : 'Photograph';
  return {
    category: `${label} · ${sensitivity.category}`,
    warning: sensitivity.note,
  };
}

function Block({
  pkg,
  block,
  media,
  sensitivity,
  shareUrl,
  shareTitle,
}: ArchiveMediaBlockProps) {
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
      return (
        <ImageBlock
          pkg={pkg}
          block={block}
          media={media}
          sensitivity={sensitivity}
          shareUrl={shareUrl}
          shareTitle={shareTitle}
        />
      );

    case 'video':
      return (
        <VideoBlock
          pkg={pkg}
          block={block}
          media={media}
          sensitivity={sensitivity}
          shareUrl={shareUrl}
          shareTitle={shareTitle}
        />
      );

    default:
      return null;
  }
}

function ImageBlock({
  pkg,
  block,
  media,
  sensitivity,
  shareUrl,
  shareTitle,
}: ArchiveMediaBlockProps) {
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

  const gate = gateFor(sensitivity, 'image');
  const picture = (
    <ArchiveImage
      src={assetUrl(pkg, item.package_path)}
      srcSet={srcSet || undefined}
      sizes={srcSet ? '(max-width: 720px) 100vw, 720px' : undefined}
      width={item.width ?? undefined}
      height={item.height ?? undefined}
      alt={alt}
      unavailableNote="An image published with this record is not loading from this archive."
    />
  );

  return (
    <MediaBlock
      className={styles.figure}
      caption={caption ?? undefined}
      credit={credit ?? undefined}
      provenance={mediaActionRow({ pkg, item, caption, shareUrl, shareTitle })}
      aspectRatio={packageAspectRatio(item.width, item.height)}
    >
      {/* The gate goes *inside* the frame, so caption, credit and the download
          and share row stay outside it — a reader who chooses not to look can
          still read what the archive holds, and cite it. */}
      {gate ? (
        <SensitiveContent layout="frame" category={gate.category} warning={gate.warning}>
          {picture}
        </SensitiveContent>
      ) : (
        picture
      )}
    </MediaBlock>
  );
}

function VideoBlock({
  pkg,
  block,
  media,
  sensitivity,
  shareUrl,
  shareTitle,
}: ArchiveMediaBlockProps) {
  const item = block.media_id ? media.get(block.media_id) : undefined;
  if (!item) return null;

  const caption = block.caption ?? item.caption ?? null;
  const credit = block.credit ?? item.credit ?? null;

  // Two videos across both archives are hosted on YouTube; the packages record
  // them without downloading them, so there is no file to play. Saying so is
  // better than dropping the block: the reader learns something exists here
  // that this archive does not hold. The pointer stays out of the prose and
  // travels in the record's JSON-LD. No action row either — there is no file
  // to download, and a "Download" that cannot deliver is a false control.
  if (!item.package_path) {
    return (
      <MediaBlock
        className={styles.figure}
        caption={caption ?? undefined}
        credit={credit ?? undefined}
      >
        <p className={styles.externalMedia}>
          A video published with this record is hosted on{' '}
          {item.external_platform ?? 'an external platform'} and is not held in
          this archive.
        </p>
      </MediaBlock>
    );
  }

  // Every locally held video carries a poster — verified, not assumed.
  const posterId = block.thumbnail_media_id ?? item.thumbnail_media_id ?? null;
  const poster = posterId ? media.get(posterId) : undefined;
  const width = item.width ?? poster?.width ?? undefined;
  const height = item.height ?? poster?.height ?? undefined;

  const gate = gateFor(sensitivity, 'video');
  /* All 209 videos are H.264 + AAC with `moov` ahead of `mdat`, so they begin
     playing without downloading the whole file. `preload="metadata"` keeps a
     page of records from pulling megabytes nobody asked for, and there is no
     `autoplay` anywhere in this archive — behind a gate the element does not
     exist at all until the reader asks for it.

     The poster is dropped when the clip is gated: a poster frame *is* the
     film's first frame, so painting one behind a "Show this material" button
     would hand over exactly what the button is asking about.

     Dimensions fall back to the poster's: every october7 video item carries
     null width/height, so without this the element lays out at the 300x150
     intrinsic default and jumps when metadata arrives — mid-read, on records
     holding up to 25 clips. The poster is always there to ask:
     `tests/archive-content.test.ts:107` asserts every locally held video has
     one, and all 74 posters carry both values. Package ratio is passed to
     MediaBlock so a 16/10 editorial default does not crop these — they are
     overwhelmingly portrait phone clips. */
  const film = (
    <video
      className={styles.video}
      controls
      preload="metadata"
      poster={
        !gate && poster?.package_path ? assetUrl(pkg, poster.package_path) : undefined
      }
      width={width}
      height={height}
    >
      <source src={assetUrl(pkg, item.package_path)} type={item.mime_type ?? 'video/mp4'} />
      Your browser cannot play this video.
    </video>
  );

  return (
    <MediaBlock
      className={`${styles.figure} ${styles.heldVideo}`}
      caption={caption ?? undefined}
      credit={credit ?? undefined}
      provenance={mediaActionRow({ pkg, item, caption, shareUrl, shareTitle })}
      aspectRatio={packageAspectRatio(width, height)}
    >
      {gate ? (
        <SensitiveContent layout="frame" category={gate.category} warning={gate.warning}>
          {film}
        </SensitiveContent>
      ) : (
        film
      )}
    </MediaBlock>
  );
}

function packageAspectRatio(
  width?: number | null,
  height?: number | null,
): string | undefined {
  return width && height ? `${width} / ${height}` : undefined;
}

function mediaActionRow({
  pkg,
  item,
  caption,
  shareUrl,
  shareTitle,
}: {
  pkg: ArchivePackageName;
  item: ArchiveMedia;
  caption: string | null;
  shareUrl?: string;
  shareTitle?: string;
}) {
  if (!shareUrl || !shareTitle || !item.package_path) return undefined;
  return (
    <MediaActions
      pkg={pkg}
      item={item}
      caption={caption}
      shareUrl={shareUrl}
      shareTitle={shareTitle}
    />
  );
}

/**
 * Download and share for one held media file — plain anchors, no client
 * JavaScript, which is what keeps ~1,027 of these free on a page that can
 * hold twenty-five.
 *
 * Rendered in MediaBlock's `provenance` slot so the row stays inside the
 * `figcaption` after caption and credit. The archive has no provenance
 * string to invent; this is site chrome, not a source credit.
 *
 * The download serves the *original* file straight from the CDN:
 * `?download=1` makes the Blob store answer `Content-Disposition:
 * attachment`, so the browser saves instead of opening a tab. The `download`
 * attribute's record-derived name is a best effort — cross-origin, the
 * header's own filename (the content hash) is what the browser uses — kept
 * because it costs nothing and names the file wherever same-origin serving
 * (the dev symlink) applies. The share is an X intent carrying the caption,
 * or failing that the record's title, and the record page's URL — the file
 * itself has no page of its own to point at.
 */
function MediaActions({
  pkg,
  item,
  caption,
  shareUrl,
  shareTitle,
}: {
  pkg: ArchivePackageName;
  item: ArchiveMedia;
  caption: string | null;
  shareUrl?: string;
  shareTitle?: string;
}) {
  if (!shareUrl || !shareTitle || !item.package_path) return null;

  const href = assetUrl(pkg, item.package_path);
  const extension = item.package_path.split('.').pop() ?? 'bin';
  const xText = buildXShareText({ title: shareTitle, text: caption });

  // The record's name on the file, so a download does not arrive as an
  // anonymous hash on someone's disk (`.ai/DECISIONS.md`, 2026-08-27).
  // Unicode-aware for the same reason `headingId` is — most versions are not
  // English, and an ASCII strip would leave nothing of a Japanese title.
  const titleSlug = shareTitle
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const filename = `${titleSlug || 'record'}-${item.media_id}.${extension}`;

  return (
    <span className={styles.mediaActions}>
      <a className={styles.mediaAction} href={`${href}?download=1`} download={filename}>
        Download
      </a>
      <a
        className={styles.mediaAction}
        href={xIntentUrl(xText, shareUrl)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Share on X
      </a>
    </span>
  );
}

