import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A root-level `app/loading.tsx` wraps *every* route in a Suspense boundary.
 * Streaming SSR then emits the real markup inside `<div hidden id="S:0">` for
 * an inline `$RC` script to reveal — so with scripting off the loading shell
 * stays and the page never appears. It was deleted for exactly that reason
 * (`.ai/DECISIONS.md`, 2026-08-26).
 *
 * `scripts/ci-smoke.mjs` proves the rendered result, but only once a server is
 * up. This is the cheap tripwire: it names the file and the reason in the
 * failure message, and it runs in milliseconds on any platform.
 */
const ROOT = process.cwd();
const exists = async (p: string) =>
  access(path.join(ROOT, p)).then(
    () => true,
    () => false,
  );

describe("the no-JavaScript invariant", () => {
  it("has no root-level loading.tsx", async () => {
    expect(
      await exists("app/loading.tsx"),
      "app/loading.tsx is back. A root Suspense boundary hides every route's " +
        "markup behind an inline script, so no page renders without JavaScript. " +
        "Scope loading state to its own segment instead — see CLAUDE.md.",
    ).toBe(false);
  });

  it("has no root-level template.tsx or default.tsx either", async () => {
    /* Same class of problem: both re-wrap the whole tree at the root. */
    for (const file of ["app/template.tsx", "app/default.tsx"]) {
      expect(await exists(file), `${file} re-wraps every route at the root`).toBe(false);
    }
  });
});
