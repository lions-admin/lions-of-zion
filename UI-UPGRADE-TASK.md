# Homepage UI upgrade — task brief

Derived from a visual review of all 41 captures in `cognitive-psychology-ux/`
(formerly `screen/`) — chromium at 390 / 768 / 1024 / 1440 / 1920, seven section
frames each, plus the five `-full` page captures and `-390-no-js` — taken
2026-09-06, cross-checked against the code that produces each defect.

Surface register: **marketing / brand / content** (`frontend-design-premium` §1).
Apply accessibility, layout stability, responsive behavior, semantic interaction
and reduced motion. Do not import CRUD or admin machinery.

Canonical owners this work must respect, not duplicate:
`app/globals.css` (reusable tokens) · the owner's current visual brief · `UX-CONTRACT.md` (behavior) ·
`components/ui/Button` · `components/site/SiteHeader`.

---

## P0 — legibility and first impression

### 1. The sticky header veil is too thin; page text ghosts through it

Visible at **every** width. Clearest cases: `chromium-home-768-news.png`, where
"One desk. A wider record." and "Local preview · Edition 2026-09-06" are fully
readable *through* the bar; and `chromium-home-390-heroes.png`, where
"…with a content warning ↗" runs across the brand. Also present in
`-1024-news.png`, `-1024-heroes.png`, `-1440-news.png`, `-1440-heroes.png`,
`-1920-news.png`, `-1920-fakeResistance.png`, `-390-october7.png`,
`-390-israelsStory.png`, `-390-system.png`, `-768-october7.png`,
`-768-system.png`.

Cause: `components/site/site-header.module.css:49`
```css
background: linear-gradient(180deg, var(--glass-middle), var(--glass-bottom));
```
with `--glass-middle: rgba(45, 44, 42, 0.29)` (`app/globals.css:230`). The top
of the bar — exactly where the wordmark sits — is 29% opaque. `blur(16px)`
softens what is underneath but does not stop it reading.

Fix: raise the top stop's opacity until the wordmark sits on a clean ground at
all widths, or move the brand row down into the denser part of the gradient.
Keep one treatment for both the hero and reading pages (the comment at `:46` is
the intent — honour it). The `@media` fallback at `:594`
(`color-mix(in oklab, var(--ground) 88%, transparent)`) is already the denser of
the two and can guide the value.

### 2. The mobile hero contains no lion

`chromium-home-390-hero.png`: the upper two-thirds are cloud, with a strip of
mane at the right edge. The face is absent, the masthead sits over empty sky,
and everything below y≈700 is dead ground.

**The cause is settled, not speculative.** `chromium-home-390-no-js.png` shows
the identical frame — and per `components/sections/HeroVideo.tsx`, the no-JS
path never renders a video element at all, only `.posterField`. So this is not
the intro entrance being caught mid-walk-in. The asset
`/video/lion-hero-poster-mobile.jpg` is itself framed with the subject far right
and low; `background-size: cover` on a 390×1000 box keeps the empty left two
thirds.

This contradicts the written contract in `app/home.module.css:673-681`:

> The lion's face gets the upper third unopposed. The statement begins below the
> eyes, on the calmer chest of the portrait.

and the owner's direction: *"The photographic lion is the homepage's signature. Keep its
face unobscured."*

