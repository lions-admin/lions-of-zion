import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function walkPages(dir: string, into: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkPages(full, into);
      continue;
    }
    if (name === "page.tsx") into.push(path.relative(path.join(ROOT, "app"), full));
  }
  return into;
}

describe("route inventory (QA-001)", () => {
  it("still has 34 App Router page.tsx patterns", () => {
    const pages = walkPages(path.join(ROOT, "app")).sort();
    expect(pages).toHaveLength(34);
  });
});
