import { describe, expect, it } from 'vitest';
import { wholeSiteUpdatePackageSchema } from '@/server/contracts/whole-site-update';

const valid = {
  contractVersion: 'whole-site-update-v1', runId: 'contract-test-run', composer: 'ChatGPT', createdAt: '2026-09-06T10:00:00.000Z',
  creates: [{ key: 'new-story', publication: { kind: 'news_update', section: 'news', title: 'A complete story', body: 'A complete finished story.', language: 'en', canonicalStoryId: 'complete-story' } }],
  updates: [], homepage: { news: { lead: { action: 'set', publication: { operationKey: 'new-story' } } } }, siteRecommendations: ['Keep the homepage hierarchy clear.'],
};

describe('whole-site-update-v1 contract', () => {
  it('accepts a finished create package and an operation homepage reference', () => {
    expect(wholeSiteUpdatePackageSchema.parse(valid).homepage.news?.lead).toMatchObject({ action: 'set' });
  });

  it('requires a target and rejects conflicting homepage references', () => {
    expect(wholeSiteUpdatePackageSchema.safeParse({ ...valid, updates: [{ key: 'update', target: {}, publication: { title: 'Changed', changeSummary: 'Correction' } }] }).success).toBe(false);
    expect(wholeSiteUpdatePackageSchema.safeParse({ ...valid, homepage: { news: { lead: { action: 'set', publication: { operationKey: 'new-story', publicId: 'also-present' } } } } }).success).toBe(false);
  });

  it('rejects an operation reference that does not exist in this package', () => {
    expect(wholeSiteUpdatePackageSchema.safeParse({ ...valid, homepage: { people: { lead: { action: 'set', publication: { operationKey: 'missing' } } } } }).success).toBe(false);
  });
});
