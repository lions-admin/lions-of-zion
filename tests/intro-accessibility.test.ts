/**
 * The accessibility and interaction contract of the layers *behind* a reader.
 *
 * The requirement came from `fixhomeTODO.md`, deleted 2026-09-05 once the
 * particle entrance it planned was retired. What it asked for survives here:
 * a decorative layer must never block interaction, never enter the
 * accessibility tree, never move without being asked, and never spend the
 * foreground's contrast budget.
 *
 * Until 2026-09-14 the layer this file was mostly about was the scan
 * backdrop — sixteen drifting rows of the monitoring corpus behind every
 * reading page. That is retired; `tests/scan-backdrop-retired.test.ts` pins
 * its absence. What is left behind a reader is two things, and both are
 * checked here:
 *
 *  1. **the page ground** — the flat `--ground` and the four flat plates
 *     over it (2026-09-15: the scan texture and the fixed photograph under
 *     the reading routes are gone), so the ink tokens are read straight
 *     against a token, and the worst case is the lightest plate;
 *  2. **the home hero's video layer** — pointer-inert, out of the
 *     accessibility tree, and not downloaded at all under reduced motion.
 *
 * The contrast block earns its keep. `--ink-lo` — captions, metadata, TOC
 * links — is the binding token, and it reads against `--surface-3`, the
 * lightest plate it can land on, rather than only against `--ground`. The
 * helpers recompute that from the tokens the stylesheet actually carries, so
 * re-grading a surface fails this suite instead of a review.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const sections = read("components/sections/sections.module.css");
const globals = read("app/globals.css");
const home = read("app/home.module.css");

/* ------------------------------------------------------------------ colour */

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ] as const;
}

/** WCAG 2.x relative luminance of an 8-bit sRGB triple. */
export function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Source-over composite of `fg` at `alpha` on an opaque `bg`. */
export function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [
    alpha * fg[0] + (1 - alpha) * bg[0],
    alpha * fg[1] + (1 - alpha) * bg[1],
    alpha * fg[2] + (1 - alpha) * bg[2],
  ] as const;
}

