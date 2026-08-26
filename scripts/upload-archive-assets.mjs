#!/usr/bin/env node
/**
 * Upload an integration package's media to Vercel Blob.
 *
 *   node scripts/upload-archive-assets.mjs <package-dir> <name> [--dry-run]
 *
 * Roughly 2 GB across ~2,000 files, which shapes every choice here:
 *
 *  - **Concurrent.** `vercel blob put` uploads one file per process; this uses
 *    the SDK so the run is minutes rather than hours.
 *  - **Resumable.** Completed pathnames are appended to a progress file as they
 *    land, so an interrupted run continues instead of starting over.
 *  - **Deterministic pathnames.** `addRandomSuffix: false` — the URL a page
 *    requests is derived from `media_id` through `media.json`, so the object
 *    key must be exactly the package path minus its `assets/` prefix.
 *
 * Auth is the project's OIDC token plus the store id, so no long-lived
 * read-write token is needed or stored. Refresh it with `vercel link`.
 *
 * **This does not touch `BLOB_READ_WRITE_TOKEN`.** That variable already points
 * at a different store used by ingestion; the archive has its own.
 */
import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';

const [, , pkgDir, name, ...flags] = process.argv;
const DRY = flags.includes('--dry-run');
const CONCURRENCY = 8;

if (!pkgDir || !name) {
  console.error('usage: upload-archive-assets.mjs <package-dir> <name> [--dry-run]');
  process.exit(2);
}

const REPO = path.resolve(import.meta.dirname, '..');

/**
 * Values come from `vercel env pull`, which writes `.env.local`. Both are
 * scoped to the archive's own store — deliberately **not** the ingestion
 * store that `BLOB_READ_WRITE_TOKEN` points at.
 */
function fromEnv(name) {
  if (process.env[name]) return process.env[name];
  const envFile = path.join(REPO, '.env.local');
  if (!existsSync(envFile)) return null;
  const match = readFileSync(envFile, 'utf8').match(
    new RegExp(`^${name}="?([^"\\n]+)"?`, 'm'),
  );
  return match?.[1] ?? null;
}

const STORE_ID = (fromEnv('ARCHIVE_BLOB_STORE_ID') ?? '').replace(/^store_/, '');
// An explicit read-write token wins when the connection created one; otherwise
// the project's OIDC token works, but only once the store is connected to the
// project — an unconnected store refuses it with "Access denied".
const RW_TOKEN = fromEnv('ARCHIVE_BLOB_READ_WRITE_TOKEN');
const TOKEN = RW_TOKEN ?? fromEnv('VERCEL_OIDC_TOKEN');

if (!DRY && (!TOKEN || !STORE_ID)) {
  console.error(
    'Missing ARCHIVE_BLOB_STORE_ID or a token. Run `vercel env pull .env.local`,\n' +
      'and check the Blob store is connected to the project.',
  );
  process.exit(1);
}

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.pdf': 'application/pdf',
  '.vtt': 'text/vtt', '.srt': 'application/x-subrip',
};

async function walk(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, base)));
    else if (entry.isFile()) out.push({ full, rel: path.relative(base, full) });
  }
  return out;
}

const assetsRoot = path.join(path.resolve(pkgDir), 'assets');
const files = await walk(assetsRoot);
if (!files.length) {
  console.error(`no files under ${assetsRoot}`);
  process.exit(1);
}

const totalBytes = files.reduce((sum, f) => sum + statSync(f.full).size, 0);
console.log(`${name}: ${files.length} files, ${(totalBytes / 1024 ** 3).toFixed(2)} GB`);
console.log(`  store   ${STORE_ID}`);

// Progress is a plain append-only list of finished pathnames, so a killed run
// resumes exactly where it stopped without re-reading the store.
const progressFile = path.join(REPO, '.blob-upload', `${name}.done`);
const done = new Set(
  existsSync(progressFile) ? readFileSync(progressFile, 'utf8').split('\n').filter(Boolean) : [],
);
if (done.size) console.log(`  resume  ${done.size} already uploaded`);

const pending = files.filter((f) => !done.has(f.rel.split(path.sep).join('/')));
console.log(`  todo    ${pending.length}`);

if (DRY) {
  for (const f of pending.slice(0, 5)) {
    console.log(`  would put ${name}/${f.rel.split(path.sep).join('/')}`);
  }
  console.log(`  (dry run — nothing uploaded)`);
  process.exit(0);
}

mkdirSync(path.dirname(progressFile), { recursive: true });

let uploaded = 0;
let failed = 0;
let bytes = 0;
const started = Date.now();

async function uploadOne(file) {
  const key = file.rel.split(path.sep).join('/');
  const pathname = `${name}/${key}`;
  const ext = path.extname(file.full).toLowerCase();
  try {
    await put(pathname, createReadStream(file.full), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
      ...(RW_TOKEN ? { token: RW_TOKEN } : { oidcToken: TOKEN, storeId: STORE_ID }),
    });
    appendFileSync(progressFile, `${key}\n`);
    uploaded += 1;
    bytes += statSync(file.full).size;
  } catch (error) {
    failed += 1;
    if (failed <= 5) console.error(`  FAIL ${pathname}: ${error.message}`);
  }
  const seen = uploaded + failed;
  if (seen % 100 === 0 || seen === pending.length) {
    const mins = (Date.now() - started) / 60000;
    console.log(
      `  ${seen}/${pending.length}  ${(bytes / 1024 ** 2).toFixed(0)} MB  ` +
        `${mins.toFixed(1)} min` + (failed ? `  ${failed} failed` : ''),
    );
  }
}

const queue = [...pending];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (next) await uploadOne(next);
    }
  }),
);

console.log(`\n${name}: ${uploaded} uploaded, ${failed} failed`);
process.exit(failed ? 1 : 0);
