import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HomepageEdition } from '@/server/contracts/homepage';
import media from '@/content-packages/homepage/media.json';
import { editorialMediaSchema } from '@/server/contracts/editorial-media';
import { HomeNarrativesSection } from '@/components/home/HomeNarrativesSection';

const asset = editorialMediaSchema.parse(media.assets[0]);
const base = {
  key: 'fake:a',
  title: 'A full headline',
  href: '/articles/a',
  date: '2026-09-07T09:00:00Z',
  summary: 'Published summary.',
  sources: [{ label: 'Source', url: 'https://example.com/source' }],
  whyItMatters: undefined,
};

function render(items: HomepageEdition['fakeResistance']['items']) {
  return renderToStaticMarkup(
    <HomeNarrativesSection section={{ state: 'ready', gaps: [], items }} />,
  );
}

describe('Fake Resistance homepage regression coverage', () => {
  it('preserves the investigation media layout when media exists', () => {
    const html = render([{ ...base, media: asset, kind: 'case', sourceCount: 2, confidence: 'High' }]);
    expect(html).toContain('data-kind="case"');
    expect(html).toContain('data-has-media="true"');
    expect(html).toContain('<figure');
    expect(html).toContain('Research case');
    expect(html).toContain('Open the investigation');
  });

  it('renders an investigation without media as intentional text-led content', () => {
    const html = render([{ ...base, media: null, kind: 'case', sourceCount: 2, confidence: 'High' }]);
    expect(html).toContain('data-has-media="false"');
    expect(html).not.toContain('<figure');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('dossierCover');
    expect(html).toContain('Open the investigation');
  });

  it('renders Narrative Watch correctly with and without media', () => {
    const html = render([
      {
        ...base,
        key: 'watch:media',
        media: asset,
        kind: 'watch',
        claim: 'Claim with documentary media',
        verification: 'misleading',
        basis: 'sourced',
      },
      {
        ...base,
        key: 'watch:text',
        media: null,
        kind: 'watch',
        claim: 'Claim without media',
        verification: 'unresolved',
        basis: 'analysis',
      },
    ]);
    expect(html).toContain('Claim with documentary media');
    expect(html).toContain('Claim without media');
    /* VA-63. The verb used to vary with `evidenceBasis` — "Read the analysis"
       for an unsourced record, "Read the assessment" for a sourced one. It is
       one verb per *content type* now, because the basis is not the type and is
       already disclosed in its own line directly above the link. Both records
       are claim assessments, so both are read as assessments; what separates
       them is still visible, and still exact. */
    expect(html.match(/Read the assessment/g)).toHaveLength(2);
    expect(html).toContain('Lions of Zion editorial analysis');
    expect(html).toContain('No source-backed finding is implied');
    expect(html.match(/data-kind="watch"/g)).toHaveLength(2);
  });

  it('renders ordinary antisemitism reporting as an article, never a research case', () => {
    const html = render([
      { ...base, media: null, kind: 'article', label: 'Antisemitism' },
    ]);
    expect(html).toContain('Antisemitism');
    expect(html).toContain('Published summary.');
    expect(html).toContain('Read the record');
    expect(html).not.toContain('Research case');
    expect(html).not.toContain('Research question');
    expect(html).not.toContain('Open the investigation');
  });

  it('does not duplicate a headline as a research question', () => {
    const html = render([
      {
        ...base,
        media: null,
        kind: 'case',
        question: base.title,
        sourceCount: 2,
        confidence: 'High',
      },
    ]);
    expect(html.match(/A full headline/g)).toHaveLength(1);
    expect(html).not.toContain('Research question');
  });

  it('shows a distinct research question when a real one exists', () => {
    const html = render([
      {
        ...base,
        media: null,
        kind: 'case',
        question: 'How did the synthetic clip spread as documentation?',
        sourceCount: 2,
        confidence: 'High',
      },
    ]);
    expect(html).toContain('Research question');
    expect(html).toContain('How did the synthetic clip spread as documentation?');
    expect(html.match(/A full headline/g)).toHaveLength(1);
  });
});
