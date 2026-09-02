/**
 * The cascade contract between `app/globals.css` and `app/tailwind.css`.
 *
 * CSS layers decide who wins before specificity is consulted, and this project
 * depends on that in BOTH directions. Each half of the contract has a failure
 * mode that is silent — the build stays green and the site looks wrong — which
 * is why they are pinned here rather than left to review.
 *
 * Verified empirically against the built CSS on 2026-09-02: the reset resolves
 * to @layer base, the generated utilities to @layer utilities, and both the
 * focus ring and the intro scroll lock to no layer at all.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (file: string) => readFile(path.join(ROOT, file), "utf8");

describe("the Tailwind cascade contract", () => {
  it("declares the layer order before any rule, in both stylesheets", async () => {
    for (const file of ["app/globals.css", "app/tailwind.css"]) {
      const css = await read(file);
      const statement = css.indexOf("@layer theme, base, components, utilities;");
      expect(
        statement,
        `${file} lost its @layer order statement. Layer order is fixed at first ` +
          "appearance and Next warns CSS order can differ between dev and build, " +
          "so each file must declare it independently.",
      ).toBeGreaterThan(-1);
      const firstRule = css.search(/^[^\s@/*][^\n]*\{/m);
      if (firstRule !== -1) {
        expect(
          statement,
          `${file} declares a rule before the @layer statement`,
        ).toBeLessThan(firstRule);
      }
    }
  });

  it("keeps every element default inside @layer base", async () => {
    const css = await read("app/globals.css");
    const first = css.indexOf("@layer base {");
    expect(
      first,
      "the element reset left @layer base. Unlayered CSS beats every layer at " +
        "any specificity, so `* { margin: 0 }` outside a layer kills every m-*/p-* " +
        "utility in every Magic UI component — they render with correct colour " +
        "and no layout at all.",
    ).toBeGreaterThan(-1);

    // The reset itself, and the element defaults, are both inside base blocks.
    expect(css.slice(first)).toContain("box-sizing: border-box");
    for (const selector of ["h1, h2, h3, h4, h5, h6", "img, video", "button, input, select, textarea"]) {
      const at = css.indexOf(selector);
      expect(at, `${selector} is missing`).toBeGreaterThan(-1);
      const opened = css.lastIndexOf("@layer base {", at);
      const closed = css.lastIndexOf("\n}", at);
      expect(
        opened > closed,
        `${selector} is no longer inside @layer base — it will defeat the ` +
          "corresponding Tailwind utility",
      ).toBe(true);
    }
  });

  it("keeps the intro scroll lock and the focus ring unlayered", async () => {
    const css = await read("app/globals.css");
    for (const selector of ["html:has([data-intro-active])", ":focus-visible {"]) {
      const at = css.indexOf(selector);
      expect(at, `${selector} is missing`).toBeGreaterThan(-1);
      const opened = css.lastIndexOf("@layer base {", at);
      const closed = css.lastIndexOf("\n}", at);
      expect(
        opened < closed,
        `${selector} moved into a layer. The intro lock would then be outranked ` +
          "by every CSS Module and a 47-second cinematic becomes scrollable; the " +
          "focus ring would be removable by any registry component shipping " +
          "focus-visible:outline-none.",
      ).toBe(true);
    }
  });

  it("never imports Preflight and never marks utilities important", async () => {
    const css = await read("app/tailwind.css");
    // Matches an actual import, not the prose explaining why there isn't one.
    expect(
      css,
      "Preflight is back. It injects a second reset plus " +
        "h1{font-size:inherit} and button{background:transparent}, which erase " +
        "the V3 type scale and button.module.css's five variants.",
    ).not.toMatch(/@import\s+["'][^"']*preflight/i);
    expect(
      css,
      "the utilities layer is marked `important`. A layered !important beats an " +
        "unlayered one, so every animate-* utility would defeat the " +
        "prefers-reduced-motion kill-switch in globals.css.",
    ).not.toMatch(/utilities\.css[^;]*important/);
  });
});
