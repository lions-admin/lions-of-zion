/**
 * The scan backdrop's accessibility and interaction contract (fixhomeTODO §7,
 * and the Phase E acceptance line about blocking interaction).
 *
 * Four things are pinned here, all of them source-level, because all four are
 * properties of the stylesheet and the markup rather than of a running page:
 *
 *  1. the layer is out of the accessibility tree, out of the hit test and out
 *     of the clipboard — root and every descendant;
 *  2. nothing in the scan block claims a z-index, so it cannot rise above the
 *     `--z-raised` content layer, the `--z-header` masthead, or a dialog;
 *  3. `prefers-reduced-motion: reduce` composes a frame rather than freezing
 *     one — every drift animation is switched off and every row is given its
 *     own sampled rest position, with the loud rows stepped back to dim;
 *  4. the composited contrast of each route family's profile, recomputed from
 *     the numbers the stylesheet and `scanProfiles.ts` actually carry.
 *
 * (4) is the one that earns its keep. The backdrop paints light text behind
 * light text, so every point of row opacity is spent out of the foreground's
 * contrast budget, and the budget is small: `--ink-lo` — captions, metadata,
 * TOC links, the home file numbers — reads 4.93:1 on the brightest pixel of
 * `--scan-ground` before the scan adds anything at all. The helper below
 * recomputes the composite from first principles so that raising an intensity
 * in `scanProfiles.ts`, the 0.34 ceiling in the stylesheet, or the mask's 25%
 * dim fails this suite instead of a review.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FAMILY_SCAN_PROFILES,
  HOME_SCAN_PROFILE,
} from "@/components/sections/scanProfiles";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const sections = read("components/sections/sections.module.css");
const globals = read("app/globals.css");
const home = read("app/home.module.css");
const backdropSource = read("components/sections/ScanBackdrop.tsx");

/** Declarations only. These rules are about what the CSS does, and this file's
 *  prose — like the stylesheet's — names the properties it is ruling out. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

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
const BLACK = [0, 0, 0] as const;

/**
 * The ground a row composites onto, from `--scan-ground` in `app/globals.css`:
 * a 1px-in-9 rule at `rgba(228, 224, 215, 0.027)` under a radial highlight at
 * `rgba(246, 243, 235, 0.055)`.
 *
 * `edge` is the brightest pixel outside the highlight — the rails, the page
 * margins, the foot of the home hero. `peak` is the brightest pixel anywhere:
 * a rule line at the radial's centre, 50%/26% of the viewport, which is
 * `background-attachment: fixed` and therefore the spot every line of an
 * article scrolls through.
 */
const GROUND_EDGE = composite([228, 224, 215], 0.027, BLACK);
const GROUND_PEAK = composite([246, 243, 235], 0.055, GROUND_EDGE);

/* ------------------------------------------- the numbers, read from source */

