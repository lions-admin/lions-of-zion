# Public interaction contract

## Canonical owners

- Tokens and font roles: `app/globals.css`; visual direction follows the owner's current request and rendered UI.
- Actions, inputs and overlays: `components/ui/Button`, `Field`, `Dialog`.
  Extend these owners rather than adding duplicate local primitives.
- Public search: `components/search/SearchPanel.tsx` and `useSearch.ts`.
- Archive filters and URL state: `components/archive/ArchiveIndex.tsx`.
- Public account providers: `components/auth/PublicAuthControl.tsx`.
- Reports, volunteering and donation navigation: `components/support/`.
- Ask launcher and conversation: `components/ask/`.

## Required behavior

- Search is debounced; composition must finish before requesting results.
  Aborted or stale requests must not replace a newer query. Clearing restores
  input focus and removes the query from the URL. Empty and failure states
  must remain distinguishable.
- Archive clearing preserves selected facets and resets pagination. Pending
  URL writes must not restore the cleared text.
- Dialogs have a name, close control, Escape support and focus restoration.
  Mobile panels must remain scrollable without document-width overflow.
- Provider sign-in, public reports and payment links retain their existing
  destinations and authorization semantics. Visual review must not submit
  reports, charge payments, or fabricate authenticated state.
- Controls retain visible focus, readable labels and mobile touch targets.
  Metadata is separate from editorial prose; do not transform all copy to caps.
- Public search and archive labels are English; this does not authorize
  replacing the authenticated administration area's existing language.

## Verification boundary

Use rendered desktop and mobile viewports, not build success alone. Browser
emulation is not real iPhone/Safari validation. Authenticated admin workflows,
external provider callbacks and payments require separate access and checks.

## Homepage journey contract — September 6, 2026

The homepage renders one stable edition through five content domains. It keeps
both selected records visible, never randomizes on the client, never opens a
graphic archive asset or autoplay media below the lion, and labels editorial
illustration/safe-cover imagery as non-evidence. Claim status appears before
the claim; an unresolved record is not phrased as a finding. Each section has a
single destination action and honest empty/unavailable states. Ask must not
cover links, warnings or media credits on mobile or enlarged text.

### Phone refinement — September 6, 2026

- Each section shows a lead and a companion; both are visible without any
  interaction and their order is the edition's, never the client's.
- A preview shows whole sentences within a budget and clamps only as a
  backstop; it never ends on a cut word, and it does not remove fields from
  the document. Status precedes the claim and is stated once.
- The edition is one ground from cover to footer; no section changes the
  page's colour mid-page (owner ruling, 2026-09-06).
- On a phone a record is an open column, not a box inside the page; a
  dossier's identity is its status line, its kicker and its finding rule.
- On a phone, body and summaries are never below 16px, metadata and
  captions never below 13px, kickers never below 11px.
- Every image carries its disclosure as the first caption line, visibly,
  never behind a tooltip; `alt` carries the full sentence.
- The section's one destination action follows the records on a phone.
- Ask lives in the masthead on every route and at every width; there is no
  floating launcher and none may be added. The masthead is tall at the top
  of a document and retracts on sustained scroll-down into a short bar
  carrying the two tools, returning on scroll-up, on keyboard focus, or at
  the top of the page. The retracted bar keeps every 44px target, its
  accessible name and its safe-area offsets, and the document's offset
  follows the masthead's mode, so nothing reflows underneath it. It is never
  hidden from the tab order, and the page reserves no column for it.

## Voice — September 8, 2026

The identity lines, decided in `docs/audits/2026-09-08-copy-table.md` and
used verbatim wherever they appear:

- Cover standfirst: **Truth has a signal. Find it, check it, share it.**
- Brand role under the wordmark: **Evidence, not narratives**
- Homepage journey head: **What happened. What is being said about it. How
  to check.**
- Site description (`lib/site-config.ts`): **Open-source evidence on the
  information war against Israel — sourced so you can check it, trace it and
  share it.**

Register: second person, one verb the reader performs, one thing they get.
"The desk" names the Ask product and the machine-authorship disclosure, and
nothing else; no "corpus", no "record" as a self-description, no "living
record". Reader-facing errors say what to do, never an HTTP status.

## Verbs — September 8, 2026

One verb per destination, on every card, band and hub. A new surface takes
its verb from here rather than coining one.

| Destination | Verb |
| --- | --- |
| News / Israel-update article | Read the story |
| Narrative-watch / fact-check record | See the evidence |
| Investigation case | Open the investigation |
| Testimony | Read the testimony |
| Documented record behind a warning | Open with a content warning |
| Person profile | Read their story |
| Hub "everything" link | All of *Section* → |
| Daily briefing | Read the briefing |

## The Midnight Signal identity — September 17, 2026

Owner rulings of 2026-09-15 (recorded in `.ai/DECISIONS.md`): a new visual
identity, dark only, cinematic motion, public site + Ask/Search scope. What a
future change must respect:

- **The quote role.** Literata (`--face-quote` / `--t-quote` / `.quoteText`)
  is the one serif, with one job: a human being quoted — survivor testimony
  (italic, attribution in roman), the exact claim on a Fake Resistance row
  (roman, in quotation marks, under "Claim in circulation"), a pull quote from
  a source. Never the standfirst, a headline or a kicker.
- **The signal rule.** One 1px gold line whose head is a five-bar stub
  (`components/brand/SignalMark.tsx`), rendered by a zero-JS server component
  and rationed to at most three appearances per page: the cover's rail, a
  masthead rule, the colophon's closing rule. Everywhere else the rule is a
  plain 1px hairline doing structural work. On October 7 the rule is unbroken
  and unlit (`--ink-lo`).
- **October 7's motion profile.** Same ground, no cover layers, no texture, no
  ambient motion, no parallax, no stagger, no accent fill, no auto-rotation:
  display weight one step lighter (`main[data-memorial]`), testimony in the
  quote role, markers unbroken ("held"), entrances fade-only (`.enterQuiet`),
  page transition crossfade-only (`data-quiet`). Dignity is carried by
  measure, leading and silence.
- **The cover.** A sticky midnight field inside a scroll runway; the uncrowned
  particle lion keyed into core/haze layers (`public/brand/cover/`,
  ≤ 4 MB hard budget) condensing into the signal rule as the reader scrolls;
  arrival is once, ≤ 1.2s; all scroll motion is pure CSS
  (`animation-timeline: scroll(root)` behind `@supports`); reduced motion,
  `@supports not` and `html[data-motion="paused"]`
  (`components/home/MotionControl.tsx`, the WCAG 2.2.2 pause control) each
  state the complete static design explicitly. The lion appears once per
  visit, on the cover.
- **Page transitions.** Shared elements from list to record only —
  `record-<publicId>-{headline,kicker,plate}` from every list surface; the
  chrome holds still (`view-transition-name: chrome`, set via
  `data-vt-chrome`); everything else rides the root crossfade; no
  cross-document `@view-transition` rule; no `template.tsx`/`loading.tsx`.
