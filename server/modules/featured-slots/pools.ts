import 'server-only';
import { getTestimonyIndex } from '@/lib/content/testimonies';
import { getDocumentationIndex } from '@/lib/content/documentation';
import { getOurHeroesEdition } from '@/lib/content/our-heroes';
import { getIsraelsStoryEdition } from '@/lib/content/israels-story';
import type { FeaturedSlotName, SlotCandidate } from '@/server/contracts/featured-slots';

export type SlotPools = Record<FeaturedSlotName, SlotCandidate[]>;

/** English, titled records only — the same filter `previewSelection()` in
 * `app/october-7/page.tsx` already applies, so a slot pick is always a
 * record the page can actually show without a language fallback. */
const eligible = <T extends { defaultLanguage: string; title: string | null }>(entries: T[]) =>
  entries.filter((e) => e.defaultLanguage === 'en' && Boolean(e.title?.trim()));

/**
 * The candidate pool for every featured slot, read fresh on each refresh.
 * Nothing here is cached: `refresh()` runs only from the editorial ingest,
 * the maintenance tick, or the manual homepage cron route — never a page
 * GET — so a static-file read per pass is cheap and always current.
 */
export async function buildSlotPools(): Promise<SlotPools> {
  const [testimonies, documentation, heroes, story] = await Promise.all([
    getTestimonyIndex(),
    getDocumentationIndex(),
    getOurHeroesEdition(),
    getIsraelsStoryEdition(),
  ]);

  const heroProfiles = [heroes.featured, ...heroes.profiles];
  const chapters = story.chapters;

  return {
    'october7.testimony': eligible(testimonies).map((e) => ({
      key: `archive:october7:${e.id}`,
      person: e.witness ?? undefined,
    })),
    'october7.documentation': eligible(documentation).map((e) => ({
      key: `archive:hamas-massacre:${e.id}`,
    })),
    'heroes.courage': heroProfiles
      .filter((h) => h.role === 'Rescuer' || h.role === 'Fighter')
      .map((h) => ({ key: `hero:${h.id}`, person: h.id })),
    'heroes.fallen': heroProfiles
      .filter((h) => h.role === 'Fallen')
      .map((h) => ({ key: `hero:${h.id}`, person: h.id })),
    'history.primary': chapters.map((c) => ({ key: `chapter:${c.id}`, person: c.id })),
    'history.secondary': chapters.map((c) => ({ key: `chapter:${c.id}`, person: c.id })),
  };
}
