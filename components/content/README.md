# components/content

Shared content-presentation components for the eight section pages, the
Geopolitical Brief, and the home front page.

**Styling comes from the V3 tokens in `app/globals.css`**, not from
hard-coded values — three faces (`--face-display` Newsreader, `--face-text`
IBM Plex Sans, `--face-data` JetBrains Mono), eight size steps each with its
own line-height, weight and tracking, and a palette of inks, gold, surfaces,
lines and two data ramps. `content.module.css` contains no literal colour,
size, radius or duration; every value is a token or a `color-mix()` of
tokens. Read `app/globals.css` before touching any of it.

The three canonical treatments live here and nowhere else — `kicker`
(`--face-data`, `--t-data`, 500, uppercase, gold), `dateStamp` (`--face-data`,
`--t-data`, `--ink-lo`, tabular figures) and `entryTitle` (`--face-display`,
`--t-h3` with its weight, line-height and tracking). Page modules `composes:`
them rather than restating them.

> Cinzel is **retired from every reading surface** and belongs to the home
> particle scene only. Reintroducing it here reverses a documented decision
> (`.ai/DECISIONS.md`, "Cinzel is retired from every reading surface").

## The evidence margin

Above 1220px, each record's citation moves into the right margin beside it.
That placement is **a grid, never absolute positioning** — `marginNote` in
`content.module.css` makes the record's host a two-track grid whose second
track is zero-wide, so a citation taller than its record lengthens its own row
instead of overrunning the next one.

**A host therefore needs its record and its sources as *sibling* elements.**
`Timeline` does this with `.timelineMain` beside `.timelineSources`; the same
pattern is `.dispatchMain` and `.caseFileMain` elsewhere. The citation stays
inside its entry in the markup, which is what keeps reading order, screen
readers and the no-JS page correct.

Cards in a multi-column grid opt out — see Our Heroes.

Import everything from the barrel:

```tsx
import { VerificationBadge, Timeline, SourceList } from '@/components/content';
```

All components are server-compatible **except `SensitiveContent`**, which is a
client component (`'use client'`). All are responsive: multi-column layouts
stack under 719px and nothing overflows horizontally at 320px.

Assessment types come from the contracts layer — the only part of `server/`
that `components/**` may import (ESLint enforces this):

```tsx
import type { AssessmentValue, ConfidenceSummary } from '@/server/contracts/enums';
```

The nine `AssessmentValue`s are: `false`, `misleading`, `manipulated`,
`out_of_context`, `unsupported`, `unverified`, `contested`, `satire`,
`verified`. `ConfidenceSummary` is `high | medium | limited`. The shape of a
published item as the API returns it is `PublishedItemView` from
`@/server/contracts/item`.

---

## VerificationBadge

A short sentence-case phrase at caption size in the interface face, with a
status dot — not a pill, not tracked capitals. One exhaustive visual mapping
for all nine assessment values, drawn from the two data ramps: gold for
`verified`; the ember ramp's peak for `false`/`misleading`/`manipulated` and
one step down for `out_of_context`/`contested`; the neutral data ramp for
`unverified`/`unsupported`; plain ink with a dashed dot for `satire`. Carries
a `title` and `aria-label` explaining the verdict.

```ts
type VerificationBadgeProps = {
  assessment: AssessmentValue;        // required, one of the nine values
  confidence?: ConfidenceSummary;     // 'high' | 'medium' | 'limited'
};
```

```tsx
<VerificationBadge assessment="misleading" confidence="high" />
```

## SourceList

Numbered mono source stack (`01`, `02`, …) with external links opening in a
new tab, optional kind label, access date, and archive link. Renders nothing
for an empty array.

```ts
type Source = {
  id: string;          // stable key
  label: string;       // display text / link text
  kind?: string;       // e.g. 'Official record', 'Telegram post'
  url?: string;        // if absent, label renders as plain text
  accessedAt?: string; // human-readable date, rendered as 'Accessed …'
  archiveUrl?: string; // renders an extra 'Archived copy' link
};
type SourceListProps = { sources: Source[] };
```

```tsx
<SourceList sources={[{ id: 'un-1', label: 'UN Security Council briefing', kind: 'Official record', url: 'https://…', accessedAt: '12 Aug 2026' }]} />
```

## PublicationMeta

Publication facts as a `<dl>` (the brief's meta block). Only the props you
pass are rendered, in the order Edition, Published, Updated, Reviewed by,
Source stack. Renders nothing if all props are absent.

```ts
type PublicationMetaProps = {
  publishedAt?: string;  // human-readable date
  updatedAt?: string;
  reviewedBy?: string;
  sourceCount?: number;  // rendered as 'N sources'
  edition?: string;      // e.g. 'Edition 04 · August 2026'
};
```

```tsx
<PublicationMeta publishedAt="19 Aug 2026" reviewedBy="Second reviewer" sourceCount={14} />
```

## KnownUnknownPanel

The brief's two-column honesty grid: "Not established" on the left, "What
would change the assessment" on the right. Omitting `wouldChange` (or passing
an empty array) collapses it to a single column.

```ts
type KnownUnknownPanelProps = {
  unknowns: string[];       // bullet items under 'Not established'
  wouldChange?: string[];   // bullet items under 'What would change the assessment'
};
```

```tsx
<KnownUnknownPanel unknowns={['Attribution of the strike']} wouldChange={['Independent imagery of the launch site']} />
```

## CorrectionHistory

Correction log with date, optional version stamp, and note per row. An empty
array renders the honest empty state "None recorded" — never hide this
component to fake a clean record.

```ts
type Correction = { date: string; note: string; version?: string };
type CorrectionHistoryProps = { corrections: Correction[] };
```