Fix: reframe the 9:16 poster (and the matching `intro`/`loop` cuts, so the video
does not jump away from the poster's composition) so the face occupies the upper
third at 390×1000, as the code already claims it does.

### 3. The 768 hero bisects the lion's face

`chromium-home-768-hero.png`: the face is cut in half by the right viewport
edge. Only the left half — one eye — is visible.

Cause: `app/home.module.css:94` switches `.posterField` to the landscape shoot
at `@media (min-width: 48rem)`, and `HeroVideo` picks `wide` at the same
breakpoint. But 768×1000 is still a **portrait** box (0.77:1). Fitting a 16:9
frame into it with `cover` discards most of the width, and the lion sits at the
right of that composition. The breakpoint is chosen on width when the thing that
matters is aspect ratio.

Fix: switch shoots on `(min-aspect-ratio: 1/1)` — or raise the width threshold
until the viewport is actually landscape. The file's own comment at `:87-92`
argues that each viewport should get "a frame composed for its shape"; at 768 it
does not.

### 4. LCP is 5.8–7.5s

`browser-results.json`: `lcp: 7476` @390, `5816` @768. `cls: 0` — layout
stability is already correct; do not regress it.

Contributors to measure before changing anything:
- `app/page.tsx:12` — `export const dynamic = "force-dynamic"`; every visit is an
  uncached SSR render.
- `components/home/HomeJourneyPrimitives.tsx` — **every** homepage image is
  `loading="lazy"`, including the first figure of the first section. Nothing
  carries `priority`.
- hero poster/video weight and decode order.

Target: LCP under 2.5s at 390 on the local run, CLS still 0.

---

## P1 — the layout system

### 5. The hero's left edge never aligns with the content below it

The hero and the journey use two independent gutter systems, and they disagree
at every width:

| Width | Hero masthead left | Journey content left |
| --- | --- | --- |
| 390 | 24px | 20px |
| 768 | 45px | 28px |
| 1024 | 61px | 28px |
| 1440 | 71px | 40px |
| 1920 | 77px | 160px |

Hero: `clamp(var(--sp-5), 6vw, var(--sp-8))` (`home.module.css:679`, and `:660`
for ≥48rem). Journey: `.journey{max-width:1680px;padding:0 40px}` with three
breakpoint overrides. The direction even inverts — the hero is indented *more*
than the content up to 1440, and *less* at 1920. Visible across every `-full`
capture as a kink where the hero meets the first section.

Fix: one page gutter, owned in one place, consumed by both.

### 6. Page gutters are asymmetric between 1100 and 1799

`components/home/homepage-journey.module.css:13`
```css
@media(min-width:1100px){ .journey{ padding-right:112px; padding-left:40px } }
@media(min-width:1800px){ .journey{ padding-right:40px } }
```

Below 1100 it is a symmetric 28px; from 1800 up, symmetric 40px inside the
`max-width:1680px` box. Between those it is 40 left / 112 right. This is why
every 1440 capture reads left-heavy with a dead right margin — content stops at
x=1328 (1440−112) — while 1920 looks balanced. `chromium-home-1440-full.png`
shows it at macro scale as a lopsided column down the entire page.

Pick one gutter system. If the wide right margin is wanted at some widths, make
it a named, commented decision rather than a breakpoint accident.

### 7. `.peopleSpread` has three layouts, and the middle one reads broken

- ≤1099: one column, articles `4fr 7fr` — works
  (`chromium-home-1024-heroes.png` is the cleanest version of this section)
- 1100–1799: one column, `max-width:1000px`, second article `margin-left:auto` →
  `chromium-home-1440-heroes.png`, where hero 2's portrait starts at x=330, on
  no grid line hero 1 uses
- ≥1800: two columns → `chromium-home-1920-heroes.png`, which works

1440 is the most common desktop width and gets the weakest result. Resolve to
one intent across the range.

### 8. 768–1099 keeps the desktop spreads, and the measures collapse

The single-column rules live in `@media(max-width:767px)`, so at 768 the
two-column `newsSpread` (`8fr 4fr`) and `archiveSpread` (`7fr 5fr`) are still
in force on a tablet-width viewport.

`chromium-home-768-news.png`: the secondary column is ~205px wide. "Israel
Ministry of Defense: recent announcements and programs" wraps to five lines, and
the body copy runs at roughly 22 characters per line — the worst measure on the
site. Same failure in `chromium-home-768-october7.png`.

Fix: move the single-column collapse up to ~1024, or make the spreads
`minmax()`-based so the secondary column cannot fall below a readable measure.

### 9. Column stagger is a set of unrelated magic numbers

The same "offset the second item" idea is implemented four times with six
different values in `homepage-journey.module.css`:

| Section | Selector | Offset |
| --- | --- | --- |
| Archive | `.archiveSpread>article[data-kind="documentation"]` | `64px` (`12px` @767) |
| Heroes | `.peopleSpread article:nth-child(2)` | `64px`, `20px` @1099, `16px` @767, `8px` @1100, `80px` @1800 |
| History | `.historySpread article:nth-child(2)` | `80px` (`0` @767) |

Result in `chromium-home-1920-israelsStory.png`: the left column's rule sits at
y≈270 and the right column's at y≈350, so the right date reads a third of the
way down the left image. It looks like misalignment rather than editorial
stagger, because nothing else signals the offset is deliberate.

Fix: one `--journey-stagger` token, one value per breakpoint, applied by the
same rule in all three sections. If a section needs a different offset, name the
variant.

---

## P1 — component contract

### 10. The section link's arrow is detached and oversized

`homepage-journey.module.css:4`
```css
.link{ gap:24px; font-size:15px; border-bottom:1px solid var(--control-line); … }
.link span{ font-size:25px }                          /* the ↗ */
@media(max-width:767px){ .link{ font-size:14px } }    /* the span does not follow */
```

The glyph is pinned at 25px and the gap at 24px while the label shrinks, so at
390/768/1024 the arrow is ~1.8× the label with a hand-width gap, and the shared
`border-bottom` runs under the empty space between them. See
`chromium-home-390-news.png`, `-390-october7.png`, `-768-news.png`,
`-1024-israelsStory.png`.

Fix: express the glyph size and the gap in `em` of the label so they track it,
and decide whether the rule underlines the text or the whole control — it
currently does the latter by accident.

### 11. Four different arrow vocabularies

- hero primary action: `→` (via `components/ui/Button`)
- journey section links: `↗︎` (`JourneyLink`)
- pipeline steps: `content:'→'` in CSS
- narrative path: `content:' →'`, and `' ↓'` under 768px

Pick one system (direction = navigation vs. external/deeper), and keep
decorative glyphs out of `content`, where assistive tech will announce them.

---

## P1 — tokens

### 12. `homepage-journey.module.css` is off-system

`app/globals.css` supplies reusable runtime tokens. This file —
which renders six of the homepage's seven sections — uses roughly ninety
hardcoded pixel values instead: type at 12/13/14/15/16/17/18/22/24/25px and
spacing at 6/7/8/10/12/14/16/18/20/22/24/28/32/36/40/44/48/60/64/76/80/112px,
none of them `--t-*` or `--sp-*`. Captions render at **12px**, below the
system's own `--t-caption: 0.8125rem` (13px) — `.figure figcaption` at `:5` and
again at `:16`.

Contrast is not the problem (`--ink-lo` #a8a29a on `--ground` #0b0b0b is 7.8:1,
AA-clear); size and drift are. This is the root cause of findings 6–11: every
one of them is a number that had nowhere canonical to come from.

Fix: map the file onto the existing scales. Where no token fits, add one to
`globals.css` when it is genuinely shared — do not start a second private
scale.

### 13. The file is minified

`homepage-journey.module.css` is written one line per section (several lines
exceed 3,000 characters), and `HomeJourneyPrimitives.tsx` is compressed the same
way. Any change here is unreviewable as a diff. Format both first, as a separate
commit, so the design changes land as a readable diff.

---

## P2

14. **No-JS at 390 dumps the whole navigation above the hero.**
    `chromium-home-390-no-js.png`: with no JavaScript the mobile panel renders
    open and inline, so thirteen links plus "Support the work" occupy the first
    ~965px and the hero begins below them. The page is 15,780px tall against
    14,722px for the JS run. Exposing the nav is the right fallback in
    principle — `tests/no-js-invariant.test.ts` guards it — but it currently
    reads as a broken page rather than a deliberate one: no heading, no
    containment, and the hamburger disappears from the bar. Give the fallback a
    designed presentation.

15. **Pipeline connector is fragile.** `.pipeline li:not(:last-child)::after`
    paints `'→'` with `background:var(--ground)` to punch a hole in the gold
    rule; it breaks the moment the ground changes. At ≤1099 the wrap point is
    hardcoded as `.pipeline li:nth-child(4)::after{content:none}`, and at 768
    the sequence loses its connector where it wraps between rows
    (`chromium-home-768-system.png`).

16. **The pipeline stops being a pipeline on mobile.**
    `chromium-home-390-system.png`: seven steps become a bullet list with square
    gold dots and no direction, and `grid-template-columns:minmax(110px,1fr) 2fr`
    forces "Information item" to wrap. The section's whole argument is the
    sequence — keep it legible as one.

17. **Three header variants, and the breakpoint is not where it looks.**
    390 = three icons; 768–1099 = search pill + Menu + Support Us + avatar
    (`chromium-home-768-hero.png`, `-1024-hero.png`); 1100+ = full nav
    (`chromium-home-1440-hero.png`). Verify tap targets are ≥44px at 390 and
    that no primary path is silently dropped at a breakpoint.

18. **Hero dead space at 390.** With the masthead at `max(40svh, 18rem)`
    (`home.module.css:678`) the bottom ~30% of the mobile hero is empty ground.
    Once finding 2 is resolved, re-judge whether the hero still needs a full
    `100svh`.

---

## Out of scope

Backend, briefing pipeline, quality checks, auth, the archive/search routes.
No content changes: publication titles, source labels, verdicts, timestamps and
credits stay exactly as the edition renders them (never manufacture
freshness or proof to fill a layout).

## Acceptance

- Header wordmark legible over scrolled content at 390 / 768 / 1024 / 1440 / 1920.
- The lion's face is in frame at 390, 768 and every width above; the contract in
  `home.module.css` matches what renders, in both the JS and
  no-JS paths.
- LCP < 2.5s @390 locally; CLS stays 0.
- One page gutter shared by hero and journey; one stagger token; one arrow
  vocabulary across all seven sections.
- No text column below ~45 characters at any width.
- No hardcoded type or spacing value left in `homepage-journey.module.css`
  without a token behind it.
- `npm run verify:changed` clean; `tests/home-direct-entry.test.tsx`,
  `tests/intro-accessibility.test.ts` and `tests/no-js-invariant.test.ts` pass.
- Re-run the capture and compare the same 41 frames.
