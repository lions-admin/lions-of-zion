#!/usr/bin/env node
/**
 * Import an October 7 archive integration package into `content-packages/`.
 *
 *   node scripts/import-archive-package.mjs <package-dir> <name> [--link-assets]
 *
 * Both source packages are built to the `october7-integration-package@1`
 * contract and live outside this repository.
 * This script copies in only what the site renders, and never the media.
 *
 * What is taken, and what is deliberately left behind:
 *
 *   taken   content/stories/<id>/story.json  → records/<id>.json
 *           story-groups.json, categories.json, languages.json,
 *           media.json, translation-links.json
 *
 *   left    stories.json / .ndjson      the same records, re-aggregated
 *           story-media.json            already embedded per record
 *           <locale>/story.md           a markdown rendering of content_blocks
 *           <locale>/content.json       the same blocks again
 *           assets/**                   ~1.8 GB; served from a CDN
 *
 * Dropping those four takes october7 from 39 MB to about 11 MB with no loss:
 * every one of them is derivable from what is kept.
 *
 * Media is addressed by `media_id` and resolved through `media.json` at render
 * time. `--link-assets` creates a gitignored symlink under `public/archive/`
 * so images work in local development; production sets
 * `NEXT_PUBLIC_ARCHIVE_CDN` instead. Neither puts a byte of media in git.
 *
 * Re-running is an upsert: ids are contracts, so a record is replaced by id
 * and nothing is duplicated.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [, , pkgDir, name, ...flags] = process.argv;
const LINK_ASSETS = flags.includes('--link-assets');
const REPO = path.resolve(import.meta.dirname, '..');

/**
 * The index's `excerpt`: the default-language version's own words,
 * whitespace-collapsed and cut at a word boundary. 200 characters covers the
 * two clamped lines an index row shows and keeps 514 of these from bloating a
 * file every listing loads; the october7 excerpts themselves run to 500.
 */
const EXCERPT_MAX = 200;

const collapse = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** A flattened source breadcrumb at the very start: "A > B > C". */
const LEADING_CRUMB = /^(?:[^>\n]{1,60}>){1,4}/;

/**
 * The source site's nav, which the crawler captured as each record's opening
 * paragraph — "October 7 \n> Gaza Border Communities \n> Testimony of Noam G".
 * `ArchiveBlocks.dropLeadingChrome` drops it at render for the same reason;
 * this is the index's copy of that rule, matched on shape rather than on a
 * leading "October 7" because localised roots exist ("7 de outubro > …").
 */
const dropLeadingCrumb = (text) => {
  const paragraphs = String(text ?? '').split(/\n\s*\n/);
  const first = paragraphs[0] ?? '';
  return paragraphs.length > 1 && first.includes('\n>') && first.length < 200
    ? paragraphs.slice(1).join('\n\n')
    : text;
};

/**
 * 36 of the 179 october7 excerpts open with that breadcrumb *fused* into the
 * first sentence ("…Testimony of Noam GSaturday, October 7th"), because the
 * source built the excerpt by concatenating without a separator — so there is
 * no clean seam to cut inside the excerpt itself. `full_text` keeps the same
 * chrome as its own paragraph, so those records are rebuilt from it instead.
 * Every hamas-massacre excerpt is clean and is left exactly as published.
 */
const shortExcerpt = (version) => {
  const excerpt = collapse(version?.excerpt);
  const source = LEADING_CRUMB.test(excerpt)
    ? collapse(dropLeadingCrumb(version?.full_text))
    : excerpt;
  // One october7 record has a contaminated excerpt, no `full_text` and no
  // content blocks at all, so there is no clean text to fall back to. It gets
  // no index excerpt rather than the source site's nav or a cut invented
  // inside the witness's own sentence — the row renders title and cover, and
  // `ArchiveRecordList` already handles a missing excerpt.
  if (!source || LEADING_CRUMB.test(source)) return null;
  if (source.length <= EXCERPT_MAX) return source;
  const cut = source.slice(0, EXCERPT_MAX);
  const atWord = cut.slice(0, cut.lastIndexOf(' '));
  return `${(atWord || cut).replace(/[\s,;:.]+$/, '')}…`;
};

const defaultVersion = (record) =>
  record.versions?.[record.default_language] ?? Object.values(record.versions ?? {})[0];

// ---------- regenerate mode: rebuild index.json from committed records ----------
// `--regenerate-index <name>` rereads `content-packages/<name>/records/*.json`
// and rewrites index.json in place, adding what the index schema has gained
// since the entries were imported (today: `excerpt`). Order and every existing
// field are preserved — this augments the committed index, it does not
// re-import anything.
if (pkgDir === '--regenerate-index') {
  if (!name) {
    console.error('usage: import-archive-package.mjs --regenerate-index <name>');
    process.exit(2);
  }
  const dir = path.join(REPO, 'content-packages', name);
  const indexPath = path.join(dir, 'index.json');
  const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const before = fs.statSync(indexPath).size;

  let updated = 0;
  const next = entries.map((entry) => {
    const record = JSON.parse(
      fs.readFileSync(path.join(dir, 'records', `${entry.id}.json`), 'utf8'),
    );
    const excerpt = shortExcerpt(defaultVersion(record));
    if (entry.excerpt !== excerpt) updated += 1;
    return { ...entry, excerpt };
  });

  fs.writeFileSync(indexPath, JSON.stringify(next));
  const after = fs.statSync(indexPath).size;
  console.log(
    `regenerated content-packages/${name}/index.json — ${entries.length} entries, ` +
      `${updated} updated, ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`,
  );
  process.exit(0);
}

