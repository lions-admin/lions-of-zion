import { describe, expect, it } from 'vitest';
import { anyWholeSiteUpdatePackageSchema, wholeSiteUpdatePackageSchema } from '@/server/contracts/whole-site-update';

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

  it('accepts cited web pages as sources and refuses anything that is not an http(s) page', () => {
    const cited = { ...valid, creates: [{ ...valid.creates[0], sources: [
      { url: 'https://www.gov.il/en/pages/statement', title: 'Government statement', publisher: 'Government of Israel', official: true },
      { url: 'https://example-news.test/report', title: 'A report' },
    ] }] };
    const parsed = wholeSiteUpdatePackageSchema.parse(cited);
    expect(parsed.creates[0]!.sources).toHaveLength(2);
    expect(parsed.creates[0]!.sources![1]).toMatchObject({ language: 'en' });
    expect(wholeSiteUpdatePackageSchema.safeParse({ ...valid, creates: [{ ...valid.creates[0], sources: [{ url: 'ftp://example.test/x', title: 'No' }] }] }).success).toBe(false);
    expect(wholeSiteUpdatePackageSchema.safeParse({ ...valid, creates: [{ ...valid.creates[0], sources: [{ url: 'https://example.test/x', title: 'No', evidenceId: 'invented' }] }] }).success).toBe(false);
    /* A package written before the field existed still validates. */
    expect(wholeSiteUpdatePackageSchema.safeParse(valid).success).toBe(true);
  });

  /* `whole-site-update-v2`. The two gaps `docs/editorial-dna.md` §12 recorded:
     what the editor researched, and a deliberate decision not to publish. On
     2026-09-07 an editor vetoed three pieces and had only a free-text
     recommendation to say so with, so a veto and a 404'd image arrived as the
     same silence. */
  const v2 = { ...valid, contractVersion: 'whole-site-update-v2' };

  it('records a research ledger and a veto, and keeps them apart from failures', () => {
    const parsed = anyWholeSiteUpdatePackageSchema.parse({
      ...v2,
      research: [{
        topic: 'Southern Lebanon', focus: 'Overnight strikes and the Hezbollah response',
        sourcesReviewed: ['https://www.reuters.com/world/middle-east/example'],
        conclusion: 'Covered by the create below.', outcome: 'published',
      }],
      vetoes: [{
        key: 'thin-claim', candidate: 'A viral casualty figure with one origin',
        reason: 'Every repetition traces to a single anonymous post; nothing independent corroborates it.',
        section: 'narrative_watch', sources: ['https://example-news.test/claim'],
        replacement: 'Published the influence investigation instead.', ownerDecisionRequested: true,
      }],
    });
    expect(parsed.contractVersion).toBe('whole-site-update-v2');
    expect(parsed.contractVersion === 'whole-site-update-v2' && parsed.research?.[0]?.outcome).toBe('published');
    expect(parsed.contractVersion === 'whole-site-update-v2' && parsed.vetoes?.[0]?.ownerDecisionRequested).toBe(true);
  });

  /* A run that researched the day and published nothing has still reported
     something. v1's "a package needs a create, update or homepage decision"
     would have rejected exactly that run. */
  it('accepts a v2 package that only vetoes, and still rejects an empty one', () => {
    expect(anyWholeSiteUpdatePackageSchema.safeParse({
      ...v2, creates: [], homepage: {},
      vetoes: [{ key: 'k', candidate: 'c', reason: 'Not strong enough to publish.' }],
    }).success).toBe(true);
    expect(anyWholeSiteUpdatePackageSchema.safeParse({ ...v2, creates: [], homepage: {} }).success).toBe(false);
  });

  it('bounds the ledger and refuses anything that is not an external address', () => {
    const entry = { topic: 't', conclusion: 'c', outcome: 'no_action' };
    expect(anyWholeSiteUpdatePackageSchema.safeParse({ ...v2, research: Array.from({ length: 26 }, () => entry) }).success).toBe(false);
    expect(anyWholeSiteUpdatePackageSchema.safeParse({ ...v2, research: [{ ...entry, sourcesReviewed: ['not-a-url'] }] }).success).toBe(false);
    expect(anyWholeSiteUpdatePackageSchema.safeParse({ ...v2, research: [{ ...entry, outcome: 'maybe' }] }).success).toBe(false);
    expect(anyWholeSiteUpdatePackageSchema.safeParse({ ...v2, vetoes: [{ key: 'a', candidate: 'c', reason: 'r' }, { key: 'a', candidate: 'd', reason: 'r' }] }).success).toBe(false);
    /* `.strict()` at every level, so an invented field is a refusal rather
       than a value silently dropped on the way to the durable run. */
    expect(anyWholeSiteUpdatePackageSchema.safeParse({ ...v2, vetoes: [{ key: 'a', candidate: 'c', reason: 'r', severity: 'high' }] }).success).toBe(false);
  });

  it('keeps v1 parsing on its own, and refuses to read a v2 package as one', () => {
    expect(wholeSiteUpdatePackageSchema.safeParse(valid).success).toBe(true);
    expect(wholeSiteUpdatePackageSchema.safeParse(v2).success).toBe(false);
    /* And v1 still refuses the new fields, so a v2 package delivered against a
       deployment that predates this contract fails loudly rather than
       publishing with its research and vetoes quietly discarded. */
    expect(wholeSiteUpdatePackageSchema.safeParse({ ...valid, research: [] }).success).toBe(false);
  });

  it('keeps generated media illustrative and disclosed in both package versions', () => {
    const generated = {
      inputUrl: 'https://loz.public.blob.vercel-storage.com/publications/media/generated.png',
      sourceUrl: null,
      alt: 'Original editorial illustration', caption: null, credit: 'Lions of Zion',
      disclosure: 'Editorial illustration — not documentary evidence',
      role: 'editorial-illustration', focalPoint: { x: 50, y: 50 }, sensitivity: 'safe',
      rights: {
        status: 'cleared', basis: 'Generated in-house', reference: 'run test; operation new-story',
        clearedAt: '2026-09-07', surfaces: ['article', 'homepage'],
      },
      generated: true,
    };
    for (const contractVersion of ['whole-site-update-v1', 'whole-site-update-v2'] as const) {
      const pkg = { ...valid, contractVersion, creates: [{ ...valid.creates[0], media: generated }] };
      expect(anyWholeSiteUpdatePackageSchema.safeParse(pkg).success).toBe(true);
      expect(anyWholeSiteUpdatePackageSchema.safeParse({
        ...pkg, creates: [{ ...pkg.creates[0], media: { ...generated, role: 'documentation' } }],
      }).success).toBe(false);
      expect(anyWholeSiteUpdatePackageSchema.safeParse({
        ...pkg, creates: [{ ...pkg.creates[0], media: { ...generated, disclosure: null } }],
      }).success).toBe(false);
    }
  });
});
