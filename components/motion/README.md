# `components/motion` — the motion primitive library

Six behaviours adapted from [Magic UI](https://magicui.design) in September
2026, rewritten against this project's V3 tokens and CSS Modules. A seventh,
`Spotlight` (from `magic-card`), was built, integrated, and then removed —
see below.

## Why these six were ported rather than installed

**Updated 2026-09-02: Tailwind v4, shadcn and `motion` are now installed** (see
`app/tailwind.css`, `components.json`, and the cascade note at the top of
`app/globals.css`). The paragraphs below describe why these six were ported
*before* that happened, and they remain the reason the six stay ported rather
than being replaced by their registry originals.

When these were written the project had none of the three things Magic UI needs:
Tailwind resolved in `node_modules` only as a transitive dependency, there was no
`components.json`, and no animation library. Porting six mechanisms was the
smaller change than standing up the stack for six components.

That calculus changed when the brief called for Magic UI across the whole
product, and the stack went in. **These six still do not move**, for reasons that
outlived the original argument:

* **Five of the six render on the server with zero client JavaScript.** Their
  registry equivalents are all `"use client"` and half pull `motion`.
* **`motion` server-renders its `initial` variant as an inline style** —
  `opacity: 0` — and with JavaScript off nothing ever removes it. The content is
  present in the DOM and invisible. `scripts/ci-smoke.mjs` counts nodes, not
  visibility, so that failure passes CI green. This directory is what the home
  route and every no-JS tier uses instead.
* `Ticker` and `Reveal` are corrections of their originals, not translations —
  see the table below. Replacing them would reintroduce the bugs.

**The tier rule.** `/` and everything `CinematicIntroGate` wraps: no Magic UI, no
`motion`, ever — use this directory. Reading routes: a registry component only if
it is pure CSS and degrades to visible content. Client-only surfaces (`/admin`,
`/particle-demo`): full Magic UI, wrapped in `<MotionConfig reducedMotion="user">`
because the CSS kill-switch in `globals.css` cannot reach inline transforms.

**Do not re-export anything `motion`-based from `index.ts`.** This barrel is
imported by routes that must stay light; a single `motion` re-export puts 34 kB
into every one of them. Registry components live in `components/magicui/` and are
imported by path.

Naming hazard, noted rather than renamed: this directory is `components/motion/`
and the npm package is `motion`. A file importing from both is legal and reads
badly.

## What each one came from

| Here | Magic UI source | Mechanism kept | What changed |
| --- | --- | --- | --- |
| `Reveal` | `blur-fade` | opacity + shift + blur on enter, once | One shared `IntersectionObserver` for the document instead of `useInView` per node; CSS transition instead of `motion` variants; a `scripting: enabled` guard and a 4s failsafe so the no-JS tier and a failed hydration both still show the content |
| `BorderBeam` | `border-beam` | `offset-path: rect()` travel + the padding-box/border-box mask ring | `motion` dropped entirely — `offset-distance` is a plain animatable property, so this is now a server component with zero JS. Ink instead of `#ffaa40 → #9c40ff`; gold is opt-in, not the default |
| `SignalBeam` | `animated-beam` | measure two elements against a container, quadratic Bézier, re-measure on resize | The travelling light is `pathLength="1"` + a CSS `stroke-dashoffset` walk, not a `motion`-driven `<linearGradient>`. Reads as a packet on a wire rather than a shine, and costs no JS after mount. Resize is rAF-batched |
| `Ticker` | `number-ticker` | count to value when scrolled into view | rAF + easeOutExpo instead of `motion`'s spring. **The SSR output is the final value**, not `startValue` — the original sends `0` to crawlers, to no-JS readers and to the accessibility tree |
| `ShinyText` | `animated-shiny-text` | `background-clip: text` sweep, mostly at rest | Timing kept verbatim (`0%,90%,100%` rest / `30%–60%` pass). Base colour moved onto the element so the label is legible with the animation gone |
| `ProgressiveBlur` | `progressive-blur` | stacked `backdrop-filter` layers under offset masks | 8 layers → 5, and the masks moved from inline styles into `nth-child` rules. Eight full-surface blur reads per frame over a live WebGPU scene was the cost that mattered |

## Built, then removed

**`Spotlight`** (`magic-card`) was ported in full — pointer-tracked radial
gradients on surface and border, at 5% ink, with no listener on coarse
pointers — and then deleted, because integration found it nowhere to live:

* `components/ui/Card` has **zero call sites**. The card that actually ships
  is `components/content/ContentCard`.
* `ContentCard` is a non-interactive `<article>` at both its call sites.
  A cursor spotlight on static editorial text is the SaaS-tile failure the
  brief's §7 names by hand.
* The `/fake-resistance` branch cards are the one genuinely interactive card
  on the site, and they already carry a complete hover and focus treatment:
  a 2px lift, hairline brightened to `--line-strong`, the ember top rule
  brightened to its peak, surface raised a level, `--shadow-1` to
  `--shadow-2`, and the title to `--gold-hi`. A 5% wash under that is
  redundant, and would need a third wrapper element around an anchor already
  wrapped for `Reveal`.
* `/october-7` and `/our-heroes` are governed by §13 restraint.

Keeping it would have meant shipping a Magic UI port that renders on no page
— which is the residue the brief's §J asks to be swept up at the end.

## Rejected, and why

* **`scroll-progress`** — `components/sections/ReadingProgress.tsx` already
  does this, rAF-throttled and aware of which element is actually the
  scroller. The existing one is better.
* **`animated-list`** — its mechanism is items *arriving over time*. Every
  list on this site is server-rendered in one pass, so the only applicable
  half was the stagger, which is `Reveal`'s `index` prop.
* **`particles`, `meteors`, `flickering-grid`, `dot-pattern`, `retro-grid`,
  `warp-background`, `ripple`** — the home route's background is a baked
  particle scene and a typographic field. A second, unrelated particle system
  is the definition of decoration.
* **`smooth-cursor`, `pointer`** — a custom cursor on a site that publishes
  testimony.
* **`shimmer-button`, `shiny-button`, `ripple-button`, `pulsating-button`,
  `interactive-hover-button`** — `components/ui/Button.tsx` is a five-variant
  system with worked-out hover, active, disabled, loading, focus and
  reduced-motion states. Replacing it would be a downgrade.
* **`marquee`** — §11 of the brief rules a ticker out for Live Updates, and
  nothing else here scrolls horizontally by choice.
* **`globe`, `orbiting-circles`, `icon-cloud`, `lens`, `terminal`,
  `file-tree`, `bento-grid`, `text-reveal`, `hyper-text`, `morphing-text`,
  `kinetic-text`** — no surface on this site needs them; see the mapping
  table in the task report.

## Importing

Import from the barrel (`@/components/motion`). `package.json` declares
`sideEffects: ["*.css", "**/*.css"]`, which is what makes that safe: every
module here imports a CSS Module, and a CSS import is a side effect, so
without that declaration a bundler must assume the barrel needs all seven
stylesheets and a route rendering one primitive ships five it never uses.

`app/page.tsx` imports the two it uses by path instead. That predates the
`sideEffects` declaration and is now belt-and-braces rather than necessary;
it is left alone because the home route's first paint is the one this site
is judged by, and a direct path cannot regress if the field is ever removed.

## Rules

* **Ambient motion is `--dur-ambient`; entrances are `--dur-enter`; hovers
  stay on `--dur-fast`/`--dur-base`.** Nothing in here sets its own timing
  literal.
* **Every primitive degrades to the content.** Under
  `prefers-reduced-motion: reduce`, with JavaScript off, or on a coarse
  pointer, each one removes itself and leaves the thing it was decorating
  intact and legible. No state is communicated by animation alone.
* **`Reveal`, `Spotlight`, `SignalBeam` and `Ticker` are client components;
  the other three are not.** All four take `children` as a prop, so a server
  component wrapped in one stays a server component. No page became
  `"use client"` for anything in this directory.
