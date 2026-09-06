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
  /* 34 → 33 on 2026-09-05: `app/particle-demo/` went with the particle
     subsystem. 33 → 35 on 2026-09-06: the Premium Editorial pass added
     `app/people-of-israel/page.tsx` and `app/fake-resistance/antisemitism/page.tsx`.
     Nothing else changed.

     Noted rather than fixed: this test asserts a count and names no route, so
     its only possible failure message is "update the number" — which is what
     just happened. Asserting the sorted list instead would make the diff name
     the route that arrived or left. That is a change to the test's shape, not
     to this retirement, so it is left for its own pass. */
  it("still has 35 App Router page.tsx patterns", () => {
    const pages = walkPages(path.join(ROOT, "app")).sort();
    expect(pages).toHaveLength(35);
  });
});
