# Design V2 — "The broadsheet over the scan"

_2026-08-25. The redesign plan for every reading surface on the site._

> **Status: Phases 0–4 implemented and merged. The rails, promised below and
> left unbuilt, landed on 2026-08-25 as design direction B, "the intelligence
> desk".** This document said the Brief's anatomy "becomes *the* shell for
> everything"; only the centred measure shipped, so the three grid tracks sat
> with two of them empty. Both margins now work — the left navigates the
> document and shows depth of read, the right carries each record's citation
> beside it. See `.ai/DECISIONS.md`, "The source travels beside the claim",
> for why the margin is a grid rather than absolute positioning, why Our
> Heroes opts out, and what happened to the chat launcher's label.
>
> Nine commits, five parallel
> agent rounds, verified in real Chrome across all ten routes at 1440×900
> and 390×844. The measured result against the audit that prompted this:
> **zero** text rendering below the 0.72rem floor (was 77 declarations under
> 11.2px), the reading column genuinely centred (was 148px off), ~140px from
> masthead to first sentence (was ~320px), and a two-row footer (was a
> five-part ~345px stack). Cinzel no longer appears on any reading surface.
> **Phase 5 (home-scene orbit labels) remains open and is a user decision.**
> The one deliberate carry-over, restoring document scroll, **landed on
> 2026-08-27** — see "Phase 2" below.

The user's verdict on the current design, verbatim: terrible fonts, hard to
read, bad page layout — a serious overhaul, several levels forward. This
document is the plan for that overhaul: what's actually wrong (audited in
real Chrome, all 10 routes, both viewports), the new direction, and the
phased implementation. Nothing here touches the particle home scene — the
intro, the crowned lion, and the orbit remain the site's identity. This is
about the ten reading pages behind it.

---

## Part 1 — What is actually wrong

Two full audits (typography/readability, layout/composition) over fresh
1440×900 + 390×844 captures of every route, cross-referenced against the
real CSS. The numbers first, because they end any argument about whether
the user is right:

- **51 distinct font-size values** across the frontend CSS. A designed
  system has 6–8.
- **77 of ~160 font-size declarations are below 0.7rem (11.2px)** — half
  the type system is smaller than the legacy browser minimum.
- **67 `text-transform: uppercase` declarations, 64 with letter-spacing
  ≥ 0.1em** — uppercase+tracked is display treatment, and it's being used
  for content: entry titles, filter chips, names, whole sentences.
- **~12 distinct body-gray hexes** (#e8eef8 → #8fa3b6) and **6 golds** with
  no scale relationship — six rounds of parallel agent work each added a
  slightly different local dialect. Same-role elements drift: five kicker
  styles, four date styles, three "paragraph colors" that can appear on a
  single page.
- On one War Update screen a reader meets **~9 distinct type voices**.

### The three root causes

**1. A display face doing a newspaper's job.** Cinzel is a Trajan-style
inscriptional face — all-caps forms designed for monuments at large sizes.
It's the H1, the section H2 (at 0.95rem/15px with +0.18em tracking, on
every dossier page), the timeline entry titles, the card titles, the names
of real people on Our Heroes. Its lowercase renders as faux small-caps, so
sentence-length titles read as strings of even-height capitals with no word
shapes — the single biggest "hard to read" driver. The diagnosis is
sharpened by where Cinzel *works*: the Brief's 4.35rem headline and the
home scene's wordmark, i.e. brand-mark scale. The face isn't the problem;
using it at 15–18px for reading-level headings across ten routes is.

**2. A micro-chrome layer drowning the content.** The dominant voice by
declaration count is 0.49–0.68rem uppercase tracked Geist Mono: file rails,
meta grids (PublicationMeta terms at 0.5rem = 8px), source kinds, badges,
kickers, footer nav. The metadata that carries this site's entire
credibility claim — published, reviewed-by, source count — is the least
legible thing on every page. And because 77 declarations sit within
0.49–0.68rem of each other, size cannot create hierarchy: everything
non-paragraph reads as one undifferentiated field of dim small caps.

**3. A shell built for placeholder prose, never rethought for real
documents.** The dossier shell (15rem rail + 44rem floating panel) was
designed when the eight pages were single-screen intent statements. They
are now real editorial documents (Israel's Story: 9,271px of scroll; Fake
Resistance: 5,556px) and the shell fails them:

