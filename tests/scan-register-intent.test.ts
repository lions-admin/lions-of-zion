import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * VA-59 — the signal aesthetic used intentionally rather than universally.
 *
 * The audit asked for strong scan on Fake Resistance, Information War and
 * selected investigations, and for it reduced on calm editorial and trust
 * surfaces. The distribution was the **inverse** of that: the Fake Resistance
 * hub, Information War, October 7 and the news desk all ran `silent`, while
 * We Are ran at full family strength and Methodology, Corrections, the People
 * hub and every article ran `muted`.
 *
 * A page whose whole job is to be believed should not be the loudest one. These
 * pin the calm half, which is the half that was actively wrong.
 *
 * The loud half is deliberately not asserted here: turning the scan back on
 * over Fake Resistance and Information War is a visible change to pages that
 * were silenced on purpose, and it needs a look rather than a regex.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("trust surfaces do not carry the scan", () => {
  it.each([
    ["app/we-are/page.tsx", "We Are"],
    ["app/methodology/page.tsx", "Methodology"],
    ["app/corrections/page.tsx", "Corrections"],
  ])("%s runs silent", (path) => {
    expect(read(path)).toMatch(/register="silent"/);
  });

  it("We Are no longer runs at full family strength", () => {
    const page = read("app/we-are/page.tsx");
    expect(page).not.toMatch(/<SectionPage id="we-are" surface=/);
  });
});

describe("the People family is calm", () => {
  it.each(["app/people-of-israel/page.tsx", "app/our-heroes/page.tsx"])(
    "%s runs silent",
    (path) => {
      expect(read(path)).toMatch(/register="silent"/);
      expect(read(path)).not.toMatch(/register="muted"/);
    },
  );
});

describe("an article's backdrop follows what the record is", () => {
  const page = read("app/articles/[publicId]/page.tsx");

  it("derives the register instead of giving every record the same one", () => {
    // The same predicate that gates the investigation staging, so a section
    // that changes desk changes its backdrop with it.
    expect(page).toMatch(
      /register=\{publicationSupportsInvestigationExplorer\(article\.section\) \? "muted" : "silent"\}/,
    );
  });

  it("keeps no hand-written section list in the article file", () => {
    expect(page).not.toMatch(/register="muted"/);
  });
});

describe("the documented opacity ceiling matches the stylesheet", () => {
  it("says 0.1, which is what the CSS actually multiplies by", () => {
    const css = read("components/sections/sections.module.css");
    const match = css.match(/opacity:\s*calc\(([\d.]+)\s*\*\s*var\(--register/);
    expect(match?.[1]).toBe("0.1");

    // The profile file's own comments claimed 0.34 in two places.
    const profiles = read("components/sections/scanProfiles.ts");
    expect(profiles).not.toContain("0.34");
    expect(profiles).toContain("(0.1)");
  });
});
