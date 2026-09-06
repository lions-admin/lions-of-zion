/**
 * Fetch the missing homepage photographs from Wikimedia Commons.
 *
 * Six records carry no picture, so `build-catalog.ts` cannot make them
 * candidates and the homepage never shows them:
 *
 *   hero:aner-shapira · chapter:six-day-war · chapter:yom-kippur-war
 *   chapter:oslo-accords · chapter:jordan-treaty · chapter:abraham-accords
 *
 * `curate-initial-media.mjs` did this once for the six that do have one, but
 * it hard-coded the file, the credit and the licence. This does not: it asks
 * Commons for each candidate, reads the licence out of the API's own
 * `extmetadata`, and **refuses to write an asset whose licence is not on the
 * free list**. A rights line on this site is a claim the reader is invited to
 * check, so it is copied from the source or the record stays without a
 * picture.
 *
 * Usage:
 *   npm run homepage:media:fetch                     # try the candidates below
 *   npm run homepage:media:fetch -- --dry-run        # resolve and report only
 *   npm run homepage:media:fetch -- --set chapter:oslo-accords="File:X.jpg"
 *
 * Then `npm run homepage:catalog`, because `catalogSourceRevision()` hashes
 * `media.json` and a stale catalogue makes `ensureHomepageEdition` throw.
 *
 * Network: this needs `commons.wikimedia.org` and `upload.wikimedia.org`.
 * Where egress is closed to them the script says which host was refused and
 * writes nothing.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

type Target = {
  key: string;
  id: string;
  role: 'portrait' | 'archival-context';
  /** Portraits are cropped 3:4; everything else is a 16:10 plate. */
  portrait?: boolean;
  caption: string;
  /** Tried in order. The first that exists and is freely licensed wins. */
  candidates: string[];
};

const TARGETS: Target[] = [
  { key: 'hero:aner-shapira', id: 'aner-shapira', role: 'portrait', portrait: true,
    caption: 'Aner Elyakim Shapira.',
    candidates: ['File:Aner Shapira.jpg', 'File:Aner Elkayam Shapira.jpg'] },
  { key: 'chapter:six-day-war', id: 'six-day-war', role: 'archival-context',
    caption: 'Archive context: the Six-Day War, June 1967.',
    candidates: ['File:Six Day War.jpg', 'File:1967 Six Day War - conquest of Old City.jpg',
                 'File:Israeli tanks advancing on the Golan Heights. June 10, 1967.jpg'] },
  { key: 'chapter:yom-kippur-war', id: 'yom-kippur-war', role: 'archival-context',
    caption: 'Archive context: the Yom Kippur War, October 1973.',
    candidates: ['File:Yom Kippur War.jpg', 'File:Israeli tanks crossing the Suez Canal 1973.jpg',
                 'File:Egyptian forces crossing the Suez Canal on October 7, 1973.jpg'] },
  { key: 'chapter:oslo-accords', id: 'oslo-accords', role: 'archival-context',
    caption: 'Archive context: the Oslo Accords signing, Washington, September 1993.',
    candidates: ['File:Bill Clinton, Yitzhak Rabin, Yasser Arafat at the White House 1993-09-13.jpg',
                 'File:Rabin, Clinton, Arafat at the White House 1993.jpg'] },
  { key: 'chapter:jordan-treaty', id: 'jordan-treaty', role: 'archival-context',
    caption: 'Archive context: the Israel–Jordan peace treaty, Arava, October 1994.',
    candidates: ['File:Israel-Jordan peace treaty.jpg',
                 'File:Hussein of Jordan, Yitzhak Rabin and Bill Clinton 1994.jpg'] },
  { key: 'chapter:abraham-accords', id: 'abraham-accords', role: 'archival-context',
    caption: 'Archive context: the Abraham Accords signing, Washington, September 2020.',
    candidates: ['File:Abraham Accords signing ceremony.jpg',
                 'File:The Abraham Accords Signing Ceremony (50347816323).jpg'] },
];

/** A licence not on this list is a reason to skip the file, never to guess. */
const FREE = [
  /^public domain/i, /^pd[- ]/i, /^cc0/i,
  /^cc by(-sa)?[- ]?(1\.0|2\.0|2\.5|3\.0|4\.0)/i,
  /^attribution/i,
];
const isFree = (licence: string) => FREE.some((r) => r.test(licence.trim()));

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'LionsOfZion-homepage-media/1.0 (https://lionsofzion.io; ADMIN@lionsofzion.io)';
const text = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

