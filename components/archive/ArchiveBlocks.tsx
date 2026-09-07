import { Fragment } from 'react';
import {
  type ArchiveBlock,
  type ArchiveMedia,
  type ArchivePackageName,
  assetSrcSet,
  assetUrl,
} from '@/lib/content/archive';
import { MediaBlock } from '@/components/content/MediaBlock';
import { SensitiveContent } from '@/components/content/SensitiveContent';
import { ArchiveImage } from './ArchiveImage';
import { XMediaPostButton } from './XMediaPostButton';
import styles from './archive.module.css';

export type ArchiveSensitivity = {
  gate: 'all' | 'video' | 'none';
  category: string;
  note: string;
};

export type ArchiveBlocksProps = {
  pkg: ArchivePackageName;
  recordId?: string;
  locale?: string;
  blocks: ArchiveBlock[];
  media: Map<string, ArchiveMedia>;
  sensitivity?: ArchiveSensitivity;
  layout?: 'record' | 'exhibit';
  renderedTitle?: string;
  shareUrl?: string;
  shareTitle?: string;
};

const normalise = (value: string | null | undefined) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

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
  return groups.filter((group) => group.heading || group.body.length > 0);
}

export function ArchiveBlocks({
  pkg,
  recordId,
  locale,
  blocks,
  media,
  sensitivity,
  layout = 'record',
  renderedTitle,
  shareUrl,
  shareTitle,
}: ArchiveBlocksProps) {
  const positioned = blocks.every((block) => typeof block.position === 'number');
  const ordered = dropLeadingChrome(
    positioned ? [...blocks].sort((a, b) => a.position! - b.position!) : blocks,
    renderedTitle,
  );

  const render = (block: ArchiveBlock, key: string) => (
    <Block
      key={key}
      pkg={pkg}
      recordId={recordId}
      locale={locale}
      block={block}
      media={media}
      sensitivity={sensitivity}
      shareUrl={shareUrl}
      shareTitle={shareTitle}
    />
  );

  if (layout === 'exhibit') {
    const isMedia = (block: ArchiveBlock) => block.type === 'image' || block.type === 'video';
    const exhibits = ordered.filter(isMedia);
    const description = ordered.filter((block) => !isMedia(block));
    return (
      <>
        <div className={styles.exhibit}>
          {exhibits.map((block, index) => render(block, `exhibit-${index}`))}
        </div>
        {description.length > 0 ? (
          <section className={styles.description} aria-labelledby="record-description">
            <h2 className={styles.descriptionHeading} id="record-description">
              What this shows
            </h2>
            {description.map((block, index) => render(block, `description-${index}`))}
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
      {groupByHeading(ordered).map((group, groupIndex) => {
        const body = group.body.map((block, index) => render(block, `${block.type}-${index}`));
        if (!group.heading || !group.id) return <Fragment key={`lede-${groupIndex}`}>{body}</Fragment>;
        return (
          <section key={group.id} aria-labelledby={group.id}>
            <h2 className={styles.heading} id={group.id}>{group.heading.text}</h2>
            {body}
          </section>
        );
      })}
    </>
  );
}

type ArchiveMediaBlockProps = {
  pkg: ArchivePackageName;
  recordId?: string;
  locale?: string;
  block: ArchiveBlock;
  media: Map<string, ArchiveMedia>;
  sensitivity?: ArchiveSensitivity;
  shareUrl?: string;
  shareTitle?: string;
};

function gateFor(
  sensitivity: ArchiveSensitivity | undefined,
  medium: 'video' | 'image',
): { category: string; warning: string } | null {
  if (!sensitivity || sensitivity.gate === 'none') return null;
  if (sensitivity.gate === 'video' && medium !== 'video') return null;
  return {
    category: `${medium === 'video' ? 'Film' : 'Photograph'} · ${sensitivity.category}`,
    warning: sensitivity.note,
  };
}

function Block({
  pkg,
  recordId,
  locale,
  block,
  media,
  sensitivity,
  shareUrl,
  shareTitle,
}: ArchiveMediaBlockProps) {
  switch (block.type) {
    case 'heading':
      return null;
    case 'paragraph':
      return block.text ? <p className={styles.paragraph}>{block.text}</p> : null;
    case 'quote':
      return block.text ? <blockquote className={styles.quote}><p>{block.text}</p></blockquote> : null;
    case 'caption':
      return block.text ? <p className={styles.standaloneCaption}>{block.text}</p> : null;
    case 'link':
      return block.text ? <p className={styles.paragraph}>{block.text}</p> : null;
    case 'image':
      return (
        <ImageBlock
          pkg={pkg}
          recordId={recordId}
          locale={locale}
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
          recordId={recordId}
          locale={locale}
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
  recordId,
  locale,
  block,
  media,
  sensitivity,
  shareUrl,
  shareTitle,
}: ArchiveMediaBlockProps) {
  const item = block.media_id ? media.get(block.media_id) : undefined;
  if (!item?.package_path) return null;

  const srcSet = assetSrcSet(pkg, item);
  const caption = block.caption ?? item.caption ?? null;
  const credit = block.credit ?? item.credit ?? null;
  const alt = item.alt_text ?? caption ?? 'Image published with this record. The archive holds no description of it.';
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
      provenance={mediaActionRow({ pkg, recordId, locale, item, shareUrl, shareTitle })}
      aspectRatio={packageAspectRatio(item.width, item.height)}
    >
      {gate ? (
        <SensitiveContent layout="frame" category={gate.category} warning={gate.warning}>
          {picture}
        </SensitiveContent>
      ) : picture}
    </MediaBlock>
  );
}

function VideoBlock({
  pkg,
  recordId,
  locale,
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

  if (!item.package_path) {
    return (
      <MediaBlock className={styles.figure} caption={caption ?? undefined} credit={credit ?? undefined}>
        <p className={styles.externalMedia}>
          A video published with this record is hosted on {item.external_platform ?? 'an external platform'} and is not held in this archive.
        </p>
      </MediaBlock>
    );
  }

  const posterId = block.thumbnail_media_id ?? item.thumbnail_media_id ?? null;
  const poster = posterId ? media.get(posterId) : undefined;
  const width = item.width ?? poster?.width ?? undefined;
  const height = item.height ?? poster?.height ?? undefined;
  const gate = gateFor(sensitivity, 'video');
  const film = (
    <video
      className={styles.video}
      controls
      preload="metadata"
      poster={!gate && poster?.package_path ? assetUrl(pkg, poster.package_path) : undefined}
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
      provenance={mediaActionRow({ pkg, recordId, locale, item, shareUrl, shareTitle })}
      aspectRatio={packageAspectRatio(width, height)}
    >
      {gate ? (
        <SensitiveContent layout="frame" category={gate.category} warning={gate.warning}>
          {film}
        </SensitiveContent>
      ) : film}
    </MediaBlock>
  );
}

function packageAspectRatio(width?: number | null, height?: number | null): string | undefined {
  return width && height ? `${width} / ${height}` : undefined;
}

function mediaActionRow({
  pkg,
  recordId,
  locale,
  item,
  shareUrl,
  shareTitle,
}: {
  pkg: ArchivePackageName;
  recordId?: string;
  locale?: string;
  item: ArchiveMedia;
  shareUrl?: string;
  shareTitle?: string;
}) {
  if (!recordId || !shareUrl || !shareTitle || !item.package_path) return undefined;
  if (item.type !== 'video' && item.type !== 'image') return undefined;
  return (
    <MediaActions
      pkg={pkg}
      recordId={recordId}
      locale={locale}
      item={item}
      shareUrl={shareUrl}
      shareTitle={shareTitle}
    />
  );
}

/** Download and native X posting for one original, locally-held archive file. */
function MediaActions({
  pkg,
  recordId,
  locale,
  item,
  shareUrl,
  shareTitle,
}: {
  pkg: ArchivePackageName;
  recordId: string;
  locale?: string;
  item: ArchiveMedia;
  shareUrl: string;
  shareTitle: string;
}) {
  if (!item.package_path || (item.type !== 'video' && item.type !== 'image')) return null;

  const href = assetUrl(pkg, item.package_path);
  const extension = item.package_path.split('.').pop() ?? 'bin';
  const titleSlug = shareTitle
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const filename = `${titleSlug || 'record'}-${item.media_id}.${extension}`;
  const parsedShareUrl = new URL(shareUrl);
  const returnTo = `${parsedShareUrl.pathname}${parsedShareUrl.search}`;

  return (
    <span className={styles.mediaActions}>
      <a className={styles.mediaAction} href={`${href}?download=1`} download={filename}>
        Download
      </a>
      <XMediaPostButton
        pkg={pkg}
        recordId={recordId}
        mediaId={item.media_id}
        locale={locale}
        assetUrl={href}
        medium={item.type}
        returnTo={returnTo}
        compact
      />
    </span>
  );
}
