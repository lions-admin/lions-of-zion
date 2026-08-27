# The self-review checklist

Ordered by how often each class of defect actually ships. Work top to bottom
against the *rendered* page — screenshots and computed styles, not the CSS
source. The source tells you the intent; only the render tells you the truth.

## 1. Typography

- Every font-size answers to the current scale — the inherited `--t-*`
  tokens, or the revised scale you've decided on. A size that belongs to
  neither is drift, not a decision; either map it or change the scale
  deliberately and propagate it.
- Headline line breaks: no widow (a lone short word on the last line), no
  broken proper noun, no awkward rag. `text-wrap: balance` first; a manual
  `max-width` nudge second; never a `<br>`.
- Line length in the reading column stays 60–75ch at every width you test.
- Hierarchy is visible when you squint: blur the screenshot mentally — can
  you still tell title from section from body from data? If two levels look
  the same size-and-weight, one of them is wrong.
- Legibility floor: type under ~11.5px is unreadable on most panels; long
  runs of uppercase-with-tracking destroy word shapes. Cross either line
  only with a reason you'd defend out loud (zoom in and measure if unsure —
  `getComputedStyle` gives the real pixel size).
- Mono (`Geist Mono`) appears only on data — a date, a count, a route, a
  status. Mono running a full sentence is a defect.

## 2. Spacing and alignment

- One spacing rhythm within the component: gaps step consistently (e.g.
  4/8/12/24), not 13px here and 17px there. Inconsistent gaps read as
  "unfinished" long before anyone can articulate why.
- Space groups correctly: the gap *inside* a group is smaller than the gap
  *between* groups. A caption closer to the next section's heading than to
  its own image is a real, common, high-impact defect.
- Optical alignment beats box alignment: icons vertically centered against
  the x-height of adjacent text, not the line box; hanging bullets and
  quotes where the design language calls for it.
- Zoom into every edge the change touched: baseline of text against a rule,
  left edge of stacked elements, the reading column against `--reading-w`.
  2px misalignments hide at 100% zoom.

## 3. Color and contrast

- Every color belongs to a palette you could name — the inherited tokens, a
  `color-mix()` derivation, or the revised palette you've ruled in. A color
  that answers to no system is a finding.
- Body text ≥ 4.5:1 against its actual background (including any backdrop
  translucency); `--ink-lo` only at `--t-caption` and above.
- Gold is spent, not sprayed: it marks the one thing on screen that deserves
  emphasis. If gold appears more than a few times in a viewport, hierarchy
  has collapsed into decoration.
- Check color-adjacency: text over `ScanBackdrop` regions must sit in the
  masked zone; nothing readable may fight the scan for contrast.

## 4. States and interaction

- Hover: visible, subtle, no layout shift (test: does anything move when you
  hover? then it fails).
- `:focus-visible`: present on every interactive element you touched, uses
  the system's focus treatment, visible against the black ground.
- Tap targets ≥ 44×44px on mobile — measure the actual hit area, padding
  included, not the glyph.
- Cursor is honest: `pointer` on things that act, default on things that
  don't. A non-interactive card with `cursor: pointer` is a broken promise.
- Disabled/empty/loading variants of anything you touched still look
  designed, not forgotten.

## 5. Responsive

- Three widths minimum: 375, 768, desktop. Reading pages: also ≥1280 where
  the TOC rail and evidence margin engage — confirm both rails render and
  the measure stays centered.
- Nothing scrolls horizontally. Long unbroken strings (URLs, emails, Hebrew
  and English mixed) wrap or truncate deliberately.
- Between the breakpoints, not just at them: drag through the range once.
  The worst layouts live at 641px and 1024px, not at the test presets.
- Content honesty: does the design survive twice the text, an empty list, a
  missing image? Test with the real longest content in the data, not the
  demo item.

## 6. Motion

- Every animation you added or touched: 150–300ms, ease-out entrances,
  nothing bouncing on a reading surface, nothing looping forever.
- `prefers-reduced-motion`: emulate it; the page must be complete and
  usable with all motion gone — not frozen mid-state.
- No animation of layout properties (width/height/top) where transform and
  opacity do the same job.

## 7. Consistency with siblings

- Open one sibling page (another dossier route) beside the changed one. Do
  the kicker, date, entry-title, and rule treatments still match? Local
  drift on one page is how the last design system died — 51 font sizes
  started as reasonable local exceptions.
- If the change introduced a new pattern (a new card style, a new label
  arrangement), either generalize it into the shared components/tokens or
  flag in the report that it is deliberately one-off and why.

## 8. The final look

Take one clean screenshot of the finished state at desktop and one at
mobile. Look at each for ten seconds as a first-time reader, not as its
author. Ask: what do I see first, second, third — and is that the right
order? Does anything look accidental? Anything you would fix if a design
director pointed at it — fix now, before reporting.