/** The value of a `--token: #rrggbb;` declaration in `app/globals.css`. */
function token(name: string): Rgb {
  const match = globals.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})\\s*;`));
  if (!match) throw new Error(`no hex value for ${name} in app/globals.css`);
  return hexToRgb(match[1]);
}

const INK_HI = token("--ink-hi");
const INK = token("--ink");
const INK_LO = token("--ink-lo");
const GOLD = token("--gold");
const GOLD_DIM = token("--gold-dim");
const EMBER = token("--data-ember");
const EMBER_SOFT = token("--data-ember-soft");

/**
 * The grounds a page is read on: the flat `--ground` and the lightest plate
 * a token can land on, `--surface-3`. Nothing is composited over either —
 * the scan texture and the fixed photograph were deleted on 2026-09-15 —
 * so the plate is the worst case for every foreground token, and it is the
 * one worth pinning. `composite()` above stays exported for the alpha lines.
 */
const GROUND = token("--ground");
const SURFACE_3 = token("--surface-3");

const AA_BODY = 4.5;
const AA_UI = 3;

/* ------------------------------------------------------------------- tests */

describe("the reading ground is read against directly, nothing composited over it", () => {
  it("keeps body, caption and metadata text at AA on the ground and on the lightest plate", () => {
    /* `--ink-lo` is the binding token: captions, `.tocLink`, `.tocNumber`,
       `.sideRailInner dt`, at `--t-caption` and `--t-data`, so 4.5 and not 3.
       `--gold-dim` is small text on the fact-check ladder and the home rail;
       `--data-ember-soft` is the verdict chip's own text on a plate. Each is
       measured on `--surface-3` as well as the ground, because a token that
       clears the ground and misses the plate has been the bug here twice. */
    for (const [name, ink] of [
      ["--ink-lo", INK_LO],
      ["--ink", INK],
      ["--ink-hi", INK_HI],
      ["--gold", GOLD],
      ["--gold-dim", GOLD_DIM],
      ["--data-ember", EMBER],
      ["--data-ember-soft", EMBER_SOFT],
    ] as const) {
      expect(contrastRatio(ink, GROUND), `${name} on --ground`).toBeGreaterThanOrEqual(AA_BODY);
      expect(contrastRatio(ink, SURFACE_3), `${name} on --surface-3`).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("keeps a control boundary at 3:1 on every surround it can sit in", () => {
    /* `--control-line` is an opaque hex since 2026-09-15 so that this number
       does not depend on which plate the field sits on; `--gold-line-strong`
       is the selected-chip boundary and owes the same floor. */
    for (const name of ["--control-line", "--gold-line-strong"]) {
      expect(contrastRatio(token(name), GROUND), `${name} on --ground`).toBeGreaterThanOrEqual(AA_UI);
      expect(contrastRatio(token(name), SURFACE_3), `${name} on --surface-3`).toBeGreaterThanOrEqual(AA_UI);
    }
  });

  it("paints one flat ground and no photograph or texture under the reading routes", () => {
    expect(globals).toMatch(/html, body \{[^}]*background-color:\s*var\(--ground\)/);
    expect(globals).not.toMatch(/background-attachment:\s*fixed/);
    expect(globals).not.toMatch(/body::before \{/);
    expect(globals).not.toMatch(/background-image:\s*var\(--scan-ground/);
    expect(globals).not.toMatch(/--family-scan/);
  });
});

describe("the home hero's moving layer cannot rise, catch a pointer, or be announced", () => {
  it("renders behind the hero inside a layer that is itself pointer-inert", () => {
    /* 2026-09-06: the hero's background stack no longer uses a numbered
       z-index ladder. `.fieldLayer` is a negative-z-index positioned
       descendant of `.hero`, which `isolation: isolate` turns into its own
       stacking context — and CSS's own painting order puts a negative-z-index
       positioned descendant *below* every ordinary in-flow, non-positioned
       descendant of that context. `.masthead` is exactly that (no `position`
       of its own), so it paints above `.fieldLayer` with no z-index of its
       own needed. */
    expect(home).toMatch(/\.hero \{[^}]*isolation:\s*isolate/);
    expect(home).toMatch(/\.fieldLayer \{[^}]*z-index:\s*-1/);
    expect(home).toMatch(/\.fieldLayer \{[^}]*pointer-events:\s*none/);
    expect(home).not.toMatch(/\.masthead \{[^}]*position:/);
    /* The layer is the held screen of the cover (2026-09-16): sticky for the
       runway, then gone with the section. Its contents, in paint order —
       the flat ground, the haze, the core, the scrim — carry no z-index at
       all and stack purely by source order inside that same layer, and the
       whole layer is `aria-hidden` with `alt=""` on each picture: the lion is
       the brand's image, not information. `pointer-events: none` is still
       load-bearing — an `<img>` is draggable and a `<picture>` catches a
       pointer that should reach nothing here. */
    expect(home).toMatch(/\.fieldLayer \{[^}]*position:\s*sticky/);
    const page = read("app/page.tsx");
    expect(page).toMatch(/<div className=\{styles\.fieldLayer\} aria-hidden="true">/);
    expect(page).toMatch(/<div className=\{styles\.posterField\} \/>[\s\S]*?<CoverLayer name="haze"[\s\S]*?<CoverLayer name="core"[\s\S]*?<div className=\{styles\.heroScrim\} \/>/);
    expect(page).toMatch(/<img[^>]*\salt=""/);
    expect(page).not.toContain("<video");
    for (const selector of [".posterField", ".lionHaze", ".lionCore", ".lionLayer", ".heroScrim"]) {
      expect(home, selector).not.toMatch(new RegExp(`\\${selector}[^{]*\\{[^}]*z-index`));
    }
  });

  it("is overpainted by the content layer, the masthead and the skip link", () => {
    expect(sections).toMatch(/\.shell \{[^}]*z-index:\s*var\(--z-raised\)/);
    /* The skip link is the masthead's first child since 2026-09-15 and
       opens above the fixed bar on focus, so its ring is never behind it. */
    const header = read("components/site/site-header.module.css");
    expect(header).toMatch(/\.skipLink \{[^}]*z-index:\s*var\(--z-overlay\)/);
    for (const [name, value] of [
      ["--z-raised", 10],
      ["--z-header", 200],
      ["--z-modal", 500],
    ] as const) {
      expect(globals).toMatch(new RegExp(`${name}:\\s*${value};`));
    }
  });
});

describe("reduced motion is honoured by every layer that still moves", () => {
  it("leaves the cover still in all three still states, with its runway at zero", () => {
    /* Three states, three answers, and the global 0.01ms kill switch is not
       one of them: it cannot shorten a scroll timeline. So the cover's own
       reduced-motion block names every timeline element with `animation:
       none` and sets the runway to zero (no pinned pause — one plain screen,
       the lion at rest, the rule present); the reader's own pause
       (`html[data-motion="paused"]`, set by `MotionControl`) does the same;
       and an engine without scroll-driven animation gets the static default
       because the timeline is layered on behind `@supports`. No script is
       involved in any of them — there is no video, nothing to give a source
       to, nothing to download beyond the layers themselves. */
    const reduced = home.slice(home.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.hero \{ --cover-runway: 0svh; \}/);
    expect(reduced).toMatch(/\.lionCore, \.lionHaze, \.lionLayer,[^{]*\{ animation: none; \}/);
    expect(home).toMatch(/html\[data-motion="paused"\] \.hero \{ --cover-runway: 0svh; \}/);
    expect(home).toMatch(/html\[data-motion="paused"\] \.lionCore,[^{]*\{ animation: none; \}/);
    expect(home).toMatch(/@supports not \(animation-timeline: scroll\(\)\) \{\s*\.hero \{ --cover-runway: 0svh; \}/);
    /* The scroll itself lives only behind the feature test. */
    const timeline = home.slice(home.indexOf("@supports (animation-timeline: scroll())"));
    expect(timeline).toMatch(/animation-timeline: scroll\(root\)/);
    expect(home.slice(0, home.indexOf("@supports (animation-timeline: scroll())"))).not.toContain("animation-timeline");
    expect(read("app/page.tsx")).not.toContain("<video");
  });

  it("stills the reading shell's entrance and every transition in its navigation", () => {
    const reduced = sections.slice(sections.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced.length).toBeGreaterThan(0);
    /* The one entrance the module declares, and the rail/aside that ride it. */
    expect(reduced).toMatch(/\.panel,\s*\.tocRail,\s*\.sideRail \{\s*animation:\s*none/);
    /* Every transition in the contents control and rail. */
    for (const name of [
      "depthValue",
      "tocLink",
      "tocLinkActive",
      "tocControlChevron",
      "tocSheetLink",
      "tocSheetLinkActive",
    ]) {
      expect(reduced, name).toContain(`.${name}`);
    }
    expect(reduced).toMatch(/transition:\s*none/);
    expect(reduced).toMatch(/.tocControlTrigger\[aria-expanded="true"\] .tocControlChevron \{\s*transform:\s*none/);
  });
});

describe("no interaction in the reading shell depends on hover alone", () => {
  it("pairs every hover state in the reading shell with focus-visible or a static one", () => {
    expect(sections).toMatch(/\.tocSheetLink:hover,\s*\.tocSheetLink:active,\s*\.tocSheetLink:focus-visible/);
    expect(sections).toMatch(/\.tocSheetLink:focus-visible,\s*\.tocSheetLinkActive:focus-visible/);
    expect(sections).toMatch(/\.page a:focus-visible/);
    expect(globals).toMatch(/:focus-visible \{\s*outline:\s*var\(--focus-outline\)/);
  });

  it("keeps the home action legible without animated flourishes and pairs hover with focus", () => {
    /* 2026-09-06: the hero's primary action is no longer a bespoke
       `.ctaPrimary` button — it is the same `JourneyLink` every other record
       and section action on the homepage uses (`homepage-journey.module.css`
       `.link`), which is a plainer, single interaction vocabulary for the
       whole page rather than a one-off CTA component. */
    const journey = read("components/home/homepage-journey.module.css");
    expect(journey).toMatch(/\.link:hover,\s*\.link:focus-visible/);
    expect(journey).toMatch(/\.link:hover svg,\s*\.link:focus-visible svg/);
    /* The hero's remaining link list — the no-JavaScript one — changes colour
       on focus as well as on hover. It is precisely the set a keyboard
       without a pointer reaches, so hover-only styling here would be the
       worst place for it. */
    expect(home).toMatch(/\.noscriptNav a:hover,\s*\.noscriptNav a:focus-visible/);
  });
});

describe("the no-JavaScript home still shows a readable band over the static ground", () => {
  const page = read("app/page.tsx");

  it("still offers a way off the page when the header cannot", () => {
    /* The regression this replaced a band-visibility check with.
     *
     * `SiteHeader` hides `.barNav` entirely below 64rem and hands every
     * destination to a drawer that opens with script. So on a phone with
     * scripting off the header names no routes at all, and the hero's file
     * index — deleted as a duplicate of the header's list — was the only
     * server-rendered set of links that state had. Removing it left that
     * reader stranded on the homepage; this is the fallback that fixes it.
     *
     * `<noscript>` and not a hidden element, deliberately: the duplication the
     * index was deleted for must not come back for the readers the header
     * already serves, and `<noscript>` renders nothing for them. */
    expect(page).toMatch(/<noscript>[\s\S]{0,400}?<nav[^>]*aria-label="All sections"/);
    expect(page).toMatch(/<noscript>[\s\S]{0,600}?SITE_NAVIGATION\.map/);
    /* Plain anchors — `next/link` would be a client component with nothing to
       hydrate it in the one state this block exists for. */
    expect(page).toMatch(/<noscript>[\s\S]{0,700}?<a href=\{item\.href\}>/);
  });

  it("keeps a ground under every state, so none of them is a bare screen", () => {
    /* The cover's ground is the page's own flat colour with the one
       vignette the palette allows, painted by the stylesheet rather than by
       any component, so it is there before any script runs and stays when
       none ever does. No photograph is declared for it any more: the posters
       left with the video (2026-09-16). */
    expect(home).toMatch(/\.posterField \{[^}]*background:[^;]*var\(--ground\)/);
    expect(home).not.toContain("--hero-poster");
    expect(globals).not.toContain("--hero-poster");
    /* And the rest of the site is read on the one flat ground. */
    expect(globals).toMatch(/html, body \{[^}]*background-color:\s*var\(--ground\)/);
  });

  it("renders the hero wordmark, fallback links and editorial journey as server HTML", () => {
    expect(page).toMatch(/<h1 id="home-wordmark"/);
    expect(page).toMatch(/aria-label="All sections"/);
    expect(page).toContain("<HomepageJourney edition={edition}/>");
    expect(page).not.toContain("SignalRotator");
    /* 2026-09-06: the fallback nav now renders in its own flow section below
       the hero (`.readingSurface`), not as an overlay on the photograph, so
       it needs the page's own flat ground rather than a distinct panel
       colour to sit legibly against. */
    expect(home).toMatch(/\.noscriptNav \{[^}]*background:\s*var\(--ground\)/);
  });
});
