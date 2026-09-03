/**
 * The archive seam — shared types and loaders for both imported packages.
 *
 * `content-packages/<name>/` holds what `scripts/import-archive-package.mjs`
 * copied out of a package built to the `october7-integration-package@1`
 * contract. Both packages satisfy it identically where it matters: the
 * story↔media relation is key-for-key the same and one archive's block types
 * are a strict subset of the other's, so nothing below branches on which
 * package a record came from.
 *
 * Like the rest of `lib/content/`, this is the seam a real published-content
 * query would land on: callers ask for a record by id, not for a file.
 *
 * These accessors are `async` and that is safe — unlike `home.ts`, none of
 * this is in the home route's render path. Every consumer is a route that
 * prerenders at build time.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type ArchivePackageName = 'october7' | 'hamas-massacre';

/** The seven block types the contract allows. This archive set uses four. */
export type ArchiveBlock = {
  type: 'heading' | 'paragraph' | 'quote' | 'caption' | 'link' | 'image' | 'video';
  position: number;
  text?: string;
  href?: string;
  media_id?: string;
  thumbnail_media_id?: string;
  caption?: string;
  credit?: string;
};

export type ArchiveVersion = {
  story_id: string;
  locale: string;
  direction: 'ltr' | 'rtl';
  status: string;
  title: string;
  excerpt?: string;
  full_text?: string;
  content_blocks: ArchiveBlock[];
  cover_media_id?: string | null;
  cover_status: 'ok' | 'from-video-thumbnail' | 'missing-in-source';
  source_url?: string;
  original_slug?: string;
  media_ids?: string[];
};

export type ArchiveRecord = {
  canonical_story_id: string;
  default_language: string;
  available_languages: string[];
  witness_name: string | null;
  category_id: string | null;
  publication_date: string | null;
  cover_media_id: string | null;
  translation_status: string;
  title?: string;
  source_site?: string;
  versions: Record<string, ArchiveVersion>;
};

export type ArchiveMedia = {
  media_id: string;
  type: 'image' | 'video' | 'thumbnail' | 'audio' | 'document';
  mime_type?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  /**
   * Null for the two videos the source hosts on YouTube. The package records
   * them rather than downloading them, so there is no local file to serve —
   * see `validation_status: 'external-reference'`.
   */
  package_path: string | null;
  thumbnail_media_id?: string | null;
  web_variants?: { width: number; height: number | null; path: string }[];
  srcset?: string;
  alt_text?: string | null;
  caption?: string | null;
  credit?: string | null;
  source_url?: string | null;
  external_platform?: string | null;
  external_video_id?: string | null;
  validation_status: string;
};

export type ArchiveIndexEntry = {
  id: string;
  title: string | null;
  category: string | null;
  date: string | null;
  cover: string | null;
  languages: string[];
  defaultLanguage: string;
  witness: string | null;
  /**
   * The default-language version's excerpt, shortened at import so a listing
   * can show the record's own words without opening 514 record files.
   * Written by `import-archive-package.mjs` (and its `--regenerate-index`
   * mode); optional because an index imported before 2026-08-27 lacks it.
   */
  excerpt?: string | null;
};

export type ArchiveCategory = {
  category_id: string;
  menu_order?: number | null;
  record_count?: number | null;
  names?: Record<string, string | null>;
};

export type ArchiveManifest = {
  name: string;
  sourceSite: string | null;
  defaultLanguage: string;
  languages: string[];
  counts: { records: number; media: number; translationLinks: number; categories: number };
};

const ROOT = path.join(process.cwd(), 'content-packages');

/**
 * Package-level files are read once per process and kept. A build renders
 * hundreds of pages from the same index and media registry; re-reading and
 * re-parsing them per page is the difference between one pass and hundreds.
 * Records are deliberately *not* cached — each is read by exactly one page.
 */
const cache = new Map<string, Promise<unknown>>();

function readPackageFile<T>(pkg: ArchivePackageName, file: string): Promise<T> {
  const key = `${pkg}/${file}`;
  let hit = cache.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = readFile(path.join(ROOT, pkg, file), 'utf8').then((raw) => JSON.parse(raw) as T);
    cache.set(key, hit);
  }
  return hit;
}

