import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  publicationHubCrumb,
  PUBLICATION_SECTION_LABELS,
  SECTIONS_BY_HOMEPAGE_SECTION,
} from "@/lib/publication-routing";

/**
 * VA-51 and VA-57 — a reader should be able to predict where a link goes.
 *
 * Three destinations answered to more than one name. `/information-war` had
 * three: "How it works" in the chrome, "This is an information war" in the tab,
 * "Why this work matters" on the homepage cover. `/fake-resistance` was spelled
 * two ways across its own sub-pages' breadcrumbs. And the article 404 pointed
 * at "Daily Brief", a section retired on 2026-09-05.
 *
 * The owner's ruling (2026-09-08) is that the menu label wins. These assert the
 * mechanism rather than the wording wherever they can: that labels are derived
 * from `lib/publication-routing.ts` instead of typed out, so the next rename
 * moves every surface at once.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("one destination, one name", () => {
  it("gives /information-war the chrome's name in its tab", () => {
    const page = read("app/information-war/page.tsx");
    expect(page).toMatch(/const TITLE = "How it works";/);
  });

  it("keeps the editorial headline as a headline rather than a name", () => {
    const page = read("app/information-war/page.tsx");
    // The sentence survives; it is simply no longer what the destination is called.
    expect(page).toMatch(/const HEADLINE = "This is an information war";/);
  });

  it("no longer offers a third name for it on the homepage cover", () => {
    const home = read("app/page.tsx");
    const markup = home.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(markup).not.toContain("Why this work matters");
    expect(markup).toContain("How it works");
  });
});

describe("breadcrumbs derive their hub instead of spelling it", () => {
  const pages = [
    "app/fake-resistance/watch/page.tsx",
    "app/fake-resistance/antisemitism/page.tsx",
    "app/fake-resistance/network/page.tsx",
    "app/fake-resistance/playbook/page.tsx",
    "app/fake-resistance/social-media/page.tsx",
    "app/fake-resistance/official-narrative/page.tsx",
    "app/fake-resistance/cases/[slug]/page.tsx",
  ];

  it.each(pages)("%s uses publicationHubCrumb", (path) => {
    const page = read(path);
    expect(page).toContain("publicationHubCrumb('fakeResistance')");
  });

  it("leaves no hand-written spelling of the hub in a breadcrumb", () => {
    for (const path of pages) {
      const page = read(path);
      expect(page).not.toMatch(/breadcrumb=\{\[\{ href: ['"]\/fake-resistance['"]/);
    }
  });

  it("names the hub once, in the routing map", () => {
    expect(publicationHubCrumb("fakeResistance")).toEqual({
      href: "/fake-resistance",
      label: "Fake Resistance",
    });
  });
});

describe("the article 404 no longer points at a retired section", () => {
  const page = read("app/articles/[publicId]/not-found.tsx");

  it("derives both routes out of it", () => {
    const markup = page.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(markup).toContain('publicationHubCrumb("news")');
    expect(markup).not.toContain("Daily Brief");
  });

  it("sends the reader to the desk that exists", () => {
    expect(publicationHubCrumb("news").label).toBe("News & Analysis");
  });
});

describe("the People hub derives its lanes", () => {
  const page = read("app/people-of-israel/page.tsx");

  it("reads the sections from the routing map, not a local list", () => {
    expect(page).toContain("SECTIONS_BY_HOMEPAGE_SECTION.people");
    expect(page).toContain("PUBLICATION_SECTION_LABELS");
  });

  it("covers every People section, so a new one cannot go unrendered", () => {
    // The old map was Partial<Record<…>>: a new section simply had no lane.
    for (const section of SECTIONS_BY_HOMEPAGE_SECTION.people) {
      expect(PUBLICATION_SECTION_LABELS[section]).toBeTruthy();
    }
  });

  it("no longer carries labels that diverge from the routing map", () => {
    // "Achievements" and "International Cooperation" were the drifted pair.
    const markup = page.replace(/\/\*\*[\s\S]*?\*\//g, "");
    expect(markup).not.toContain("'Achievements'");
    expect(markup).not.toContain("'International Cooperation'");
    expect(PUBLICATION_SECTION_LABELS.achievement).toBe("Israeli achievement");
    expect(PUBLICATION_SECTION_LABELS.international_cooperation).toBe("International cooperation");
  });
});

describe("Search and Ask are one name each, and different jobs", () => {
  const dock = read("components/ask/AskDock.tsx");
  const searchDialog = read("components/search/SearchDialog.tsx");

  it("drops the fifth name for the Ask destination", () => {
    const markup = dock.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    expect(markup).not.toContain("AI Chat");
    expect(markup).toContain('aria-label="Ask the desk"');
    expect(markup).toContain('title="Ask the desk"');
  });

  it("says outright that Ask is not a second search box", () => {
    expect(dock).toMatch(/Not a search box/i);
  });

  it("keeps the honest part of the retired label — that a machine answers", () => {
    // "AI Chat" carried that; the description has to carry it now.
    expect(dock).toMatch(/across what this desk has published/i);
    expect(dock).toMatch(/where there is no evidence, the answer says so/i);
  });

  it("has Search state retrieval and point at Ask for the other job", () => {
    expect(searchDialog).toMatch(/Find a published record/i);
    expect(searchDialog).toMatch(/ask the desk/i);
  });
});