- At 1440px only **~49% of the viewport is reading surface**; the panel
  sits right-of-center with a ~220px dead zone on the right and the rail
  floating in a void on the left, while half-legible `ScanBackdrop`
  fragments drift through the empty margins — too faint to read, too
  present to ignore; they collide with rail text and read as a broken page,
  not atmosphere.
- Every dossier page opens with the same ~320px non-content ceremony
  (letterspaced caps title, lede, rule, kicker); the first real content —
  a milestone, a case, a figure — lands at y≈700 or below the fold.
- The file footer is a five-part, ~345px apparatus stack (prev/next,
  8-file index, boxed Ask CTA, policy links, close line) in one identical
  0.56–0.66rem mono voice, with **two competing "Ask" affordances visible
  simultaneously** (the boxed CTA + the floating launcher). On short pages
  (~30% chrome on /methodology; /corrections' first fold is
  majority-chrome) the apparatus outweighs the content.
- **The site is visually two sites**: the Geopolitical Brief's own
  full-width, three-column composition uses the whole screen, feels
  designed, and is visibly "the good page" — the seven dossier pages read
  as unfinished next to it. A third variant (DocPage) floats its back-link
  disconnected above the panel. The per-page signature devices (datelines,
  exhibits, chapters, citations, pipeline, toolkit) are sound editorial
  ideas suffocated by shell proportions and label soup — they survive; the
  shell doesn't.

### Live bugs found by the audit (fix regardless of redesign)

1. **The chat launcher label overlaps panel body text on every desktop
   route** — "ASK ABOUT X" renders on top of reading text at bottom-right.
   Broken-looking on every page.
2. **We Are's pipeline collapses**: five `flex:1` columns in a ~600px
   measure → 2–3-word lines; the gate column runs 2× its neighbors' height,
   leaving a ~180px void; below it, the 4-up Roles grid clips its own card
   titles ("INVESTIGATOR:").
3. **The inner-scroll container** (`.page { height:100dvh;
   overflow-y:auto }`) means the document never scrolls: full-page
   screenshots truncate, the scrollbar floats detached inside the panel
   edge, and every scroll-linked feature needs a special-cased container.

---

## Part 2 — The direction

**Name: "The broadsheet over the scan."** This site is a verification
desk publishing in English. The reading surfaces should be typed the way a
serious English-language newspaper would type them — a real news serif for
headlines, a working text sans for body, mono confined to data — over the
particle scan that remains the site's identity.

> **Revision note (same day)**: the first draft of this direction chose
> Hebrew-native faces (Frank Ruhl Libre / Heebo) for a future-RTL dividend.
> The user correctly rejected this — the site is in English, Frank Ruhl
> Libre's Latin is a companion script, and Heebo's Latin is literally
> Roboto. Faces are now chosen Latin-first; the Hebrew path is preserved as
> designated companions for the future RTL round, not as today's drivers.

### Type system (the one real risk, taken deliberately)

- **Display / headings: Newsreader.** A serif designed by Production Type
  specifically for on-screen news reading, with real optical sizes (6–72)
  — broadsheet headline gravitas at display scale, honest legibility at
  text scale, real lowercase word shapes. Sentence case at real sizes.
  Not one of the AI-default display serifs, and exactly this subject's
  register: a newspaper face for a page that claims to be a record.
- **Body / UI: IBM Plex Sans.** Serious, characterful, screen-first — not
  Inter/Roboto genericism. Excellent at text sizes with a big weight range.
  Replaces Geist Sans on reading pages.
- **Data: Geist Mono stays — demoted to actual data.** Dates, file paths,
  counts, status values. Floor 0.72rem, tracking ≤ 0.08em, never for
  sentences.
- **Cinzel retires from all reading surfaces.** It survives in exactly one
  place: the home-scene wordmark/identity (the particle experience). This
  amends the "Cinzel labels" convention recorded in CLAUDE.md/the nav
  brief — a deliberate decision to record in DECISIONS.md, not a drive-by.
  (Open question for the user, Phase 5: do the home orbit's DOM labels
  also move to the new system, or does Cinzel remain the whole home
  scene's voice? Recommendation: leave the home scene untouched this
  pass.)

**The Hebrew path, preserved without compromising the English present**:
when the RTL round (TODOS P6) happens, the designated companions are
**IBM Plex Sans Hebrew** (a real, official sibling of the body face) and a
Hebrew display serif to be chosen then (Frank Ruhl Libre and Noto Serif
Hebrew are the candidates). Body text is therefore already one font-family
declaration away from bilingual; nothing about today's Latin quality was
traded for it.

