#!/usr/bin/env node
/**
 * Import an October 7 archive integration package into `content-packages/`.
 *
 *   node scripts/import-archive-package.mjs <package-dir> <name> [--link-assets]
 *
 * Both source packages are built to the `october7-integration-package@1`
 * contract and live outside this repository (see `docs/archive-integration.md`).
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

if (!pkgDir || !name) {
  console.error('usage: import-archive-package.mjs <package-dir> <name> [--link-assets]');
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

for (const group of groups) {
  const id = group.canonical_story_id;
  const file = path.join(src, 'content', 'stories', id, 'story.json');
  if (!fs.existsSync(file)) {
    missing += 1;
    continue;
  }
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  const version =
    record.versions?.[record.default_language] ?? Object.values(record.versions ?? {})[0];
  titles.set(id, group.title ?? record.title ?? version?.title ?? null);
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
