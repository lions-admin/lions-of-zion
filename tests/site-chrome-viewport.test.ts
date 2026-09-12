import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Two defects VA-04 found in the site chrome, pinned so they cannot come back.
 *
 * **VA-45 — a landscape phone was served the desktop mega-panel.** The
 * navigation seam was width-only (`max-width: 45rem`), and a phone on its side
 * is 812 or 932 CSS pixels wide, so it read as a small tablet: the wide
 * `filesPanel` opened into 298px of remaining height as a two-column contact
 * sheet with 29px titles, while the `<dialog>` drawer built for exactly that
 * reader stayed `display: none`. The real distinction is not "narrow", it is
 * "a handheld with little vertical room" — a coarse primary pointer and a
 * short viewport — so that is what the seam must say.
 *
 * **VA-41 — `viewport-fit=cover` was missing.** Without it Next emits
 * `width=device-width, initial-scale=1`, `env(safe-area-inset-*)` resolves to
 * `0` on iOS, and the sixteen safe-area rules this build ships across eight
 * CSS modules are inert. The chrome's own two are pinned here: a *horizontal*
 * inset is non-zero only in landscape, where a phone is 812-932px wide, so a
 * horizontal safe-area rule scoped inside a phone-width query is scoped to the
 * one case where it can never fire. `site-header`'s was, for exactly that
 * reason — `@media (max-width: 48rem)` on `.header[data-home] .bar`.
 *
 * These are text assertions on source, not rendered pixels. They are a floor:
 * the rendered behaviour is measured in a browser, and the iOS half of VA-41
 * is settled on a device by VA-39.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

/**
 * Comments are stripped before anything is asserted. These two stylesheets
 * carry long design notes that quote the very things being looked for — the
 * landscape-phone pixel counts, `env(safe-area-inset-*)`, `@media` preludes —
 * so a test reading the raw text would be reading prose, not rules.
 */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const header = stripComments(read("components/site/site-header.module.css"));
const footer = stripComments(read("components/site/site-footer.module.css"));
const layout = read("app/layout.tsx");

/**
 * Splits a stylesheet into `{ prelude, body }` for every top-level `@media`,
 * plus the text that sits outside all of them. Brace-counting rather than a
 * regex, because these blocks nest.
 */
function mediaBlocks(css: string): { prelude: string; body: string }[] {
  const out: { prelude: string; body: string }[] = [];
  let i = 0;
  while ((i = css.indexOf("@media", i)) !== -1) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const prelude = css.slice(i + "@media".length, open).trim();
    let depth = 0;
    let end = open;
    for (; end < css.length; end++) {
      if (css[end] === "{") depth++;
      else if (css[end] === "}" && --depth === 0) break;
    }
    out.push({ prelude, body: css.slice(open + 1, end) });
    i = end + 1;
  }
  return out;
}

/** The stylesheet with every top-level `@media` block removed. */
function baseScope(css: string): string {
  let out = css;
  for (const block of mediaBlocks(css)) {
    out = out.replace(`{${block.body}}`, "{}");
  }
  return out;
}