### Type scale — seven steps, no exceptions

| Token | Size | Face / case | Role |
|---|---|---|---|
| `--t-display` | clamp(2.1rem, 4vw, 2.75rem) | Newsreader 600 (display optical), sentence case | Page title |
| `--t-h2` | 1.55rem | Newsreader 500, sentence case | Section heading |
| `--t-h3` | 1.25rem | Newsreader 500, sentence case | Entry/card title |
| `--t-body` | 1.0625rem / 1.7 | Plex Sans 400 | Paragraphs |
| `--t-small` | 0.9375rem | Plex Sans 400 | Secondary prose, asides |
| `--t-caption` | 0.8125rem | Plex Sans 500 | Captions, meta values |
| `--t-data` | 0.72rem | Mono 400 | The floor. Labels, dates, counts |

Hard rules, enforced as convention (and greppable in review):
- **Nothing below 0.72rem, ever.**
- **Uppercase+tracking only for ≤2-word data labels at ≥0.72rem**; tracking
  cap 0.08em. Sentence case is the default for every heading and title.
- One kicker style, one date style, one entry-title style — defined once in
  `content.module.css`, never re-declared per page.

### Color — same identity, rebuilt neutrals

The ground and the gold are brand; they stay. The twelve drifting grays and
six golds collapse into a scale:

| Token | Hex | Role |
|---|---|---|
| `--ground` | `#070B14` | unchanged — the site's ground |
| `--ink-hi` | `#E9EEF6` | headings, primary emphasis |
| `--ink` | `#B9C5D4` | body text |
| `--ink-lo` | `#8494A8` | secondary/captions — the floor, AA at ≥0.8125rem |
| `--gold` | `#C9A24B` | unchanged — brand accent, links, rules |
| `--gold-hi` | `#EFD79A` | display moments, hover, focus ring |

Blue and ember survive **only as semantic data ramps** (verified/hostile
streams, badges) — never as text hierarchy. Every current hardcoded gray
maps to the nearest of the three inks during migration; no page keeps a
private paragraph color.

### Layout — one shell, learned from the Brief

The Brief's full-width anatomy is the proven good page; it becomes *the*
shell for everything:

```
┌────────────────────────────────────────────────────────────┐
│ identity band: wordmark · File 03/08 · /war-update · status│  ← one row, full width
├────────────┬───────────────────────────────┬───────────────┤
│ (rail col) │   reading column, 68–70ch     │  (aside col)  │
│ TOC/emblem │   real measure, centered      │  evidence rail│
│ when earned│                               │  when earned  │
├────────────┴───────────────────────────────┴───────────────┤
│ footer: ← prev · next → · Methodology · Corrections        │  ← one row
└────────────────────────────────────────────────────────────┘
```

- **Reading column 68–70ch, actually centered.** Side columns are real grid
  columns used when a page has rail content (the Brief's TOC/evidence
  pattern), empty otherwise — not a permanent 15rem identity totem.
- **The identity band replaces the rail**: emblem (small), file number,
  route, status — one horizontal row under the wordmark, in `--t-data`.
  The ~320px opening ceremony compresses to ~140px; **first real content
  lands above the fold on every page.**
- **The scan becomes a whisper on reading pages**: backdrop rows at ≤0.15
  opacity, excluded from a protected zone around the reading column. It
  stays loud only on the home scene, where it is the product. No more
  half-legible fragments colliding with UI text.
- **Footer diet**: prev/next + policy links, one row. The 8-file index
  collapses into a single inline row of numbers (01–08, current
  highlighted). The boxed "Ask the Lion" CTA is removed — the floating
  launcher is the one ask affordance, and its label gets a max-width +
  offset so it can never overlap the panel again.
- **Document scroll restored** ✅ **2026-08-27**: `.page` stops being an
  inner scroll container; the document scrolls. It was the riskiest
  structural change and did get its own phase and its own verification —
  `scripts/verify-doc-scroll.mjs`, in real Chrome, because the payoff is
  rAF- and history-driven and the in-app browser suspends both.
- **Per-page devices survive, re-typeset**: wire datelines, exhibit files
  (stamp re-anchored to its header instead of floating), chapter numerals,
  citations, toolkit modules. The We Are pipeline goes vertical at all
  widths (its mobile layout is the good one); Roles grid to 2-up.

### The signature

