/**
 * The scan backdrop is retired, and this file is what keeps it retired.
 *
 * Until 2026-09-14 `EditorialShell` mounted `ScanBackdrop` behind every one of
 * the twenty public reading routes: sixteen rows of the monitoring corpus
 * (nine on a "muted" page), drifting left and right on 45–90 second infinite
 * loops, composited at an effective 0.05–0.0765 alpha. This file used to be
 * the contract for that layer — its profile map, its clamping, its
 * reduced-motion frame, its inertness.
 *
 * The owner ruled it off the reading pages. Three reasons, and any one of them
 * is sufficient:
 *
 *  1. it is what made a page read as dark-and-then-settling rather than simply
 *     rendered, and what left faint ghost text in the desktop margins;
 *  2. the corpus is *hostile* material — "ANTI ISRAEL NARRATIVE: …",
 *     "LIVE HASHTAG: #WarCrimes", "PROPAGANDA STREAM: the IDF kills
 *     civilians" — so the site was wallpapering itself in the messaging it
 *     exists to refute;
 *  3. it ran continuous compositing behind running text on every page.
 *
 * What is pinned here is the absence: no component, no profile map, no rows in
 * the stylesheet, and no route mounting one. A deliberate, readable,
 * non-ambient treatment of the same corpus on a page that is *about* the
 * phenomenon is a different thing and is not ruled out — what is ruled out is
 * an ambient layer behind a reader's text.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
/**
 * Comments stripped, always.
 *
 * Every rule here is about what the code does, and the prose that replaced
 * the retired code names it on purpose — a future reader has to be able to
 * find out what was there and why it went. Matching the source verbatim would
 * make those explanations fail the suite that depends on them.
 */
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (file: string) => strip(readFileSync(path.join(ROOT, file), "utf8"));
const exists = (file: string) => existsSync(path.join(ROOT, file));

const SHELLS = [
  "components/site/EditorialShell.tsx",
  "components/sections/SectionPage.tsx",
  "components/sections/DocPage.tsx",
  "components/briefs/LiveBriefHub.tsx",
];

/* Pages that used to be shells. `InformationWarSystem` built its own — a
   1320px private layout on `EditorialShell` — until 2026-09-16, when it moved
   onto `DocPage` like `/methodology` and `/corrections`. It reaches the chrome
   through that shell now, so it is checked for the backdrop's absence but not
   for a shell's mount. */
const PAGES_ON_A_SHELL = ["components/briefs/InformationWarSystem.tsx"];

describe("the ambient scan layer is gone from the source", () => {
  it("has no component and no profile map left to import", () => {
    expect(exists("components/sections/ScanBackdrop.tsx")).toBe(false);
    expect(exists("components/sections/scanProfiles.ts")).toBe(false);
  });

  it("is mounted by no shell and no page", () => {
    for (const file of [...SHELLS, ...PAGES_ON_A_SHELL]) {
      const source = read(file);
      expect(source, file).not.toMatch(/ScanBackdrop|scanProfileForRoute/);
    }
    expect(read("app/page.tsx")).not.toContain("ScanBackdrop");
    expect(read("app/layout.tsx")).not.toMatch(/ScanBackdrop|EditorialShell/);
  });

  it("every reading shell still reaches EditorialShell for its chrome", () => {
    for (const file of SHELLS.filter((f) => !f.endsWith("EditorialShell.tsx"))) {
      expect(read(file), file).toContain("<EditorialShell");
    }
    /* And a page that gave up its own shell reaches one of those instead,
       rather than growing a third layout of its own. */
    for (const file of PAGES_ON_A_SHELL) {
      expect(read(file), file).toMatch(/<(DocPage|SectionPage|LiveBriefHub)\b/);
    }
  });
});

describe("sections.module.css carries no drifting rows", () => {
  const css = read("components/sections/sections.module.css");

  it("defines neither the layer nor a row", () => {
    for (const selector of [".backdrop", ".rowField", ".row", ".rowHostile", ".rowVerified", ".rowLoud"]) {
      expect(css, selector).not.toMatch(new RegExp(`\\${selector}[\\s,{:]`));
    }
  });

  it("defines no drift keyframes and no scan controls", () => {
    expect(css).not.toMatch(/@keyframes drift(Left|Right)/);
    expect(css).not.toMatch(/--scan-(intensity|speed|tempo)/);
    expect(css).not.toMatch(/--content-w/);
  });

  /**
   * The general form of the rule, not just this one layer: nothing in the
   * reading shells may run an unattended animation behind the reader. The one
   * animation the module still declares is `rise`, a `both`-filled entrance
   * that runs once.
   */
  it("declares no infinite animation at all", () => {
    expect(css).not.toMatch(/animation:[^;]*\binfinite\b/);
    expect(css).toMatch(/animation:\s*rise var\(--dur-slow\)/);
  });
});

describe("the retired props are gone, not merely ignored", () => {
  /**
   * `register`, `backdropSeed` and `surface` existed only to aim the ambient
   * backdrop — which corpus sample it drew, how far it was dimmed, which mask
   * it used. They outlived it by a few hours: when the backdrop was deleted on
   * 2026-09-14 roughly fifteen route files still passed them, spread across
   * five parallel workstreams, so they were left accepted-and-ignored to keep
   * those files compiling. This block asserted that interim state.
   *
   * The sweep has since landed: every call site is gone and so are the props.
   * The assertion is therefore the stronger one — not "inert" but absent. A
   * prop that is merely ignored is an invitation to wire it back up, and the
   * page class it used to build is deleted, so a re-added `register` would
   * silently do nothing rather than fail.
   */
  const SHELLS = [
    "components/site/EditorialShell.tsx",
    "components/sections/SectionPage.tsx",
    "components/sections/DocPage.tsx",
  ];

  it("no shell declares a retired prop", () => {
    for (const file of SHELLS) {
      const source = read(file);
      for (const prop of ["backdropSeed", "register", "surface"]) {
        expect(source, `${file} still declares ${prop}`).not.toMatch(
          new RegExp(`\\b${prop}\\?:`),
        );
      }
    }
  });

  it("no route passes one", () => {
    /* `data-surface` is the admin palette hook and unrelated; PublicationSection
       has its own `surface` prop with different values. Both must survive. */
    const walk = (dir: string): string[] =>
      readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(rel);
        return entry.name.endsWith(".tsx") ? [rel] : [];
      });

    const offenders = ["app", "components"].flatMap(walk).filter((rel) => {
      const source = read(rel).replace(/data-surface/g, "");
      return /(?<![\w-])(register=|backdropSeed=|surface="(?:quiet|default)")/.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("neither shell builds a page class out of a retired dimmer", () => {
    for (const file of ["components/sections/SectionPage.tsx", "components/sections/DocPage.tsx"]) {
      const source = read(file);
      expect(source, file).not.toMatch(/styles\.(registerMuted|surfaceQuiet|withRails)/);
    }
  });
});
