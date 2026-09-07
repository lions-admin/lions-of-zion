import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The retirement of the glass ramp (VA-29, VA-30).
 *
 * `app/globals.css` has said "Glass is a leftover HUD ramp… Do not add new
 * glass" since the V3 system landed, and the sentence had no enforcement
 * behind it, so the root error boundary — the one screen a reader reaches
 * because something already failed — went on drawing a three-stop gradient,
 * an inset highlight and a 16px backdrop blur long after every other surface
 * had become a flat plate with a hairline.
 *
 * These are source assertions rather than rendered ones, in the style of
 * `tests/support-surface.test.ts`: `tests/` runs in a node environment with
 * no DOM, so a stylesheet cannot be computed here. What they pin is the pair
 * of invariants whose breakage is silent — a token that contradicts the rule
 * written beside it, and a surface that quietly re-grows a retired visual
 * language.
 */
const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const SOURCE_ROOTS = ["app", "components"];
const listSources = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSources(rel);
    return /\.(ts|tsx|css)$/.test(entry.name) ? [rel] : [];
  });

/**
 * The two surfaces VA-30 could not reach, and the follow-up that must.
 *
 * Both were owned by other agents in the same working tree on the day VA-30
 * landed, and a token may not be deleted while a consumer still reads it, so
 * the `--glass-*` definitions stay in `app/globals.css` until this list is
 * empty. The follow-up task is: convert `search.module.css:46`
 * (`background: var(--glass-bottom)`) to a token surface, convert
 * `site-header.module.css:50,64` (`inset … var(--glass-inner)`) to
 * `--edge-hi`, correct the two prose comments that still describe the bar as
 * a `--glass-middle → --glass-bottom` gradient — `site-header.module.css:663`
 * and `components/sections/sections.module.css:114`, the latter being a
 * contrast argument that has to be re-reasoned rather than reworded — and
 * only then delete the eight `--glass-*` tokens from `app/globals.css`.
 *
 * Shortening this list is the task. Lengthening it is the regression.
 */
const GLASS_HOLDOUTS = [
  "components/search/search.module.css",
  "components/site/site-header.module.css",
];

/* A read of the ramp, not a mention of it. The historical comments in
   `app/error.tsx` and `components/sections/sections.module.css` name the
   tokens they stopped using, and a rule that forbade saying "glass" would
   push exactly that provenance out of the files. */
const READS_GLASS = /var\(\s*--glass-/;

describe("the glass ramp is retired, and cannot grow back (VA-30)", () => {
  const offenders = SOURCE_ROOTS.flatMap(listSources).filter(
    (rel) => READS_GLASS.test(read(rel)) && !GLASS_HOLDOUTS.includes(rel),
  );

  it("is read by nothing under app/ or components/ but the two known holdouts", () => {
    expect(
      offenders,
      "A --glass-* token may not be read by a new surface. globals.css says " +
        "'do not add new glass'; use a --surface-* ground, a --line hairline " +
        "and --edge-hi for a lit edge instead.",
    ).toEqual([]);
  });

  it("names holdouts that exist, so the list cannot go stale by rename", () => {
    /* A stale allow-list is how an assertion like this quietly stops
       asserting. Only existence is pinned here, deliberately: converting a
       holdout is the goal, and a test that went red when someone finally did
       it would be an argument against doing it. */
    for (const rel of GLASS_HOLDOUTS) {
      expect(existsSync(path.join(ROOT, rel)), `${rel} no longer exists`).toBe(true);
    }
  });

  it("keeps the tokens defined for exactly as long as something reads them", () => {
    /* Both halves of VA-30's rule, read off the tree rather than off the list
       above: a token may not be deleted while a consumer still reads it, and
       it may not linger once none does. */
    const remaining = SOURCE_ROOTS.flatMap(listSources).filter((rel) =>
      READS_GLASS.test(read(rel)),
    );
    const defined = /^\s*--glass-top:/m.test(read("app/globals.css"));
    expect(
      defined,
      remaining.length > 0
        ? "A token may not be deleted while a consumer still reads it: " +
          `${remaining.join(", ")} would fall back to an unset value.`
        : "Nothing reads --glass-* any more; delete the ramp from app/globals.css " +
          "and this whole describe block with it.",
    ).toBe(remaining.length > 0);
  });
});

describe("the root error boundary is drawn in the open editorial system (VA-30)", () => {
  const boundary = read("app/error.tsx");

  it("draws its card as a token ground and a token hairline, with no gradient", () => {
    expect(boundary).toContain("background-color: var(--surface-1);");
    expect(boundary).toContain("border: var(--line-w) solid var(--line);");
    /* The three retired decorations, by the property that carries each. A
       comment may still name them; a declaration may not. */
    const declarations = boundary
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("*") && !line.includes("/*"));
    expect(declarations.join("\n")).not.toMatch(/linear-gradient/);
    expect(declarations.join("\n")).not.toMatch(/backdrop-filter/);
    expect(declarations.join("\n")).not.toMatch(/inset 0 1px 0/);
  });

  it("stays self-contained, because it renders when the tree has already thrown", () => {
    /* The reason the styles are a `<style>` string and not a CSS Module is a
       loading argument: a Module is another chunk that can fail on the one
       route reached because something failed. VA-30 transcribed the secondary
       button rather than importing it, and that must not be "simplified". */
    expect(boundary).toContain("<style>");
    expect(boundary).not.toMatch(/from ['"].*\.module\.css['"]/);
  });

  it("keeps both recovery actions, at the 44px floor, with a focus ring", () => {
    /* STATE-003: `retry` when the runtime offers it, `reset` when it does
       not — a boundary whose button visibly does nothing is the defect. */
    expect(boundary).toContain("const recover = retry ?? reset;");
    expect(boundary).toContain("onClick={() => recover()}");
    expect(boundary).toContain('<Link href="/"');
    /* UX-CONTRACT touch floor: 2.75rem is 44px, on both controls. */
    expect(boundary.match(/min-height: 2\.75rem;/g)?.length).toBe(2);
    /* The ring itself is the global `:focus-visible` outline; this page only
       offsets it, so losing the offset rule loses the visible ring. */
    expect(boundary).toMatch(
      /\.loz-error-retry:focus-visible,\s*\n\s*\.loz-error-home:focus-visible \{\s*\n\s*outline-offset: 2px;/,
    );
  });

  it("does not restate the error copy, which is a trust surface", () => {
    expect(boundary).toContain("Transmission interrupted");
    expect(boundary).toContain("Signal dropped");
    expect(boundary).toContain("Re-establish signal");
    expect(boundary).toContain("← Back to the scan");
  });
});

describe("the radius scale is 4 / 6 / 8 / pill (VA-29)", () => {
  const globals = read("app/globals.css");

  it("caps the card radius at the 8px the rule beside it already required", () => {
    expect(globals).toContain("--radius-1: 4px;");
    expect(globals).toContain("--radius-2: 6px;");
    expect(globals).toContain("--radius-3: 8px;");
    expect(globals).toContain("--radius-pill: 999px;");
  });

  it("leaves no module re-literalising the 10px the token used to carry", () => {
    /* The point of moving the token rather than the twenty modules reading it
       is that they all tighten at once. A module that pins 10px back opts out
       of that, silently. */
    const offenders = SOURCE_ROOTS.flatMap(listSources).filter((rel) =>
      /border-(?:start-|end-)?[a-z-]*radius:[^;]*\b10px/.test(read(rel)),
    );
    expect(offenders).toEqual([]);
  });
});
