import { SourceList } from 'lions-of-zion';

/**
 * Real sources from `lib/content/war-update.ts` — the October 2025 ceasefire
 * edition. Kept verbatim rather than invented: the numbered mono stack only
 * reads correctly against real outlet names and real headline lengths.
 */

export function SourceStack() {
  return (
    <SourceList
      sources={[
        {
          id: 'aj-plan-announced',
          label: 'Trump announces Israel-Hamas ceasefire deal: What we know and what’s next',
          kind: 'Al Jazeera',
          url: 'https://www.aljazeera.com/news/2025/10/9/trump-announces-gaza-ceasefire-deal-what-we-know-and-whats-next',
          accessedAt: '25 Aug 2026',
        },
        {
          id: 'toi-full-text',
          label:
            'Full text of Oct. 9 Israel-Hamas deal on Trump’s plan for ‘comprehensive end’ to Gaza war',
          kind: 'The Times of Israel',
          url: 'https://www.timesofisrael.com/full-text-of-oct-9-israel-hamas-deal-on-trumps-plan-for-comprehensive-end-to-gaza-war/',
          accessedAt: '25 Aug 2026',
        },
        {
          id: 'npr-next-steps',
          label: 'Once the Gaza ceasefire goes into effect, what happens next? Here’s what to know',
          kind: 'NPR',
          url: 'https://www.npr.org/2025/10/09/g-s1-92729/gaza-ceasefire-israel-hamas-next-steps',
          accessedAt: '25 Aug 2026',
        },
      ]}
    />
  );
}

/** A source with no live URL still renders — and an archived copy is offered. */
export function WithArchiveAndPlainEntry() {
  return (
    <SourceList
      sources={[
        {
          id: 'adl-timeline',
          label: 'The October 7th War: A Timeline of Key Events and Issues',
          kind: 'ADL',
          url: 'https://www.adl.org/resources/backgrounder/october-7th-war-timeline-key-events-and-issues',
          accessedAt: '25 Aug 2026',
          archiveUrl: 'https://web.archive.org/web/2026/https://www.adl.org/',
        },
        {
          id: 'internal-note',
          label: 'Editorial desk note — figure withheld pending a second source',
          kind: 'Internal record',
        },
      ]}
    />
  );
}
