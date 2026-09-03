import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A CSS Module reference that no rule defines is silently `undefined`.
 * `className={undefined}` renders nothing, so the element ships with no
 * styles at all — no clipping, no size, no colour — and neither TypeScript
 * nor ESLint says a word. It looks like working code in review.
 *
 * This has now shipped three times in this repository:
 *
 *   - `StructureListView` was written in full and mounted with 38 class names
 *     that did not exist, so the pipeline's mobile view rendered as unstyled
 *     text.
 *   - `PipelineCanvas` was refactored from `.interactiveCanvasContainer` to
 *     `.canvasViewport` without the rule being carried over. The pan/zoom
 *     stage lost `overflow: hidden` and `position: relative`, so a 2458px
 *     canvas plane spilled across the page and pushed every "Explain" button
 *     off-screen at 1024, 1440 and 1920 — visible in a browser only as the
 *     root's `overflow-x: clip` quietly swallowing it.
 *   - `AdminStatus` referenced five classes for its loading, error and table
 *     surfaces that were never written.
 *
 * Each was found by measuring, long after the code was committed and called
 * clean. So the contract is pinned here instead: every `styles.x` in a `.tsx`
 * must resolve to a `.x` in the stylesheet that file imports.
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function resolveImport(fromFile: string, spec: string): string {
  return spec.startsWith("@/")
    ? path.join(ROOT, spec.slice(2))
    : path.resolve(path.dirname(fromFile), spec);
}

/** Class names a stylesheet defines, including those only in a media query. */
function definedClasses(css: string): Set<string> {
  return new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
}

/**
 * Class names a component reads off its `styles` object, as `styles.foo` and
 * as `styles["foo"]`. Import statements are stripped first so the literal
 * `"./x.module.css"` in the import cannot be mistaken for a usage of `x`.
 */
function usedClasses(source: string, ident: string): Set<string> {
  const body = source.replace(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm, "");
  return new Set([
    ...[...body.matchAll(new RegExp(`\\b${ident}\\.([A-Za-z_][\\w]*)`, "g"))].map((m) => m[1]),
    ...[...body.matchAll(new RegExp(`\\b${ident}\\[["']([^"']+)["']\\]`, "g"))].map((m) => m[1]),
  ]);
}

describe("CSS Module contract", () => {
  it("resolves every styles.* reference to a rule in the imported stylesheet", () => {
    const files = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "components"))];
    const orphans: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const imports = [
        ...source.matchAll(/import\s+(\w+)\s+from\s+["']([^"']+\.module\.css)["']/g),
      ];
      for (const [, ident, spec] of imports) {
        const cssPath = resolveImport(file, spec);
        let css: string;
        try {
          css = readFileSync(cssPath, "utf8");
        } catch {
          orphans.push(`${path.relative(ROOT, file)} imports ${spec}, which does not exist`);
          continue;
        }
        const defined = definedClasses(css);
        for (const cls of usedClasses(source, ident)) {
          if (!defined.has(cls)) {
            orphans.push(
              `${path.relative(ROOT, file)}: ${ident}.${cls} has no rule in ${spec}`,
            );
          }
        }
      }
    }

    expect(orphans).toEqual([]);
  });
});
