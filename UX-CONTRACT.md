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

## Motion — September 16, 2026

The identity's second half. One take: nothing moves on its own except the
cover, everything else moves because the reader scrolled or navigated, and
every scroll-driven effect is CSS with no script, no observer and no
animation library.

- **The cover** is the layered lion on the flat ground. It is a track one
  screen plus a runway long: the field is held for the runway while the
  masthead travels off it, the lion's core and haze leave at two depths, and
  the signal rule draws from its stub to the edition rail's measure. One
  ambient loop exists on the whole site — the haze's nine-second breath, on
  the cover only.
- **The signal rule** is rationed to three places: the cover, where it is
  born; the head of a hub's or a record's masthead; the colophon's closing
  rule. Everywhere else the rule is a plain hairline doing structural work.
- **Entrances** are the `.enter` view timeline on a band's head and its first
  two records — at most three things arrive, never a list, and never the
  archive index, the update feed or search results.
- **Page transitions**: the document crossfades and rises; a record's
  headline and plate morph from the list surface that opened them; the
  masthead is anchored and never travels.
- **Three still states, each a complete design**: an engine without
  scroll-driven animation or view transitions, `prefers-reduced-motion`, and
  the reader's own pause — the cover's visible control (WCAG 2.2.2), which
  persists and freezes the cover, the entrances and the transitions. In all
  three the runway is zero, the lion is at rest, the rule is drawn, and every
  page is navigable and complete.
- **October 7 is the quiet exception, by contract**: the same ground and the
  same crossfade with no rise; no cover layers, no parallax, no stagger, no
  ambient motion, no accent fill, no auto-rotation, no shared-element names.
  Entrances are opacity only, testimony is set in the quote role, and the
  route's rule is unbroken and unlit.

## The system's one vocabulary — September 16, 2026

- **One styling system.** `components/ui` over the tokens in
  `app/globals.css`, and nothing else. The vendored registry, Tailwind and
  `cn()` were deleted; the import boundary that quarantined them stays, so a
  second system cannot return quietly.
- **One verdict renderer.** Every verdict, grade and identity state is a
  `Badge`, which draws a ramp **and** a shape, so a state survives greyscale
  and a colour deficiency. No surface may draw its own.
- **One accent per viewport.** Gold is the current mark, or the primary
  action, or the verdict emphasis — never two at once, never a wash or a
  gradient. Ember is reserved for the adversarial side: a contested claim, a
  false verdict, a danger. A finding is not contested and never takes it.
- **Meaning is never in a tooltip.** `title` carries no information a reader
  needs; an explanation is visible text or a disclosure they can open.
- **A control boundary owes 3:1** (WCAG 1.4.11) and reads `--control-line`.
  A decorative hairline may be quieter; the line that says where a button
  begins may not.
- **Three faces, three jobs.** The text and display face for words a person
  wrote, the mono face only for machine values — dates, counts, ids, citation
  numbers, keyboard hints — and the quote face only for a human being quoted.

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
- Ask and Search live in the masthead on every route, at every width, as
  the same two controls (2026-09-08); nothing floats over the page. The
  masthead itself is tall at the top of a document and a bar once the page
  has scrolled; on a sustained scroll down it retracts and returns on scroll
  up, at the top, when a panel opens, or the moment keyboard focus enters it
  (2026-09-15). `<main>` is offset by the tall height at all times, so a mode
  change never reflows the page. Every control in it keeps its 44px target,
  its accessible name and its focus restoration, and none is ever removed
  from the tab order.

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
