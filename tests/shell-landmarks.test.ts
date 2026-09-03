import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("shell landmarks (NAV-005)", () => {
  it("keeps the skip link first and a single main in EditorialShell", () => {
    const source = readFileSync(path.join(ROOT, "components/site/EditorialShell.tsx"), "utf8");
    const render = source.slice(source.lastIndexOf("return ("));
    const skipAt = render.indexOf("Skip to content");
    const headerAt = render.indexOf("<SiteHeader");
    const mainAt = render.indexOf("<main");
    const footerAt = render.indexOf("<SiteFooter");
    expect(skipAt).toBeGreaterThan(0);
    expect(skipAt).toBeLessThan(headerAt);
    expect(headerAt).toBeLessThan(mainAt);
    expect(mainAt).toBeLessThan(footerAt);
    expect(render.match(/<main/g)?.length).toBe(1);
    expect(render).toContain('href="#page-content"');
  });

  it("keeps root document language English", () => {
    const layout = readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
    expect(layout).toMatch(/lang=["']en["']/);
  });
});