/** `opacity: calc(0.34 * var(--register, 1) * var(--scan-intensity, 1))`. */
const ROW_OPACITY_CEILING = (() => {
  const m = sections.match(/opacity:\s*calc\(([\d.]+)\s*\*\s*var\(--register/);
  if (!m) throw new Error("no row opacity ceiling in sections.module.css");
  return Number(m[1]);
})();

/** `.rowField`'s mask: `--dim: color-mix(in srgb, black 25%, transparent)`. */
const MASK_DIM = (() => {
  const m = sections.match(/--dim:\s*color-mix\(in srgb, black (\d+)%, transparent\)/);
  if (!m) throw new Error("no mask dim in sections.module.css");
  return Number(m[1]) / 100;
})();

/** Per-page dimmers that stack under a family profile. */
function registerMultiplier(className: "registerMuted" | "surfaceQuiet"): number {
  const m = sections.match(new RegExp(`\\.${className} \\.row \\{[^}]*--register:\\s*([\\d.]+)`));
  if (!m) throw new Error(`no --register for .${className}`);
  return Number(m[1]);
}

/**
 * The composited background a foreground is read against.
 *
 * `intensity` and `register` are the profile's; `masked` says whether the
 * surface sits inside `--content-w`, where `.rowField`'s mask multiplies the
 * row down; `row` is the colour the backdrop paints — the loud verified row
 * (`var(--ink)`) is the brightest of the four and therefore the worst case.
 */
export function scannedBackground({
  intensity,
  register = 1,
  masked,
  ground,
  row = INK,
}: {
  intensity: number;
  register?: number;
  masked: boolean;
  ground: Rgb;
  row?: Rgb;
}): { alpha: number; rgb: Rgb } {
  const alpha = ROW_OPACITY_CEILING * register * intensity * (masked ? MASK_DIM : 1);
  return { alpha, rgb: composite(row, alpha, ground) };
}

const AA_BODY = 4.5;
const AA_UI = 3;

/* ------------------------------------------------------------------- tests */

describe("the scan layer is inert: no tree, no hit test, no clipboard", () => {
  it("marks the backdrop root aria-hidden and gives every row a non-focusable span", () => {
    expect(backdropSource).toMatch(/<div\b[\s\S]*?aria-hidden="true"/);
    /* Rows are spans, so `aria-hidden` on the root is not defeated by a
       focusable descendant — the one case where the attribute is ignored. */
    expect(backdropSource).toMatch(/<span\s+key=\{row\.key\}/);
    expect(backdropSource).not.toMatch(/tabIndex|<a |<button |href=/);
    expect(backdropSource).not.toMatch(/role="/);
  });

  it("takes the root and every descendant out of the pointer and the selection", () => {
    const rule = sections.slice(
      sections.indexOf(".backdrop {"),
      sections.indexOf(".backdrop[data-speed"),
    );
    expect(rule).toMatch(/pointer-events:\s*none/);
    expect(rule).toMatch(/user-select:\s*none/);
    /* Both are inherited, but stated on the subtree so one `pointer-events:
       auto` on a row cannot quietly repeal the invariant. */
    expect(sections).toMatch(/\.backdrop \*\s*\{[^}]*pointer-events:\s*none/);
    expect(sections).toMatch(/\.backdrop \*\s*\{[^}]*user-select:\s*none/);
    /* Nothing anywhere in the module puts them back. */
    expect(stripComments(sections)).not.toMatch(/pointer-events:\s*auto/);
  });

  it("clips itself and never becomes a scroll container for the document", () => {
    expect(sections).toMatch(/\.backdrop \{[^}]*position:\s*fixed/);
    expect(sections).toMatch(/\.backdrop \{[^}]*overflow:\s*hidden/);
    expect(sections).toMatch(/\.rowField \{[^}]*overflow:\s*hidden/);
  });

  it("starts below the masthead rather than compositing through it", () => {
    expect(sections).toMatch(/\.rowField \{[^}]*inset:\s*var\(--header-h\) 0 0/);
  });
});

describe("the scan layer cannot rise above content, chrome or a dialog", () => {
  /** Everything from the backdrop comment down to the content layer. */
  const scanBlock = sections.slice(
    sections.indexOf("/* The scan, behind everything."),
    sections.indexOf(".shell {"),
  );

  it("claims no z-index of its own", () => {
    expect(stripComments(scanBlock)).not.toMatch(/z-index/);
  });

  it("is overpainted by the content layer, the masthead and the skip link", () => {
    expect(sections).toMatch(/\.shell \{[^}]*z-index:\s*var\(--z-raised\)/);
    const shell = read("components/site/editorial-shell.module.css");
    expect(shell).toMatch(/z-index:\s*var\(--z-overlay\)/);
    /* The ladder the backdrop sits at the bottom of. */
    for (const [name, value] of [
      ["--z-raised", 10],
      ["--z-header", 200],
      ["--z-modal", 500],
    ] as const) {
      expect(globals).toMatch(new RegExp(`${name}:\\s*${value};`));
    }
  });

  it("renders behind the home hero inside a layer that is itself pointer-inert", () => {
    expect(home).toMatch(/\.fieldLayer \{[^}]*z-index:\s*0/);
    expect(home).toMatch(/\.fieldLayer \{[^}]*pointer-events:\s*none/);
    expect(home).toMatch(/\.scanDock \{[^}]*z-index:\s*0/);
    /* The masthead, the file index and the signal rail all sit above it. */
    expect(home).toMatch(/\.masthead \{[^}]*z-index:\s*10/);
    expect(home).toMatch(/\.fileIndex \{[^}]*z-index:\s*12/);
    expect(home).toMatch(/\.signalRail \{[^}]*z-index:\s*12/);
  });
});

describe("reduced motion composes a frame instead of freezing one", () => {
  const reduced = sections.slice(sections.indexOf("@media (prefers-reduced-motion: reduce)"));

  it("exists, and is not scoped to a page, a family or a speed", () => {
    expect(reduced.length).toBeGreaterThan(0);
    /* `.row`, bare: the home band carries `speed="slow"`, so a rule written
       against `[data-speed="still"]` alone would leave it drifting. */
    expect(reduced).toMatch(/^\s*\.row \{/m);
  });

  it("switches off every drift animation the module defines", () => {
    /* The only two infinite animations on a row. */
    const drifts = [...sections.matchAll(/animation:\s*(drift\w+)\s/g)].map(([, name]) => name);
    expect(new Set(drifts)).toEqual(new Set(["driftRight", "driftLeft"]));
    expect(reduced).toMatch(/\.row \{\s*animation:\s*none;/);
    expect(sections).toMatch(/\.backdrop\[data-speed="still"\] \.row \{\s*animation:\s*none;/);
  });

  it("stands each row at its own sampled rest position", () => {
    expect(reduced).toMatch(/transform:\s*translateX\(calc\(\(100vw - 100%\) \* var\(--rest, 0\) \/ 100\)\)/);
    /* The rest position is sampled per row on the server, not zero. */
    expect(backdropSource).toMatch(/rest:\s*\(rng\(\) \* 100\)\.toFixed\(1\)/);
    expect(backdropSource).toMatch(/'--rest' as string\]:\s*row\.rest/);
  });

  it("steps the loud rows back to the dim colour of their stream", () => {
    expect(reduced).toMatch(/\.rowLoud\.rowVerified \{ color: var\(--data-blue-dim\); \}/);
    expect(reduced).toMatch(/\.rowLoud\.rowHostile \{ color: var\(--data-ember-dim\); \}/);
  });

  it("leaves the home band still as well, from both directions", () => {
    /* The band's own dock stops the drift once the field owns the screen; the
       media query above stops it for a reader who asked for stillness. */
    expect(home).toMatch(
      /\.fieldLayer:has\(\[data-engine-ready\]\) \.scanDock \*\s*\{\s*animation-play-state:\s*paused/,
    );
    expect(HOME_SCAN_PROFILE.density).toBe("low");
    expect(["slow", "still"]).toContain(HOME_SCAN_PROFILE.speed);
  });
});

describe("composited contrast — the scan against real content, not the hero title", () => {
  it("reads its constants out of the stylesheet rather than restating them", () => {
    expect(ROW_OPACITY_CEILING).toBeCloseTo(0.34, 5);
    expect(MASK_DIM).toBeCloseTo(0.25, 5);
    expect(registerMultiplier("surfaceQuiet")).toBeCloseTo(0.7, 5);
    expect(registerMultiplier("registerMuted")).toBeCloseTo(0.45, 5);
    /* The brightest thing the backdrop paints is a loud verified row, in
       `--ink`. Every threshold below is computed against that row. */
    expect(sections).toMatch(/\.rowLoud\.rowVerified \{ color: var\(--ink\); \}/);
  });

  /**
   * Reading routes. Every surface a reader reads sits inside `--content-w`:
   * `.withRails` widens the mask over both rails at the 1220px breakpoint, and
   * below it the rails are `display: none` and everything is in the measure
   * column. So the masked composite is the one that has to clear AA.
   */
  it.each([
    ["desk", FAMILY_SCAN_PROFILES.desk.intensity],
    ["dossier", FAMILY_SCAN_PROFILES.dossier.intensity],
    ["institution", FAMILY_SCAN_PROFILES.institution.intensity],
  ])("keeps body, caption and metadata text at AA on the %s family", (_family, intensity) => {
    const { rgb } = scannedBackground({ intensity, masked: true, ground: GROUND_PEAK });
    /* `--ink-lo` is the binding token: captions, `.tocLink`, `.tocNumber`,
       `.sideRailInner dt`, at `--t-caption` and `--t-data`, so 4.5 and not 3. */
    expect(contrastRatio(INK_LO, rgb)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(INK, rgb)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(INK_HI, rgb)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(GOLD, rgb)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("keeps an input's control boundary at 3:1 against the surround it sits in", () => {
    /* `--control-line` is `rgba(246, 243, 235, 0.4)` over the field's own
       `--surface-2`; the scan is outside the field, in what surrounds it. */
    const border = composite([246, 243, 235], 0.4, token("--surface-2"));
    for (const intensity of [
      FAMILY_SCAN_PROFILES.desk.intensity,
      FAMILY_SCAN_PROFILES.dossier.intensity,
      FAMILY_SCAN_PROFILES.institution.intensity,
    ]) {
      const { rgb } = scannedBackground({ intensity, masked: true, ground: GROUND_PEAK });
      expect(contrastRatio(border, rgb)).toBeGreaterThanOrEqual(AA_UI);
    }
  });

  /**
   * The home is the one route whose mask is narrower than its chrome:
   * `.scanDock` sets `--content-w` to the masthead's 48rem column, while
   * `.fileIndex` runs the full `--chrome-w` below it. So the eight file
   * numbers (`.fileNo`, `--ink-lo` at `--t-data`) meet the band unmasked.
   */
  it("keeps the home file index at AA against an unmasked band", () => {
    const { rgb } = scannedBackground({
      intensity: HOME_SCAN_PROFILE.intensity,
      masked: false,
      ground: GROUND_EDGE,
    });
    expect(contrastRatio(INK_LO, rgb)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(INK, rgb)).toBeGreaterThanOrEqual(AA_BODY);

    const masthead = scannedBackground({
      intensity: HOME_SCAN_PROFILE.intensity,
      masked: true,
      ground: GROUND_PEAK,
    });
    expect(contrastRatio(INK_HI, masthead.rgb)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("holds AA on every page dimmer a family profile can stack with", () => {
    for (const intensity of Object.values(FAMILY_SCAN_PROFILES).map((p) => p.intensity)) {
      for (const register of [1, registerMultiplier("surfaceQuiet"), registerMultiplier("registerMuted")]) {
        const { rgb } = scannedBackground({ intensity, register, masked: true, ground: GROUND_PEAK });
        expect(contrastRatio(INK_LO, rgb), `intensity ${intensity} register ${register}`)
          .toBeGreaterThanOrEqual(AA_BODY);
      }
    }
  });

  /**
   * The floor of the range, recorded rather than enforced. A muted
   * institution page composites at 0.046 unmasked and 0.011 through the mask —
   * deliberately close to nothing, and the Phase E report flagged it as such.
   * This pins that it is the faintest combination the map can produce, so a
   * future edit that makes something quieter still has to say so here.
   */
  it("records the faintest combination the map can produce", () => {
    const faintest = scannedBackground({
      intensity: FAMILY_SCAN_PROFILES.institution.intensity,
      register: registerMultiplier("registerMuted"),
      masked: false,
      ground: GROUND_EDGE,
    });
    expect(faintest.alpha).toBeCloseTo(0.046, 3);
    for (const profile of [...Object.values(FAMILY_SCAN_PROFILES), HOME_SCAN_PROFILE]) {
      expect(profile.intensity).toBeGreaterThanOrEqual(
        FAMILY_SCAN_PROFILES.institution.intensity,
      );
    }
  });

  /**
   * The guard the whole file exists for. These are the effective opacities the
   * audit measured against; a profile raised past them puts `--ink-lo` under
   * 4.5:1 somewhere a reader reads, so the number moves only with a new
   * measurement in this file.
   */
  it("pins the audited effective opacities", () => {
    /* A hair of tolerance, because 0.34 × 0.45 is 0.15300000000000002. */
    const effective = (intensity: number) => ROW_OPACITY_CEILING * intensity - 1e-9;
    expect(effective(FAMILY_SCAN_PROFILES.desk.intensity)).toBeLessThanOrEqual(0.17);
    expect(effective(FAMILY_SCAN_PROFILES.dossier.intensity)).toBeLessThanOrEqual(0.153);
    expect(effective(FAMILY_SCAN_PROFILES.institution.intensity)).toBeLessThanOrEqual(0.102);
    expect(effective(HOME_SCAN_PROFILE.intensity)).toBeLessThanOrEqual(0.102);
  });
});

describe("no interaction on or behind the scan depends on hover alone", () => {
  it("pairs every hover state in the reading shell with focus-visible or a static one", () => {
    /* The rails and the table of contents are the only interactive things the
       backdrop sits behind; each hover rule is a colour delta over a state
       that is already legible, and focus is drawn by the global
       `:focus-visible` outline plus these. */
    expect(sections).toMatch(/\.tocSheetLink:hover,\s*\.tocSheetLink:active,\s*\.tocSheetLink:focus-visible/);
    expect(sections).toMatch(/\.tocSheetLink:focus-visible,\s*\.tocSheetLinkActive:focus-visible/);
    expect(sections).toMatch(/\.page a:focus-visible/);
    expect(globals).toMatch(/:focus-visible \{\s*outline:\s*var\(--focus-outline\)/);
  });

  it("keeps the home's hover-only flourishes inside a hover media query, focus included", () => {
    const hoverOnly = home.slice(home.indexOf("@media (hover: hover)"));
    expect(hoverOnly).toMatch(/prefers-reduced-motion: no-preference/);
    expect(hoverOnly).toMatch(/:hover:not\(\[aria-disabled="true"\]\)::before,\s*[\s\S]*?:focus-visible::before/);
    /* Both hero links change colour on focus as well as on hover. */
    expect(home).toMatch(/\.fileLink:hover,\s*\.fileLink:focus-visible/);
  });
});

describe("the no-JavaScript home still shows a readable band over the static ground", () => {
  const page = read("app/page.tsx");

  it("lifts the server's intro-pending claim so the band is not hidden forever", () => {
    expect(page).toMatch(/<noscript>[\s\S]*?\[data-home-scan\] \{ display: block !important; \}/);
    expect(home).toMatch(
      /html:has\(\[data-intro-pending\], \[data-intro-active\], \[data-handoff-blocked\]\) \.scanDock \{\s*display: none;/,
    );
  });

  it("keeps the static --scan-ground under it, so no state is a bare screen", () => {
    expect(home).toMatch(/\.fallbackField \{[^}]*background-image:\s*var\(--scan-ground\)/);
    expect(globals).toMatch(/background-image:\s*var\(--scan-ground\)/);
  });

  it("renders the hero's links, index and rail as server HTML", () => {
    expect(page).toMatch(/<nav id="home-files"/);
    expect(page).toMatch(/SITE_NAVIGATION\.map/);
    expect(page).toMatch(/<h1 id="home-wordmark"/);
    /* The signal rail has its own opaque surface, so the band never
       composites behind the one piece of live copy on the screen. */
    expect(home).toMatch(/\.signalRail \{[^}]*background:\s*var\(--surface-1\)/);
  });
});