```tsx
<CorrectionHistory corrections={[{ date: '14 Aug 2026', version: 'v1.1', note: 'Corrected the casualty figure sourcing.' }]} />
```

## FigureRow

The stat-tiles band: large display value over a small muted label, three
columns (stacking to one below 360px). Renders nothing for an empty array.

```ts
type Figure = { value: string; label: string };
type FigureRowProps = { figures: Figure[] };
```

```tsx
<FigureRow figures={[{ value: '1,200+', label: 'people murdered on October 7' }]} />
```

## Timeline

Vertical timeline with a rail and dot markers. Each entry is an `<li>` whose
DOM `id` is `entry.id`, so `/#entry-id` deep links work. Shows a
`VerificationBadge` when `assessment` is set and an inline `SourceList` when
`sources` is set. The record and its sources are siblings — see
[the evidence margin](#the-evidence-margin).

Variants: `'feed'` (default; blue rail, roomy — news feeds), `'history'`
(gold rail, tighter spacing — historical arcs), `'spread'` (hostile ember rail,
diamond markers — claim propagation). All three share one date style; the
`history` variant used to reset it and no longer does.

```ts
type TimelineEntry = {
  id: string;            // becomes the <li> DOM id (anchor target)
  datetime: string;      // machine value for <time dateTime>, e.g. '2023-10-07'
  dateLabel: string;     // what the reader sees, e.g. '7 Oct 2023'
  title: string;
  body: React.ReactNode;
  region?: string;       // small mono tag
  category?: string;     // small mono tag
  assessment?: AssessmentValue;
  sources?: Source[];    // same Source type as SourceList
};
type TimelineProps = { entries: TimelineEntry[]; variant?: 'feed' | 'history' | 'spread' };
```

```tsx
<Timeline variant="history" entries={[{ id: 'balfour-1917', datetime: '1917-11-02', dateLabel: 'November 1917', title: 'The Balfour Declaration', body: <p>…</p> }]} />
```

## ContentCard

Flexible card primitive for case files and profiles: eyebrow, display title,
optional meta line, body, optional ruled footer. `accent` colors the left
border and eyebrow (`'gold'` default, `'ember'` for hostile subjects). When
`href` is set the title becomes a link whose hit area covers the whole card.

```ts
type ContentCardProps = {
  eyebrow?: string;            // mono caps kicker
  title: string;
  meta?: React.ReactNode;      // mono caps meta line under the title
  children: React.ReactNode;   // card body
  footer?: React.ReactNode;    // ruled-off footer strip
  accent?: 'gold' | 'ember';   // default 'gold'
  href?: string;               // makes the whole card a link
};
```

```tsx
<ContentCard eyebrow="Case file 03" title="The hospital car park" accent="ember" href="/fake-resistance#case-03"><p>…</p></ContentCard>
```

## ClaimRecordPair

Two-column claim-versus-record card: the claim in the ember register on the
left, the record in gold/blue on the right; stacks vertically under 719px.

```ts
type ClaimRecordPairProps = {
  claim: React.ReactNode;
  record: React.ReactNode;
  claimLabel?: string;   // default 'The claim'
  recordLabel?: string;  // default 'The record'
};
```

```tsx
<ClaimRecordPair claim={<p>"The convoy was struck deliberately."</p>} record={<p>Flight data and imagery place the strike 400m away.</p>} />
```

## SensitiveContent (client component)

Difficult material behind an explicit reveal: a calm warning panel with a
"View — contains difficult material" button (`aria-expanded`/`aria-controls`
wired), and a "Hide this material" un-reveal control once open. Deliberately
remembers nothing between visits. Its children are part of the client bundle —
keep them serializable (plain JSX/strings), and do not put another interactive
boundary inside without reason.

```ts
type SensitiveContentProps = {
  warning: string;             // shown before reveal, under a 'Sensitive material' kicker
  children: React.ReactNode;   // revealed content
};
```

```tsx
<SensitiveContent warning="Survivor testimony describing the attack on Kfar Aza."><p>…</p></SensitiveContent>
```

## Research components (Fake Resistance)

Five components serve the research pages under `/fake-resistance`. The rule
they share: **the research's own grades are rendered as labels, never as
verdicts.**

- `RosterTable` — who is in a case, with each entity's identity status.
  Scrolls inside its own box rather than widening the reading measure.
- `ConfidenceChip` / `EvidenceClassChip` (`EvidenceGrade.tsx`) — deliberately
  *not* `VerificationBadge`. A verdict says what the record shows about a
  claim; a confidence grade says how well the research knows its own finding.
  Rendering either through the verdict badge would let "we are fairly sure"
  read as "this is verified". For the same reason they render as plain data
  labels — no border, no fill, no pill — and the `gradeChip`/`identityChip`
  class names survive from the chip era only so page modules keep working.
- `TechniqueChip` / `TechniqueChips` — link an exhibit to the playbook chapter
  that explains the technique it documents. The vocabulary lives in
  `lib/content/fake-resistance-playbook.ts` and is pinned by
  `tests/fake-resistance-research.test.ts`.
- `ResearchText` — renders the light inline markup the reports are written in
  (`**bold**`, `*italic*`, `` `@handle` ``) by splitting into React nodes.
  Never `dangerouslySetInnerHTML`. Use it for imported report *prose*; the
  cleared `publication_wording` fields are plain and render directly, which a
  test enforces.
- `NetworkFigure` — inline SVG computed at build time. It plots the finding
  (seven sparsely-bridged communities) rather than the raw edge list, because
  a node-link hairball of ~30 accounts would say the opposite of what the
  research found.
