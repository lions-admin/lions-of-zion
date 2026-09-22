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
- ~~The edition is one ground from cover to footer~~ — superseded on
  2026-09-17 by owner ruling: each homepage band is a room on its own
  full-bleed surface (`--room-*` in `app/globals.css`), all steps of the one
  charcoal family and never a new hue. Text tokens are measured against the
  lightest room. Every other page keeps the single ground.
- On a phone a record is an open column, not a box inside the page; a
  dossier's identity is its status line, its kicker and its finding rule.
- On a phone, body and summaries are never below 16px, metadata and
  captions never below 13px, kickers never below 11px.
- Every image carries its disclosure as the first caption line, visibly,
  never behind a tooltip; `alt` carries the full sentence.
- The section's one destination action follows the records on a phone.
- Below 1100px on the homepage the Ask launcher retracts while the reader
  scrolls down and returns on scroll up, at the end of the page, or on
  keyboard focus; it keeps a 44px-or-larger target, its accessible name,
  `aria-expanded`, safe-area offsets and focus restoration. It is never
  hidden from the tab order, and the page reserves no column for it.

### Composition — September 17, 2026

- The edition is numbered. Each band opens on a rule that carries its folio
  (`01`–`06`, read from `HOMEPAGE_BANDS`) beside its kicker, and the contents
  index under the cover carries the same numbers. The folio is `aria-hidden`;
  the kicker and the heading remain the band's name.
- The cover's edition rail is the masthead's sibling and, on a wide cover,
  runs the full measure as the cover's bottom line. It still reads the
  edition's own lead and is still one 44px-plus link.
- Rank is carried by position and scale: a band's lead runs the full measure,
  its companion sits beneath it on a rule. A claim under refutation keeps the
  `--journey-aside` cap and is marked as quoted material (ember hairline,
  italic); the verdict is a tone bar and a word, never colour alone.
- October 7 records answer no pointer. The roster in The People of Israel
  tells its kinds apart by typographic voice (`data-voice`), with the label
  in a margin column.

### Signal over noise — September 17, 2026 (third ruling; extended site-wide by the fourth below)

The rooms, plates, grain and per-band entrances of the ruling above are
withdrawn; what replaced them is the concept below.

- **The homepage stands on exact black** (`--home-ground: #000000`), set once
  on `.homeTheme`. Every other page keeps `--ground`.
- **The cover carries a signal field** (`SignalField.tsx`): the desk's own
  vocabulary drawn as typographic texture in the darkness, cleared off the
  lion by a luminance mask that reads the poster *through* the scrim, and
  cleared off the cover's reading text by `[data-field-clear]`. It is
  `aria-hidden`, takes no pointer, is one static frame under reduced motion,
  and is absent entirely without JavaScript.
- **Noise and signal are the page's grammar.** A claim in circulation is set
  as noise — ember, italic, scan-lined, and never above `--journey-aside`;
  the desk's finding under it is set as signal, upright and ivory. Status
  still precedes the claim.
- **A band's name is the page's largest type**, on one line, drawn across the
  screen by the reader's scroll where the browser supports a scroll timeline
  and sized to the measure where it does not.
- **October 7 is silent**: no word stream, no travelling title, no hover, no
  entrance.
- Word streams (`WordStream.tsx`) are decorative vocabulary only, `aria-hidden`,
  and never carry October 7 material.

### Signal over noise, site-wide — September 22, 2026 (fourth ruling, governing)

The owner extended the homepage concept above to every public page. Where this
section and the third ruling disagree, this one governs.

- **Every page stands on exact black.** `--ground` is `#000000` at `:root`;
  `--home-ground` and the `.homeTheme` re-point are retired. The scan texture
  and the veiled lion photograph behind reading routes are gone — the lion
  appears where it is the subject (the home cover, the editorial intro).
- **Structure is a hairline, not a plate.** Surfaces are re-cut to
  `#0b0b0b / #111 / #171717 / #1e1e1e` and reserved for controls and overlays;
  lists, hubs, cards (`feature`, `dossier`) and panels are ruled entries.
  Shadows are a lit edge only.
- **One type scale, with two new tiers.** `--t-display-xl` is a page's own
  title (hub, article, record, the footer nameplate); `--t-band` is a homepage
  band name and nothing else; `--t-prose` is long-form running text. The
  homepage's private `--journey-*` scale is folded into this one.
- **Noise and signal are the site's grammar**, as shared roles in
  `app/globals.css` (`noise`, `signal`): a claim in circulation is ember
  italic, capped at the h3 size; the finding under it is upright ivory on the
  amber rule; the status word precedes the claim everywhere — articles, the
  watch and fact-check pages, updates and the homepage.
- **One motion idea**: `resolve` — a page title settles out of a slight blur
  into focus once on arrival. Off under reduced motion and inside
  `[data-still]`; `EditorialShell` sets `data-still` for October 7, and the
  October 7 archive keeps no hover or transition at all.
- **Gold is one focal moment per viewport**: bylines, labels and counts are
  ink; gold stays on the page's one primary action and the current-page rule.
- **Numbering must mean a sequence.** The homepage band folios, the evidence
  explorer's and search's ordinals are gone; a document's table of contents
  and the echo chain keep theirs.

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
