import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/**
 * Comments are prose and prose quotes markup; they are stripped before
 * anything is compared.
 */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("shell landmarks (NAV-005)", () => {
  it("keeps one main, the masthead ahead of it, the colophon behind", () => {
    const source = stripComments(readFileSync(path.join(ROOT, "components/site/EditorialShell.tsx"), "utf8"));
    const render = source.slice(source.lastIndexOf("return ("));
    const headerAt = render.indexOf("<SiteHeader");
    const mainAt = render.indexOf("<main");
    const footerAt = render.indexOf("<SiteFooter");
    expect(headerAt).toBeGreaterThan(-1);
    expect(headerAt).toBeLessThan(mainAt);
    expect(mainAt).toBeLessThan(footerAt);
    expect(render.match(/<main/g)?.length).toBe(1);
    expect(render).not.toContain("Skip to content");
  });

  it("the skip link is the masthead's own first element, aimed at #page-content", () => {
    /* 2026-09-16: the skip link moved into `SiteHeader`, so the routes that
       mount the header directly — the cover, the error boundary — carry it
       too, and a page renders exactly one. The value pinned here is
       unchanged: it is the first thing a keyboard reaches, ahead of every
       control in the bar, and it lands on `#page-content`, the same anchor
       the colophon's "Back to the top" uses. */
    const source = stripComments(readFileSync(path.join(ROOT, "components/site/SiteHeader.tsx"), "utf8"));
    const render = source.slice(source.lastIndexOf("return ("));
    const skipAt = render.indexOf("Skip to content");
    const barAt = render.indexOf('className={styles.bar}');
    expect(skipAt).toBeGreaterThan(0);
    expect(skipAt).toBeLessThan(barAt);
    expect(render).toContain('href="#page-content"');
  });

  it("renders no SiteHeader after <main in any file", () => {
    /* `<header>` maps to the banner landmark only outside `main`, so a
       masthead mounted inside the document is not chrome to a screen reader —
       it is part of the article. `EditorialShell` and both error boundaries
       are siblings-shaped; this walks every file and fails the next one that
       is not. */
    const offenders = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "components"))]
      .map((file) => ({ file: path.relative(ROOT, file), source: stripComments(readFileSync(file, "utf8")) }))
      .filter(({ source }) => source.includes("<SiteHeader") && source.includes("<main"))
      .filter(({ source }) => {
        const headerAt = source.indexOf("<SiteHeader");
        const mainAt = source.indexOf("<main");
        return headerAt > mainAt;
      });
    expect(offenders.map((offender) => offender.file)).toEqual([]);
  });

  it("keeps root document language English", () => {
    const layout = readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
    expect(layout).toMatch(/lang=["']en["']/);
  });
});