if (!pkgDir || !name) {
  console.error('usage: import-archive-package.mjs <package-dir> <name> [--link-assets]');
  console.error('       import-archive-package.mjs --regenerate-index <name>');
  process.exit(2);
}
if (!/^[a-z0-9-]+$/.test(name)) {
  console.error(`invalid name "${name}" — lowercase letters, digits and dashes only`);
  process.exit(2);
}

const src = path.resolve(pkgDir);
const out = path.join(REPO, 'content-packages', name);

const readJson = (rel) =>
  JSON.parse(fs.readFileSync(path.join(src, rel), 'utf8'));
const writeJson = (rel, value) => {
  const dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(value));
  return Buffer.byteLength(JSON.stringify(value));
};

// ---------- validate the source before copying anything ----------
const manifest = readJson('package.json');
const groups = readJson('data/story-groups.json');
const media = readJson('data/media.json');
const links = readJson('data/translation-links.json');
const categories = readJson('data/categories.json');
const languages = readJson('data/languages.json');

const expect = (label, actual, want) => {
  if (want !== undefined && actual !== want) {
    console.error(`  package is inconsistent: ${label} is ${actual}, manifest says ${want}`);
    process.exit(1);
  }
};
expect('story groups', groups.length, manifest.counts?.story_groups);
expect('media', media.length, manifest.counts?.media);
expect('translation links', links.length, manifest.counts?.translation_links);

console.log(`importing ${name}`);
console.log(`  from    ${src}`);
console.log(`  records ${groups.length}, media ${media.length}`);

// ---------- records ----------
// A stale record left behind by a rename would be served forever, so the
// directory is rebuilt rather than merged over.
const recordsDir = path.join(out, 'records');
fs.rmSync(recordsDir, { recursive: true, force: true });

let bytes = 0;
let missing = 0;
const ids = [];

// Only one of the two source pipelines writes a `title` onto the group, but
// both write it onto every version. Taking it from the record while it is
// already open is what keeps an index of human titles rather than of slugs.
const titles = new Map();

// The index rows show a shortened excerpt (2026-08-27); captured here for the
// same reason as the title — the record is already open.
const excerpts = new Map();

// Nine october7 titles are the page's <title> tag verbatim, ending in site
// chrome — "| October7 Blog", "- October7 Blog", "| October7 Nova Fest".
// Only those two known suffixes are stripped, and only at the very end, so a
// dash or pipe inside the testimony's own words survives. This is cleanup of
// the source site's furniture, not editing of the testimony.
const cleanTitle = (value) =>
  value
    ? value.replace(/\s*[|–—-]\s*October7\s+(Blog|Nova\s*Fest)\s*$/i, '').trim() ||
      null
    : null;

for (const group of groups) {
  const id = group.canonical_story_id;
  const file = path.join(src, 'content', 'stories', id, 'story.json');
  if (!fs.existsSync(file)) {
    missing += 1;
    continue;
  }
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  const version = defaultVersion(record);
  titles.set(id, cleanTitle(group.title ?? record.title ?? version?.title ?? null));
  excerpts.set(id, shortExcerpt(version));
  bytes += writeJson(path.join('records', `${id}.json`), record);
  ids.push(id);
}
if (missing) {
  console.error(`  ${missing} records named by story-groups.json have no story.json`);
  process.exit(1);
}

// ---------- index + registries ----------
// The index carries only what a listing page paints, so a route that lists
// records never loads a full record to do it.
const index = groups.map((g) => ({
  id: g.canonical_story_id,
  title: titles.get(g.canonical_story_id) ?? null,
  category: g.category_id ?? null,
  date: g.publication_date ?? null,
  cover: g.cover_media_id ?? null,
  languages: g.available_languages,
  defaultLanguage: g.default_language,
  witness: g.witness_name ?? null,
  excerpt: excerpts.get(g.canonical_story_id) ?? null,
}));

bytes += writeJson('index.json', index);
bytes += writeJson('categories.json', categories);
bytes += writeJson('languages.json', languages);
bytes += writeJson('media.json', media);
bytes += writeJson('translation-links.json', links);

// A record's own file is the source of truth for its content; this manifest
// exists so a later import can be checked against what the site expects.
bytes += writeJson('manifest.json', {
  name,
  importedAt: new Date().toISOString(),
  sourcePackage: manifest.name ?? null,
  sourceSite: manifest.source_site ?? null,
  contract: manifest.contract ?? null,
  defaultLanguage: manifest.default_language ?? index[0]?.defaultLanguage ?? 'en',
  languages: manifest.languages ?? languages.map((l) => l.locale),
  counts: {
    records: ids.length,
    media: media.length,
    translationLinks: links.length,
    categories: categories.length,
  },
  // Lets a reviewer tell two imports apart without diffing 300 files.
  recordsDigest: createHash('sha256').update(ids.sort().join('\n')).digest('hex').slice(0, 16),
});

console.log(`  wrote   ${ids.length} records, ${(bytes / 1024 / 1024).toFixed(1)} MB`);

// ---------- optional: local asset symlink ----------
if (LINK_ASSETS) {
  const publicDir = path.join(REPO, 'public', 'archive');
  fs.mkdirSync(publicDir, { recursive: true });
  const link = path.join(publicDir, name);
  fs.rmSync(link, { recursive: true, force: true });
  fs.symlinkSync(path.join(src, 'assets'), link, 'dir');
  console.log(`  linked  public/archive/${name} -> ${path.join(src, 'assets')}`);
  console.log('          (gitignored; development only — production uses NEXT_PUBLIC_ARCHIVE_CDN)');
}

console.log(`  ok      content-packages/${name}`);