type Resolved = { title: string; url: string; credit: string; licence: string; licenceUrl: string; descriptionUrl: string };

async function resolveCandidate(title: string): Promise<Resolved | null> {
  const query = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo',
    iiprop: 'url|extmetadata|size', titles: title,
  });
  const response = await fetch(`${API}?${query}`, { headers: { 'user-agent': UA } });
  if (!response.ok) throw new Error(`Commons answered ${response.status} for ${title}`);
  const body = await response.json() as { query?: { pages?: { missing?: boolean; imageinfo?: {
    url: string; descriptionurl: string; extmetadata?: Record<string, { value: string }>;
  }[] }[] } };
  const page = body.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (page?.missing || !info) return null;
  const meta = info.extmetadata ?? {};
  const licence = text(meta.LicenseShortName?.value ?? '');
  if (!licence || !isFree(licence)) {
    console.warn(`  skip ${title}: licence "${licence || 'unstated'}" is not on the free list`);
    return null;
  }
  return {
    title, url: info.url, licence,
    credit: text(meta.Artist?.value ?? '') || 'Wikimedia Commons',
    licenceUrl: text(meta.LicenseUrl?.value ?? '') || info.descriptionurl,
    descriptionUrl: info.descriptionurl,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  /* `--set key=value` arrives as two argv entries once npm has split it, and
     `--set=key=value` as one. Both, or the flag silently does nothing. */
  const overrides = new Map<string, string>();
  args.forEach((arg, i) => {
    const pair = arg === '--set' ? args[i + 1] : /^--set=(.+)$/.exec(arg)?.[1];
    const split = pair?.indexOf('=') ?? -1;
    if (pair && split > 0) overrides.set(pair.slice(0, split), pair.slice(split + 1));
  });

  const registryPath = join(process.cwd(), 'content-packages/homepage/media.json');
  const registry = JSON.parse(await readFile(registryPath, 'utf8')) as {
    assets: Record<string, unknown>[]; mappings: Record<string, string>; defaults: Record<string, string>;
  };

  let written = 0;
  for (const target of TARGETS) {
    const candidates = overrides.has(target.key) ? [overrides.get(target.key)!] : target.candidates;
    console.log(`\n${target.key}`);
    let resolved: Resolved | null = null;
    for (const candidate of candidates) {
      try { resolved = await resolveCandidate(candidate); } catch (cause) {
        console.error(`  ${candidate}: ${(cause as Error).message}`);
        continue;
      }
      if (resolved) break;
      console.log(`  ${candidate}: no free file under that title`);
    }
    if (!resolved) { console.log('  → left without a picture, deliberately'); continue; }

    console.log(`  → ${resolved.title} · ${resolved.licence} · ${resolved.credit}`);
    if (dryRun) continue;

    const bytes = Buffer.from(await (await fetch(resolved.url, { headers: { 'user-agent': UA } })).arrayBuffer());
    const pipeline = sharp(bytes).resize(
      target.portrait ? { width: 1200, height: 1600, fit: 'cover', position: 'top' }
                      : { width: 1600, height: 1000, fit: 'cover' },
    ).webp({ quality: 82 });
    const out = `public/images/homepage/${target.id}.webp`;
    const { width, height } = await pipeline.toFile(join(process.cwd(), out));

    registry.assets = registry.assets.filter((a) => a.id !== target.id);
    registry.assets.push({
      id: target.id, src: `/images/${out.replace('public/images/', '')}`, width, height,
      alt: target.caption, credit: `${resolved.credit} · resized WebP`, caption: target.caption,
      sourceUrl: resolved.descriptionUrl, role: target.role,
      focalPoint: { x: 50, y: target.portrait ? 30 : 40 }, sensitivity: 'safe',
      rights: {
        status: 'cleared', basis: resolved.licence, reference: resolved.licenceUrl,
        clearedAt: new Date().toISOString().slice(0, 10), surfaces: ['homepage'],
      },
    });
    registry.mappings[target.key] = target.id;
    written += 1;
  }

  if (!written) { console.log('\nNothing written.'); return; }
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`\n${written} asset(s) written. Now run: npm run homepage:catalog`);
}

main().catch((cause) => {
  const message = (cause as Error).message ?? String(cause);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|403/.test(message)) {
    console.error(`\nCommons is not reachable from here (${message}).`);
    console.error('Open egress to commons.wikimedia.org and upload.wikimedia.org, then re-run.');
    process.exitCode = 2;
    return;
  }
  console.error(cause);
  process.exitCode = 1;
});
