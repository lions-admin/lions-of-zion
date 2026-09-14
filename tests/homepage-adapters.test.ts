import { describe, it, expect } from 'vitest';
import { resolveHomepageReference } from '@/lib/content/homepage-adapters';
import type { HomeReference } from '@/server/contracts/homepage';

/**
 * Regression: widening `build-catalog.ts` to admit a static candidate with
 * `mediaId: null` (2026-09-14, so the featured-slots rotation pool is not
 * starved to the handful of records someone curated a cover for) is only
 * half the fix. `selectHomepage()` can choose such a candidate, but until
 * this fix `resolveHomepageReference` still returned `null` for any hero or
 * chapter with no cleared image — silently dropping a record the selector
 * had just picked, as a "gap" rather than a text-led card. Caught by a live
 * dev-server check, not by an existing test; this pins it.
 */
const ref = (overrides: Partial<HomeReference>): HomeReference => ({
  key: 'hero:youssef-ziadna', id: 'youssef-ziadna', kind: 'hero', section: 'heroes',
  href: '/our-heroes#youssef-ziadna', version: '1', date: '2026-09-14', mediaId: null,
  ...overrides,
});

describe('resolveHomepageReference — a missing image is not a reason to drop a static record', () => {
  it('resolves a hero with no cleared image text-led, not as null', async () => {
    const preview = await resolveHomepageReference(ref({}));
    expect(preview).not.toBeNull();
    expect(preview?.media).toBeNull();
    expect(preview?.kind).toBe('hero');
    if (preview && 'title' in preview) expect(preview.title).toBe('Youssef Ziadna');
  });

  it('resolves a second media-less hero (Amit Mann, added in the same content refresh) the same way', async () => {
    const preview = await resolveHomepageReference(ref({ key: 'hero:amit-mann', id: 'amit-mann' }));
    expect(preview).not.toBeNull();
    expect(preview?.media).toBeNull();
  });

  it('still resolves a hero with a cleared image to that image', async () => {
    const preview = await resolveHomepageReference(ref({
      key: 'hero:rami-davidian', id: 'rami-davidian',
    }));
    expect(preview?.media).not.toBeNull();
  });

  it('still returns null for a hero id that does not exist in the edition', async () => {
    const preview = await resolveHomepageReference(ref({ key: 'hero:no-such-person', id: 'no-such-person' }));
    expect(preview).toBeNull();
  });
});
