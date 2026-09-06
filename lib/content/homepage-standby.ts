import 'server-only';
import catalog from '@/content-packages/homepage/catalog.json';
import {
  homeCatalogSchema,
  israelEditionDate,
  type HomeReference,
  type HomeSectionName,
} from '@/server/contracts/homepage';
import { listBriefingPublications } from '@/lib/publications';
import { homepageDefaultMediaId, homepageMediaMappings } from './homepage-media';

/**
 * Standby membership — what the homepage shows for a section the persisted
 * edition could not fill.
 *
 * This exists because of a failure the site actually shipped with: no cron
 * generates `homepage_edition` in Production (`vercel.json` schedules ingest,
 * embed, outbox-drain and maintenance, and nothing else), so
 * `readHomepageSnapshot()` returned null on every request and all five
 * sections rendered the same sentence — "This selection is temporarily
 * unavailable" — with not one picture on the page. Four of those five
 * sections never needed the database at all: their records are committed
 * under `content-packages/`.
 *
 * So standby is not a second editorial voice and not a cache. It is the same
 * catalogue the edition job selects from, read directly, with membership
 * rotated by edition date so it is stable for a day and does not show the
 * same two records forever. When a real edition exists, none of this runs.
 */
const CATALOG = homeCatalogSchema.parse(catalog);

/** Stable within a day, moving across days, and the same for every reader. */
function dayIndex(editionDate: string): number {
  const parsed = Date.parse(`${editionDate}T00:00:00Z`);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 86_400_000);
}

/** Two per section, the pair `homePairSchema` allows, rotated by the date. */
function rotatePair<T>(rows: T[], editionDate: string): T[] {
  if (rows.length <= 2) return rows;
  const start = dayIndex(editionDate) % rows.length;
  return [rows[start], rows[(start + 1) % rows.length]];
}

function committedRefs(section: HomeSectionName, editionDate: string): HomeReference[] {
  return rotatePair(CATALOG.candidates.filter((c) => c.section === section), editionDate);
}

/** A publication carries whatever picture is mapped to it, and the drawn
 *  cover for its kind when nothing is. It is never dropped for lack of one. */
function publicationRef(
  publicId: string,
  updatedAt: string,
  publishedAt: string,
  kind: 'news' | 'watch',
): HomeReference | null {
  const key = `publication:${publicId}`;
  const mediaId = homepageMediaMappings()[key] ?? homepageDefaultMediaId(kind);
  if (!mediaId) return null;
  return {
    key,
    section: kind === 'watch' ? 'fakeResistance' : 'news',
    kind,
    id: publicId,
    href: `/articles/${publicId}`,
    version: updatedAt,
    date: publishedAt,
    mediaId,
  };
}

async function publishedRefs(
  section: 'daily_brief' | 'israel_update' | 'narrative_watch',
  kind: 'news' | 'watch',
): Promise<HomeReference[]> {
  try {
    const rows = await listBriefingPublications(`section=${section}&limit=8`);
    return rows.flatMap((p) => {
      const ref = publicationRef(p.publicId, p.updatedAt, p.publishedAt, kind);
      return ref ? [ref] : [];
    });
  } catch {
    /* The database is the only thing that can fail here, and a section with
       no committed records is allowed to stay empty. It is not an error the
       reader needs; the section says so itself. */
    return [];
  }
}

/**
 * References for the sections named, in the order the homepage renders them.
 * `news` is the one section with nothing committed behind it, so it is the
 * one that still needs a reachable database.
 */
export async function standbyReferences(
  sections: readonly HomeSectionName[],
  editionDate = israelEditionDate(),
): Promise<Partial<Record<HomeSectionName, HomeReference[]>>> {
  const wanted = new Set(sections);
  const [briefs, updates, watch] = await Promise.all([
    wanted.has('news') ? publishedRefs('daily_brief', 'news') : [],
    wanted.has('news') ? publishedRefs('israel_update', 'news') : [],
    wanted.has('fakeResistance') ? publishedRefs('narrative_watch', 'watch') : [],
  ]);

  const result: Partial<Record<HomeSectionName, HomeReference[]>> = {};
  for (const section of wanted) {
    if (section === 'news') {
      /* One Daily Brief and one Israel update where both exist, rather than
         two of whichever the job happened to publish more of. */
      const pair = [briefs[0], updates[0]].filter((ref): ref is HomeReference => !!ref);
      result.news = pair.length ? pair : [...briefs, ...updates].slice(0, 2);
      continue;
    }
    const committed = committedRefs(section, editionDate);
    result[section] =
      section === 'fakeResistance' ? [...committed, ...watch].slice(0, 2) : committed;
  }
  return result;
}