**Every page opens like a broadsheet front page**: a Newsreader headline at
real scale, one gold hairline, and the first piece of actual content — a
dated milestone, an exhibit, a chapter — visible without scrolling. The
particle scan remains the *site's* signature; the *reading pages'*
signature is that they finally read like the newspaper this desk claims to
be.

---

## Part 3 — Phased implementation

Each phase is one gate-verified round (typecheck / lint / the test suite /
build + real-Chrome capture), independently shippable.

**Phase 0 — bugs (immediate, no design dependency)**
Launcher-label overlap (max-width + right-anchor + z-order); We Are
pipeline → vertical, Roles → 2-up. Files: `particle-chat-launcher.module.css`,
`app/we-are/page.module.css`.

**Phase 1 — foundation: fonts + tokens**
Load Newsreader + IBM Plex Sans in `app/layout.tsx` (next/font, subset
latin; Newsreader is variable with an `opsz` axis — use it, that's the
point of the face). Define the 7-step type scale and 6-color tokens in
`app/globals.css`. Rewrite `components/content/content.module.css` onto the
tokens — one kicker, one date, one entry-title style. No page layouts change
yet; every page immediately inherits readable type through the shared
components.

**Phase 2 — the shell**
Rebuild `SectionPage.tsx`/`sections.module.css` and `DocPage.tsx` on the
identity-band + centered-column anatomy; footer diet; backdrop whisper
(`ScanBackdrop` opacity + exclusion zone). Restore document scroll —
verified against the mobile dock math in the same round.

> **Done, including document scroll — 2026-08-27.** The reading column
> measures 68ch and sits on the true viewport centre; the mask that keeps
> backdrop rows out of the reading band reads the same `--reading-w`
> variable the grid does, so the two can't drift.
>
> Document scroll took the phase this note asked for, and the two blockers
> it had proven were the right two — but not the whole set. `globals.css`'s
> `html, body { overflow: hidden }` inverted, and `ReadingProgress` moved to
> `window`/`documentElement`. Beyond them: four more containers had to
> convert in the same change (the brief, `not-found`, `error.tsx`, `admin`),
> because a document has one scroller and leaving any of them on `100dvh`
> gives that route a dead outer scrollbar around a live inner one; the two
> `≤719px` rules that *shortened* the scroller for the chat dock became
> `padding-bottom`, since a document cannot be shortened; `SectionToc`'s
> observer root became the viewport, which would otherwise have reported
> every section as never intersecting and marked nothing without erroring;
> and `ArchiveIndexFilter`'s hand-rolled `sessionStorage` restoration was
> **deleted** rather than kept — it existed only because inner scrollers
> cannot be restored across a back-navigation, and running it alongside the
> browser's own restoration would have had two writers racing for one
> position.
>
> No route-scoped body class was needed in the end: the home scene keeps its
> lock through the existing `:has([data-intro-active])` rules, which are more
> specific than the bare `html, body` default and so still win.
>
> Verified in real Chrome on three routes: the document is the scroller and
> `<main>` is not, the progress bar tracks it, sticky chrome still pins, the
> rail still marks a section, and Back returns a reader to where they were —
> left at 3000, returned to 3000.

**Phase 3 — re-typeset the ten pages**
The seven dossier compositions + the Brief + the two DocPages onto the new
system. Kill every local font-size/color that duplicates a token. The Brief
mostly *keeps* its composition (it's the model) — it gets the type swap and
token alignment only.

**Phase 4 — verification + record**
Full real-Chrome before/after matrix (desktop+mobile, all routes), contrast
re-check at the new sizes, `ci-smoke` green. Update CLAUDE.md (the Cinzel
convention), DECISIONS.md (why the face retired, why the shell changed),
and this document's status.

**Phase 5 (optional, user decision)** — home-scene orbit labels to Frank
Ruhl Libre, or Cinzel stays as the home's voice. Not blocking anything.

---

## Appendix — audit evidence index

Full agent reports live in the session record; headline evidence:
51 font sizes / 77 sub-0.7rem / 67 uppercase / 64 tracked ≥0.1em / ~12
grays / 6 golds / ~9 voices per screen (typography audit); 49% reading
surface at 1440px / ~345px footer stack / ~320px identical page-opening
ceremony / launcher overlap on every desktop route / We Are 2–3-word lines
/ Brief-vs-dossier shell split (layout audit). Fresh captures:
`/tmp/lions-redesign-audit/*.png` (10 routes × 2 viewports + scrolled
views).
