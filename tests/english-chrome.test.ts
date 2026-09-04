import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const HEBREW = /[\u0590-\u05FF]/;
const ALLOWED_EXT = new Set([".tsx", ".ts", ".css"]);

function walk(dir: string, into: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "data") continue;
      walk(full, into);
      continue;
    }
    if (ALLOWED_EXT.has(path.extname(name))) into.push(full);
  }
  return into;
}

function isQuotedSourceSpan(lines: string[], index: number): boolean {
  const window = lines.slice(Math.max(0, index - 6), index + 1).join("\n");
  return /lang=["']he["']/.test(window);
}

describe("English product chrome", () => {
  it("does not load a Hebrew webfont and keeps root lang=en", () => {
    const layout = readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/IBM_Plex_Sans_Hebrew/);
    expect(layout).not.toMatch(/plex-sans-hebrew/);
    expect(layout).toMatch(/lang=["']en["']/);
  });

  it("has no Hebrew product-chrome strings under app/ and components/, outside the admin console", () => {
    const files = [
      ...walk(path.join(ROOT, "app")),
      ...walk(path.join(ROOT, "components")),
    ];
    const hits: string[] = [];
    for (const file of files) {
      const rel = path.relative(ROOT, file);
      if (rel.startsWith(`app${path.sep}api${path.sep}`)) continue;
      /* The operations console is the owner's own operating surface and reads
         in Hebrew; the public site does not. This carve-out is the boundary
         between those two facts, and it is deliberately narrow — everything
         a reader can reach without signing in is still held to English. */
      if (rel.startsWith(`app${path.sep}admin${path.sep}`)) continue;
      const text = readFileSync(file, "utf8");
      const lines = text.split(/\n/);
      lines.forEach((line, i) => {
        if (!HEBREW.test(line)) return;
        if (isQuotedSourceSpan(lines, i)) return;
        const trimmed = line.trim();
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*") ||
          trimmed.startsWith("{/*")
        ) {
          return;
        }
        hits.push(`${rel}:${i + 1}:${trimmed.slice(0, 120)}`);
      });
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
