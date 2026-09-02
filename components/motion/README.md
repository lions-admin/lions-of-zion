# `components/motion` — the motion primitive library

Seven behaviours adapted from [Magic UI](https://magicui.design) in September
2026, rewritten against this project's V3 tokens and CSS Modules.

## Why nothing was installed

Magic UI ships through the shadcn registry as Tailwind-class components that
import `cn()` from `@/lib/utils` and animate with the `motion` package. This
project has none of those three things:

* **No Tailwind.** `tailwindcss` resolves in `node_modules` only as a
  transitive dependency of `@neondatabase/auth-ui` and `@react-email/tailwind`.
  There is no `tailwind.config`, no `postcss.config`, and no `@import
  "tailwindcss"`. Styling is CSS Modules over the custom properties in
  `app/globals.css`.
* **No shadcn.** There is no `components.json`, so `shadcn add` has nothing to
  write into. The brief's instruction not to initialise a second shadcn config
  resolves, here, to not initialising a first one for seven components.
* **No animation library.** Adding `motion` would put ~40 kB gzipped of
  client JavaScript in front of a home route that already carries a Three.js
  WebGPU scene, to tween properties the compositor animates for free.

So the registry sources were read (`https://magicui.design/r/<name>.json`) and
the *mechanisms* were ported. Five of the seven are pure CSS and render on the
server. **Dependencies added: none.**

## What each one came from

| Here | Magic UI source | Mechanism kept | What changed |
| --- | --- | --- | --- |
| `Reveal` | `blur-fade` | opacity + shift + blur on enter, once | One shared `IntersectionObserver` for the document instead of `useInView` per node; CSS transition instead of `motion` variants; a `scripting: enabled` guard and a 4s failsafe so the no-JS tier and a failed hydration both still show the content |
| `BorderBeam` | `border-beam` | `offset-path: rect()` travel + the padding-box/border-box mask ring | `motion` dropped entirely — `offset-distance` is a plain animatable property, so this is now a server component with zero JS. Ink instead of `#ffaa40 → #9c40ff`; gold is opt-in, not the default |
| `SignalBeam` | `animated-beam` | measure two elements against a container, quadratic Bézier, re-measure on resize | The travelling light is `pathLength="1"` + a CSS `stroke-dashoffset` walk, not a `motion`-driven `<linearGradient>`. Reads as a packet on a wire rather than a shine, and costs no JS after mount. Resize is rAF-batched |
| `Ticker` | `number-ticker` | count to value when scrolled into view | rAF + easeOutExpo instead of `motion`'s spring. **The SSR output is the final value**, not `startValue` — the original sends `0` to crawlers, to no-JS readers and to the accessibility tree |
| `ShinyText` | `animated-shiny-text` | `background-clip: text` sweep, mostly at rest | Timing kept verbatim (`0%,90%,100%` rest / `30%–60%` pass). Base colour moved onto the element so the label is legible with the animation gone |
| `Spotlight` | `magic-card` | pointer-tracked radial gradient on surface and border | `motion`'s three springs and `next-themes` dropped; two custom properties written straight to the style attribute. 5% ink, not a 200px violet gradient. No listener at all on coarse pointers |
| `ProgressiveBlur` | `progressive-blur` | stacked `backdrop-filter` layers under offset masks | 8 layers → 5, and the masks moved from inline styles into `nth-child` rules. Eight full-surface blur reads per frame over a live WebGPU scene was the cost that mattered |

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
