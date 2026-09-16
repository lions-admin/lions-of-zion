/**
 * The accessibility and interaction contract of the layers *behind* a reader.
 *
 * The requirement came from `fixhomeTODO.md`, deleted 2026-09-05 once the
 * particle entrance it planned was retired. What it asked for survives here:
 * a decorative layer must never block interaction, never enter the
 * accessibility tree, never move without being asked, and never spend the
 * foreground's contrast budget.
 *
 * Until 2026-09-16 the layer this file was mostly about was the scan
 * backdrop and the still photograph behind the reading routes. The 2026-09-16
 * identity round retired both — plus the plate grade — and the ground is now
 * one flat colour, so what is left behind a reader is two things, and both
 * are checked here:
 *
 *  1. **the page ground** — `--ground`, flat, declared once on html and body.
 *     The ink tokens are read straight against it, and against
 *     `--surface-3`, the lightest plate text may land on;
 *  2. **the home hero's video layer** — pointer-inert, out of the
 *     accessibility tree, and not downloaded at all under reduced motion.
 *
 * The contrast block earns its keep. `--ink-lo` — captions, metadata, TOC
 * links — is the binding token; the helpers recompute every pair from the
 * tokens the stylesheet actually carries, so changing a value without
 * re-measuring fails this suite instead of a review.
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
const GROUND = token("--ground");
const SURFACE_3 = token("--surface-3");

/**
 * The Midnight Signal ground is one flat colour (2026-09-16): the scan
 * texture, the fixed photograph under the reading routes and the plate grade
 * were all retired with them, so the ink tokens are read straight against
 * `--ground` — there is no brightest-pixel worst case any more, because the
 * ground no longer has one. The lightest surface a line of text may land on
 * is `--surface-3`, and it is checked as the second worst case.
 */
const AA_BODY = 4.5;

/* ------------------------------------------------------------------- tests */

describe("the ground is one flat colour, and the ink is read against it", () => {
  it("keeps body, caption and metadata text at AA on the ground", () => {
    /* `--ink-lo` is the binding token: captions, `.tocLink`, `.tocNumber`,
       `.sideRailInner dt`, at `--t-caption` and `--t-data`, so 4.5 and not 3.
       On the flat navy ground every ink token has the whole budget: the
       retired scan backdrop used to take 0.43 of a ratio away from these
       same numbers. */
    for (const [name, ink] of [
      ["--ink-lo", INK_LO],
      ["--ink", INK],
      ["--ink-hi", INK_HI],
      ["--gold", GOLD],
    ] as const) {
      expect(contrastRatio(ink, GROUND), name).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("keeps the same floor on the lightest surface text can land on", () => {
    for (const [name, ink] of [
      ["--ink-lo", INK_LO],
      ["--ink", INK],
      ["--ink-hi", INK_HI],
      ["--gold", GOLD],
    ] as const) {
      expect(contrastRatio(ink, SURFACE_3), name).toBeGreaterThanOrEqual(AA_BODY);
    }
  });

  it("keeps an input's control boundary at 3:1 against every surface it sits on", () => {
    /* `--control-line` is a solid hex since the 2026-09-16 re-grade; the
       identity round pinned a 3.6 floor on it (A11Y-004 wanted 3). It owes
       the floor on the lightest surface, not just the ground. */
    const controlLine = token("--control-line");
    for (const surface of ["--surface-0", "--surface-1", "--surface-2", "--surface-3"] as const) {
      expect(contrastRatio(controlLine, token(surface)), surface)
        .toBeGreaterThanOrEqual(3.6);
    }
  });

  it("paints one flat ground and no layer behind it", () => {
    /* The scan texture (`--scan-ground*`), the fixed photograph
       (`--site-ground-photo` and `body::before`) and the plate grade
       (`--surface-grade*`) are retired; `tests/scan-backdrop-retired.test.ts`
       pins the scan's component-level absence, and this is the token-level
       half: the ground is `--ground`, declared once, on html and body. */
    expect(globals).toMatch(/html, body \{[^}]*background-color:\s*var\(--ground\)/);
    expect(globals).not.toMatch(/--scan-ground/);
    expect(globals).not.toMatch(/--surface-grade/);
    expect(globals).not.toMatch(/--site-ground-photo/);
    expect(globals).not.toMatch(/body::before/);
    expect(globals).not.toMatch(/background-attachment:\s*fixed/);
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
    /* The layer's contents, in paint order. A video is not pointer-inert by
       default — it has native controls and is focusable — so the
       `pointer-events: none` above is load-bearing rather than tidy, and the
       elements carry `tabIndex={-1}` and `aria-hidden` of their own. Poster,
       video and scrim carry no z-index at all and stack purely by source
       order inside that same layer. */
    const page = read("app/page.tsx");
    expect(page).toMatch(/<div className=\{styles\.posterField\} \/>[\s\S]*?<HeroVideo[\s\S]*?<div className=\{styles\.heroScrim\} \/>/);
    for (const selector of [".posterField", ".heroVideo", ".heroScrim"]) {
      expect(home, selector).not.toMatch(new RegExp(`\\${selector} \\{[^}]*z-index`));
    }
    const hero = read("components/sections/HeroVideo.tsx");
    expect(hero.match(/aria-hidden="true"/g)?.length).toBe(2);
    expect(hero.match(/tabIndex=\{-1\}/g)?.length).toBe(2);
  });

  it("is overpainted by the content layer, the masthead and the skip link", () => {
    expect(sections).toMatch(/\.shell \{[^}]*z-index:\s*var\(--z-raised\)/);
    /* 2026-09-16: the skip link is the masthead's own element now, so the
       overlay z-index that used to live on the shell's `.skipHost` wrapper
       lives on the link in `site-header.module.css`. The value pinned here is
       unchanged: the link that focuses over a full-bleed fixed bar paints
       above it, not under it. */
    const shell = read("components/site/site-header.module.css");
    expect(shell).toMatch(/\.skipLink \{[\s\S]*?z-index:\s*var\(--z-overlay\)/);
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
  it("leaves the home's moving layer still — and undownloaded", () => {
    /* Stillness here is not a paused animation but an absent source: the
       effect returns before either element is given one, so a reader who
       asked for stillness does not download 30MB of video to hold on frame
       one. `.posterField` is what they see, and it is painted by the
       stylesheet with no script at all. */
    const hero = read("components/sections/HeroVideo.tsx");
    expect(hero).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
    expect(hero).toMatch(/if \(reduced\.matches\) \{[\s\S]*?return;/);
    expect(hero).toMatch(/preload="none"/);
    expect(home).toMatch(/\.posterField \{[^}]*background:\s*var\(--hero-poster-tall\)/);
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
    /* The hero's ground is the video's own first frame, painted by the
       stylesheet rather than by the component, so it is there before any
       script runs and stays when none ever does. */
    expect(home).toMatch(/\.posterField \{[^}]*background:\s*var\(--hero-poster-tall\)/);
    expect(globals).toMatch(/--hero-poster-tall:\s*url\(/);
    /* And the rest of the site reads on the same flat ground the home does. */
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
