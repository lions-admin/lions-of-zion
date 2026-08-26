#!/usr/bin/env node
/**
 * Check that every asset the archive pages reference actually resolves.
 *
 *   node scripts/verify-archive-assets.mjs <base-url> [--all]
 *
 *   node scripts/verify-archive-assets.mjs https://cdn.example.com/archive
 *   node scripts/verify-archive-assets.mjs http://localhost:3000/archive --all
 *
 * Media never enters git, so nothing in the normal gate can tell whether the
 * bucket behind `NEXT_PUBLIC_ARCHIVE_CDN` is actually populated. A page whose
 * images 404 still builds, still passes the tests, and still renders its text —
 * which is exactly the kind of failure that reaches production unnoticed.
 *
 * By default this samples each package; `--all` checks every referenced asset,
 * which is ~1,000 requests and worth doing once after the first upload.
 *
 * Paths are taken from `media.json` and rewritten the same way the renderer
 * rewrites them, so this checks the URLs the site will really request rather
 * than a guess at them.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [, , rawBase, ...flags] = process.argv;
const ALL = flags.includes('--all');
const SAMPLE = 40;
const CONCURRENCY = 12;

if (!rawBase) {
  console.error('usage: verify-archive-assets.mjs <base-url> [--all]');
  process.exit(2);
}
const BASE = rawBase.replace(/\/+$/, '');
const ROOT = path.resolve(import.meta.dirname, '..', 'content-packages');

/** The renderer's rule: the stored path drops its `assets/` prefix. */
const toUrl = (pkg, packagePath) => `${BASE}/${pkg}/${packagePath.replace(/^assets\//, '')}`;

async function collect(pkg) {
  const media = JSON.parse(await readFile(path.join(ROOT, pkg, 'media.json'), 'utf8'));
  const urls = new Set();
  let external = 0;

  for (const item of media) {
    // The two YouTube-hosted videos have no file to serve, by design.
    if (!item.package_path) {
      external += 1;
      continue;
    }
    urls.add(toUrl(pkg, item.package_path));
    for (const variant of item.web_variants ?? []) urls.add(toUrl(pkg, variant.path));
  }
  return { urls: [...urls], external };
}

async function head(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return response.ok ? null : `${response.status} ${url}`;
  } catch (error) {
    return `ERR ${url} — ${error.message}`;
  }
}

/** A fixed stride rather than random, so two runs check the same files. */
function sample(urls, n) {
  if (urls.length <= n) return urls;
  const stride = Math.floor(urls.length / n);
  return Array.from({ length: n }, (_, i) => urls[i * stride]);
}

let failures = [];
let checked = 0;

for (const pkg of ['october7', 'hamas-massacre']) {
  let collected;
  try {
    collected = await collect(pkg);
  } catch {
    console.log(`skip ${pkg} — not imported`);
    continue;
  }

  const targets = ALL ? collected.urls : sample(collected.urls, SAMPLE);
  console.log(
    `${pkg}: ${collected.urls.length} assets referenced` +
      (collected.external ? `, ${collected.external} external (no file, expected)` : '') +
      ` — checking ${targets.length}`,
  );

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(head));
    failures.push(...results.filter(Boolean));
    checked += batch.length;
  }
}

console.log(`\nchecked ${checked}, ${failures.length} unreachable`);
if (failures.length) {
  for (const failure of failures.slice(0, 20)) console.error(`  ${failure}`);
  if (failures.length > 20) console.error(`  … and ${failures.length - 20} more`);
  console.error(
    '\nAssets are missing. Upload assets/originals and assets/web from each\n' +
      'integration package to the bucket, preserving paths under <pkg>/, then\n' +
      're-run. See docs/archive-integration.md.',
  );
  process.exit(1);
}
console.log('All checked assets resolve.');
