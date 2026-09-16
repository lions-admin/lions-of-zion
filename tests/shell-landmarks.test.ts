import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

describe("shell landmarks (NAV-005)", () => {
  it("keeps the skip link first in the masthead, targeting #page-content", () => {
    /* The skip link moved from EditorialShell into SiteHeader on 2026-09-15 so
       that every route mounting the header — the root error boundary, the
       404 and the cover included — ships the same control. It has to be the
       header's first child: the first thing a keyboard reaches on any page. */
    const source = read("components/site/SiteHeader.tsx");
    const render = source.slice(source.lastIndexOf("return ("));
    const headerAt = render.indexOf("<header");
    const skipAt = render.indexOf("Skip to content");
    const barAt = render.indexOf("styles.bar}");
    expect(headerAt).toBeGreaterThan(0);
    expect(skipAt).toBeGreaterThan(headerAt);
    expect(skipAt).toBeLessThan(barAt);
    expect(render).toContain('href="#page-content"');
  });

  it("keeps the masthead, a single main and the colophon as siblings in EditorialShell", () => {
    const source = read("components/site/EditorialShell.tsx");
    const render = source.slice(source.lastIndexOf("return ("));
    const headerAt = render.indexOf("<SiteHeader");
    const mainAt = render.indexOf("<main");
    const footerAt = render.indexOf("<SiteFooter");
    expect(headerAt).toBeGreaterThan(0);
    expect(headerAt).toBeLessThan(mainAt);
    expect(mainAt).toBeLessThan(footerAt);
    expect(render.match(/<main/g)?.length).toBe(1);
    expect(render).not.toContain("Skip to content");
  });

  it("never mounts the masthead inside main on any route", () => {
    /* `<header>` is the banner landmark only when it is not inside `main`;
       the root error boundary rendered it there until 2026-09-15. */
    for (const rel of ["app/error.tsx", "app/not-found.tsx", "app/page.tsx", "app/articles/[publicId]/error.tsx"]) {
      const source = read(rel);
      const headerAt = source.indexOf("<SiteHeader");
      /* The JSX element, not a `<main>` mentioned in a comment. */
      const mainAt = source.search(/<main(\s)/);
      if (headerAt === -1) continue;
      expect(headerAt, `${rel}: the masthead precedes main`).toBeLessThan(mainAt);
      expect(source, `${rel}: no second skip link`).not.toContain("Skip to content");
    }
  });

  it("keeps root document language English", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toMatch(/lang=["']en["']/);
  });
});