export function getManifest(pkg: ArchivePackageName): Promise<ArchiveManifest> {
  return readPackageFile<ArchiveManifest>(pkg, 'manifest.json');
}

export function getIndex(pkg: ArchivePackageName): Promise<ArchiveIndexEntry[]> {
  return readPackageFile<ArchiveIndexEntry[]>(pkg, 'index.json');
}

export function getCategories(pkg: ArchivePackageName): Promise<ArchiveCategory[]> {
  return readPackageFile<ArchiveCategory[]>(pkg, 'categories.json');
}

/** Media keyed by `media_id` — the only supported way to reach an asset. */
export async function getMediaRegistry(
  pkg: ArchivePackageName,
): Promise<Map<string, ArchiveMedia>> {
  const key = `${pkg}/__media_map`;
  let hit = cache.get(key) as Promise<Map<string, ArchiveMedia>> | undefined;
  if (!hit) {
    hit = readPackageFile<ArchiveMedia[]>(pkg, 'media.json').then(
      (items) => new Map(items.map((m) => [m.media_id, m])),
    );
    cache.set(key, hit);
  }
  return hit;
}

/** A single record, or null when the id is not in this package. */
export async function getRecord(
  pkg: ArchivePackageName,
  id: string,
): Promise<ArchiveRecord | null> {
  // `id` reaches here from a route parameter. Anything that could climb out
  // of the records directory is refused rather than normalised, because a
  // traversal that "works" is worse than one that fails.
  if (!/^[a-z0-9À-ɏ-]+$/.test(id)) return null;
  try {
    const raw = await readFile(path.join(ROOT, pkg, 'records', `${id}.json`), 'utf8');
    return JSON.parse(raw) as ArchiveRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Public URL for a packaged asset.
 *
 * Media never enters this repository — roughly 1.8 GB of it. In production
 * `NEXT_PUBLIC_ARCHIVE_CDN` points at the bucket; in development
 * `import-archive-package.mjs --link-assets` symlinks the package's `assets/`
 * to `public/archive/<pkg>/`, which is gitignored. Either way the stored path
 * is relative and only the prefix changes, exactly as the package intends.
 *
 * This reads `process.env` in a frontend module, which `CLAUDE.md` otherwise
 * reserves to `server/core/config.ts`. `NEXT_PUBLIC_*` is substituted at build
 * time rather than read at runtime, so it is the same category as the
 * documented `NODE_ENV` check in `components/graphics/viewport.ts`.
 */
export function assetUrl(pkg: ArchivePackageName, packagePath: string): string {
  const base = (process.env.NEXT_PUBLIC_ARCHIVE_CDN ?? '/archive').replace(/\/+$/, '');
  return `${base}/${pkg}/${packagePath.replace(/^assets\//, '')}`;
}

/** `srcset` rewritten onto public URLs; empty when the source had no variants. */
export function assetSrcSet(pkg: ArchivePackageName, media: ArchiveMedia): string {
  if (!media.web_variants?.length) return '';
  return media.web_variants
    .map((v) => `${assetUrl(pkg, v.path)} ${v.width}w`)
    .join(', ');
}

/** An index entry with its cover resolved to a servable URL — for listings. */
export type ArchiveIndexDisplayEntry = ArchiveIndexEntry & {
  thumb: string | null;
  /**
   * The cover's intrinsic size, so a row's plate reserves its box before the
   * bytes arrive (OCT-007). Every image and thumbnail in both packages
   * records both values — verified, not assumed — so this is null only when
   * the entry has no cover at all.
   */
  thumbWidth: number | null;
  thumbHeight: number | null;
  /** `srcset` over the cover's baked derivatives; '' where none were baked. */
  thumbSrcSet: string;
};

/**
 * Resolve each entry's `cover` (a `media_id`) to the URL an index row can
 * paint — the smallest web derivative (w480) where one was baked, the
 * original file where none was (117 of hamas-massacre's video thumbnails,
 * 5 october7 covers). Server-side on purpose: the resolution needs the media
 * registry, and shipping a 14 MB registry to the client so a list can find
 * 335 thumbnails would be the wrong trade in both directions.
 */
export async function withCoverThumbs(
  pkg: ArchivePackageName,
  entries: ArchiveIndexEntry[],
): Promise<ArchiveIndexDisplayEntry[]> {
  const media = await getMediaRegistry(pkg);
  return entries.map((entry) => {
    const item = entry.cover ? media.get(entry.cover) : undefined;
    const variant = item?.web_variants?.length
      ? item.web_variants.reduce((a, b) => (b.width < a.width ? b : a))
      : undefined;
    const path = variant?.path ?? item?.package_path ?? null;
    return {
      ...entry,
      thumb: path ? assetUrl(pkg, path) : null,
      thumbWidth: variant?.width ?? item?.width ?? null,
      thumbHeight: variant?.height ?? item?.height ?? null,
      thumbSrcSet: item ? assetSrcSet(pkg, item) : '',
    };
  });
}

/**
 * What a record actually holds, without opening it.
 *
 * The index carries a title, a date, a cover and an excerpt — enough for a
 * uniform row and not enough to tell a fifteen-section testimony from a
 * two-line caption, or a film from a photograph. Both distinctions are the
 * whole point of the two rebuilt indexes (OCT-002/OCT-003): the documentation
 * archive is 209 films and 126 photographs filed under the source's own
 * categories, and the testimony archive is 178 accounts running from a
 * paragraph to 7,525 words.
 *
 * Nothing here is inferred or invented — `medium` is which block types the
 * source published, `words` is the record's own text, `sections` is its own
 * headings. A record with neither image nor video block is `text`.
 */
export type ArchiveRecordDigest = {
  medium: 'video' | 'image' | 'text';
  videos: number;
  images: number;
  /** Words in the default-language version's own text. */
  words: number;
  /** Headings in that version — how far the record is structured. */
  sections: number;
};

function digestOf(record: ArchiveRecord): ArchiveRecordDigest {
  const version = pickVersion(record);
  let videos = 0;
  let images = 0;
  let sections = 0;
  for (const block of version.content_blocks ?? []) {
    if (block.type === 'video') videos += 1;
    else if (block.type === 'image') images += 1;
    else if (block.type === 'heading' && block.text) sections += 1;
  }
  return {
    medium: videos > 0 ? 'video' : images > 0 ? 'image' : 'text',
    videos,
    images,
    words: (version.full_text ?? '').split(/\s+/).filter(Boolean).length,
    sections,
  };
}

/**
 * Every record's digest, keyed by id — one pass over the package, kept.
 *
 * Read once per process and cached beside the index and the media registry,
 * for the same reason: the two index routes are rendered from it and each
 * record file is otherwise opened by exactly one page. The cost is 2.6 MB
 * (documentation) or 9.3 MB (testimonies) of JSON read and discarded, once;
 * what survives is five numbers per record.
 *
 * Read in bounded batches rather than one `Promise.all` over 514 files: the
 * build renders ~1,177 pages from the same process and exhausting the file
 * descriptor table to save a few milliseconds is not a trade worth making.
 */
export async function getRecordDigests(
  pkg: ArchivePackageName,
): Promise<Map<string, ArchiveRecordDigest>> {
  const key = `${pkg}/__digests`;
  let hit = cache.get(key) as Promise<Map<string, ArchiveRecordDigest>> | undefined;
  if (!hit) {
    hit = (async () => {
      const index = await getIndex(pkg);
      const digests = new Map<string, ArchiveRecordDigest>();
      const BATCH = 32;
      for (let i = 0; i < index.length; i += BATCH) {
        const slice = index.slice(i, i + BATCH);
        const records = await Promise.all(slice.map((entry) => getRecord(pkg, entry.id)));
        records.forEach((record, n) => {
          if (record) digests.set(slice[n].id, digestOf(record));
        });
      }
      return digests;
    })();
    cache.set(key, hit);
  }
  return hit;
}

/** The version a locale should render, falling back to the record's default. */
export function pickVersion(record: ArchiveRecord, locale?: string): ArchiveVersion {
  if (locale && record.versions[locale]) return record.versions[locale];
  return record.versions[record.default_language] ?? Object.values(record.versions)[0];
}

/* Render-time display helpers. They live in `archive-display.ts` because this
   module reads the filesystem and `ArchiveIndexFilter` is a client component;
   re-exported here so server-side call sites need not care. */
export { displayTitle, displayWitness } from './archive-display';
