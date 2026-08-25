import { ContentCard } from 'lions-of-zion';

/** Ported from `app/support-us/page.tsx` — the volunteer intake grid. */
export function CardGrid() {
  return (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit,minmax(15rem,1fr))' }}>
      <ContentCard eyebrow="Investigate" title="Open-source investigation">
        Geolocation, chronolocation, archive work, and network analysis of coordinated campaigns.
      </ContentCard>
      <ContentCard eyebrow="Translate" title="Languages">
        Reading and translating primary material across the languages of the region and of the
        networks that target it.
      </ContentCard>
      <ContentCard eyebrow="Build" title="Design and development">
        The tools that make verified material fast to check and easy to carry.
      </ContentCard>
    </div>
  );
}

/** `accent="ember"` is the hostile register — used for Fake Resistance case files. */
export function EmberCaseFile() {
  return (
    <ContentCard
      eyebrow="Case file 01"
      title="Gameplay footage sold as combat video"
      accent="ember"
      meta="8 Oct 2023 · TikTok, X"
      footer="Verdict: manipulated — the source game was identified within 48 hours."
    >
      Clips recorded from Arma 3, a military simulation released a decade before the war, were
      captioned as real footage of the fighting. One flagged post drew more than 3 million views.
    </ContentCard>
  );
}

/** With `href`, the whole card becomes the hit area. */
export function Linked() {
  return (
    <ContentCard eyebrow="Reference brief 001" title="Israel’s eastern border" href="/geopolitical-brief">
      Official records describe a planned multi-layer barrier of roughly 500 kilometres. A June
      parliamentary review said 80 kilometres had been funded at that point.
    </ContentCard>
  );
}
