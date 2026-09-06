import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { PUBLICATION_SECTIONS } from '@/server/contracts/enums';
import { homeSelectionSchema } from '@/server/contracts/homepage';
import { routePublication, SECTIONS_BY_HOMEPAGE_SECTION } from '@/lib/publication-routing';
import { freshDatabase, type TestDatabase } from '@/server/db/testing';
import { publicationService } from '@/server/modules/publications/service';

let db: TestDatabase;
beforeAll(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });

describe('whole-site editorial taxonomy', () => {
  it('routes every category to exactly one canonical destination', () => {
    const grouped = Object.values(SECTIONS_BY_HOMEPAGE_SECTION).flat();
    expect(new Set(grouped).size).toBe(PUBLICATION_SECTIONS.length);
    expect(grouped).toHaveLength(PUBLICATION_SECTIONS.length);
    expect(routePublication('innovation').href).toBe('/people-of-israel');
    expect(routePublication('history_context').homepageKind).toBe('feature');
    expect(routePublication('antisemitism').href).toBe('/fake-resistance');
    expect(routePublication('influence_investigation').homepageSection).toBe('fakeResistance');
    expect(routePublication('news').href).toBe('/geopolitical-brief');
    expect(routePublication('history_context', { historyContext: 'news' }).href).toBe('/geopolitical-brief');
    expect(routePublication('history_context', { historyContext: 'fakeResistance' }).href).toBe('/fake-resistance');
  });

  it('reads existing homepage selections without losing legacy references', () => {
    const selection = { news: [], fakeResistance: [], october7: [], heroes: [], israelsStory: [] };
    expect(homeSelectionSchema.parse(selection)).toEqual({ ...selection, people: [] });
  });

  it('persists new editorial categories without weakening publication protection', async () => {
    const service = publicationService(db);
    for (const section of ['innovation', 'antisemitism', 'history_context'] as const) {
      const record = await service.create({ kind: 'news_update', section, title: section,
        body: 'Sourced editorial draft for integration verification.', language: 'en', topicTags: ['agriculture', 'research-academia'] }, { label: 'test:editorial' });
      expect(record.section).toBe(section);
      expect(record.topicTags).toEqual(['agriculture', 'research-academia']);
      expect(record.status).toBe('draft');
      await expect(db.execute(sql`UPDATE publication SET status='published', published_at=now() WHERE id=${record.id}`)).rejects.toThrow();
    }
  });
});