describe("VA-45 — the phone seam is a pointer and a height, not only a width", () => {
  it("shows the drawer trigger on a short coarse-pointer viewport", () => {
    // The rule that swaps the desktop panel for the <dialog> sheet.
    const swap = mediaBlocks(header).filter((b) =>
      /\.header\s+\.menuTrigger\s*\{\s*display:\s*inline-flex/.test(b.body),
    );
    expect(swap.length, "one block owns the drawer/sheet swap").toBe(1);

    const prelude = swap[0].prelude;
    // Still turns on the canonical narrow seam...
    expect(prelude).toMatch(/max-width:\s*45rem/);
    // ...and additionally on a handheld held sideways.
    expect(prelude).toMatch(/max-height:\s*\d+(\.\d+)?rem/);
    expect(prelude).toMatch(/pointer:\s*coarse/);
    // The two extra terms are one condition (AND), OR-ed with the width seam.
    // A bare `max-height` would take short desktop windows with it.
    expect(prelude).toMatch(/max-height:[^,]*\band\b[^,]*pointer:\s*coarse/);
  });

  it("hides the wide files panel in the same block", () => {
    const swap = mediaBlocks(header).find((b) =>
      /\.header\s+\.menuTrigger\s*\{\s*display:\s*inline-flex/.test(b.body),
    )!;
    expect(swap.body).toMatch(/\.filesPanel\s*\{\s*display:\s*none/);
    expect(swap.body).toMatch(/\.header\s+\.filesTrigger\s*\{\s*display:\s*none/);
  });

  it("keeps Support Us in the bar on a phone (owner ruling, 2026-09-11)", () => {
    // Support Us used to be grouped with the Files trigger and dropped here.
    // It now stays at every width: the word goes screen-reader-only below
    // 45rem and a 44px gold-outlined glyph carries it.
    const swap = mediaBlocks(header).find((b) =>
      /\.header\s+\.menuTrigger\s*\{\s*display:\s*inline-flex/.test(b.body),
    )!;
    expect(swap.body).not.toMatch(/\.support\s*[,{][^}]*display:\s*none/);
    const phone = mediaBlocks(header).find(
      (b) => /max-width:\s*45rem/.test(b.prelude) && /\.supportLabel\s*\{/.test(b.body),
    );
    expect(phone, "a 45rem block makes the Support label screen-reader-only").toBeTruthy();
    expect(phone!.body).toMatch(/\.supportLabel\s*\{[^}]*clip-path:\s*inset\(50%\)/);
    expect(phone!.body).toMatch(/\.support\s*\{[^}]*min-inline-size:\s*var\(--control-h-coarse\)/);
  });

  it("clears every phone in landscape and no tablet in either orientation", () => {
    const swap = mediaBlocks(header).find((b) =>
      /\.header\s+\.menuTrigger\s*\{\s*display:\s*inline-flex/.test(b.body),
    )!;
    const rem = Number(/max-height:\s*(\d+(?:\.\d+)?)rem/.exec(swap.prelude)![1]);
    const px = rem * 16;
    // The largest phone short side in service (iPhone 15 Pro Max landscape).
    expect(px).toBeGreaterThan(440);
    // The smallest tablet short side (iPad mini portrait is 744; iPad is 768).
    expect(px).toBeLessThan(744);
  });

  it("carries no device-specific hack", () => {
    // A seam keyed to one handset's pixel count, or to a user-agent, is the
    // thing VA-45 explicitly forbids.
    expect(header).not.toMatch(/\b(812|932|844|926|896)px\b/);
    expect(header).not.toMatch(/-webkit-device-pixel-ratio|device-width:|orientation:\s*landscape/);
  });

  it("keeps the sheet's descriptions in the accessibility tree when it tightens", () => {
    // `Dialog` wires the sheet's description to `aria-describedby`, and each
    // link's description is part of that link's accessible name. A short
    // viewport may clip them; it may not `display: none` them.
    const short = mediaBlocks(header).filter(
      (b) => /max-height/.test(b.prelude) && /data-slot="header"\]\s*p/.test(b.body),
    );
    for (const block of short) {
      expect(block.body).not.toMatch(/data-slot="header"\]\s*p[\s\S]{0,200}display:\s*none/);
      expect(block.body).toMatch(/clip-path:\s*inset\(50%\)/);
    }
  });
});

describe("VA-41 — safe-area insets are live, and the horizontal ones are reachable", () => {
  it("declares viewport-fit=cover on the root viewport export", () => {
    // Asserted on source rather than by importing the module: `app/layout.tsx`
    // pulls `next/font/google` and two stylesheets, neither of which loads in
    // a node test environment.
    const viewportExport = /export const viewport: Viewport = \{([\s\S]*?)\};/.exec(layout);
    expect(viewportExport, "app/layout.tsx exports a `viewport`").not.toBeNull();
    expect(viewportExport![1]).toMatch(/viewportFit:\s*"cover"/);
  });

  const horizontal = /env\(safe-area-inset-(left|right)/;

  it("reads the header's horizontal insets outside every width query", () => {
    // A left/right inset is non-zero only in landscape, where a phone is
    // 812-932px wide. Inside `@media (max-width: 48rem)` — where this rule
    // used to live — it could never fire.
    expect(baseScope(header)).toMatch(horizontal);
    for (const block of mediaBlocks(header)) {
      if (!horizontal.test(block.body)) continue;
      expect(
        block.prelude,
        `a horizontal safe-area rule is scoped to \`${block.prelude}\``,
      ).not.toMatch(/max-width/);
    }
  });

  it("reads the footer's horizontal insets outside every width query", () => {
    expect(baseScope(footer)).toMatch(horizontal);
    for (const block of mediaBlocks(footer)) {
      if (!horizontal.test(block.body)) continue;
      expect(block.prelude).not.toMatch(/max-width/);
    }
  });

  it("floors the horizontal gutters with max(), never calc(gutter + inset)", () => {
    // The gutter is a floor the sensor housing raises, not padding to add to.
    // `calc(x + env(…))` would push the chrome inwards twice on a notched
    // phone and, at a zero inset, is indistinguishable from `max()` — so the
    // mistake is invisible everywhere except the device it breaks.
    for (const css of [header, footer]) {
      for (const line of css.split("\n")) {
        if (!horizontal.test(line)) continue;
        expect(line, `\`${line.trim()}\` must floor, not add`).not.toMatch(
          /calc\([^)]*\+[^)]*env\(safe-area-inset-(left|right)/,
        );
        expect(line).toMatch(/max\(/);
      }
    }
  });

  it("gives every safe-area reference in the chrome a 0px fallback", () => {
    // `env(x)` with no fallback is an invalid declaration where `env()` is
    // unsupported, which silently drops the whole property.
    for (const css of [header, footer]) {
      for (const match of css.matchAll(/env\(safe-area-inset-[a-z]+([^)]*)\)/g)) {
        expect(match[1], `\`${match[0]}\` needs a fallback`).toMatch(/,\s*0px/);
      }
    }
  });

  it("keeps the footer's bottom inset, which is what clears the home indicator", () => {
    // The colophon is the last element on every route, so its bottom inset is
    // the only one on the page that sits against the screen edge.
    expect(footer).toMatch(/\.footer\s*\{[\s\S]*?env\(safe-area-inset-bottom/);
  });
});

/**
 * The two halves of the notch fix, pinned together.
 *
 * `viewport-fit=cover` lets the page paint under the status bar, and `.header`
 * is `position: fixed; inset: 0 0 auto`. Two lines keep the masthead out of the
 * sensor housing, and NEITHER WORKS ALONE:
 *
 *   1. `--header-h` carries the top inset, so the twelve files that offset
 *      content by it clear the whole bar.
 *   2. `.bar` pads its own top by the same amount, so with the global
 *      `box-sizing: border-box` the visible strip keeps its designed height
 *      instead of shrinking.
 *
 * Ship only (2) and the phone bar's readable strip drops from 56px to nine —
 * worse than the bug. Ship only (1) and the content sits under the notch,
 * which is the bug. This is the test that stops one of them being tidied away
 * on its own.
 */
describe("the safe-area pair is one change (VA-41)", () => {
  const globals = stripComments(read("app/globals.css"));

  it("carries the top inset in every --header-h definition", () => {
    const defs = [...globals.matchAll(/--header-h:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(defs.length, "expected a base value and a phone override").toBeGreaterThanOrEqual(2);
    for (const def of defs) {
      expect(def, `--header-h: ${def} must include the top inset`).toMatch(/env\(safe-area-inset-top,\s*0px\)/);
    }
  });

  it("pads the bar's own top by the same inset", () => {
    expect(header).toMatch(/\.bar\s*\{[\s\S]*?padding-top:\s*env\(safe-area-inset-top,\s*0px\)/);
  });

  it("only makes sense while viewport-fit=cover is declared", () => {
    // If cover is ever withdrawn, both halves become no-ops rather than
    // breakage — but the pairing above should be revisited deliberately, not
    // discovered. This assertion is what forces that.
    expect(layout).toMatch(/viewportFit:\s*["']cover["']/);
  });
});
