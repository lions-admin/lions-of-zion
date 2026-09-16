import { readFileSync } from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import { createElement, type ReactElement } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InformationWarSystem } from "@/components/briefs/InformationWarSystem";

/* The publication retry control is a client component that reads the App
   Router (`router.refresh()`), which does not exist in a bare server render.
   The mock stands in for the router only — the control's contract (a button
   that re-runs the failed read) is asserted by hand below where it matters. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {}, back: () => {}, prefetch: () => {} }),
}));

const ROOT = process.cwd();

/** Streams the full tree — the shell suspends, so legacy sync render can't. */
function renderFully(element: ReactElement): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = "";
    const sink = new Writable({
      write(chunk, _encoding, done) {
        html += String(chunk);
        done();
      },
      final(done) {
        resolve(html);
        done();
      },
    });
    const stream = renderToPipeableStream(element, {
      onAllReady() {
        stream.pipe(sink);
      },
      onError(error) {
        reject(error);
      },
    });
  });
}

describe("information war surface", () => {
  /* IW-002 asked that the browser tab and the visual heading read the same
     sentence, so a reader is never shown a name they did not click. VA-51
     narrowed it: the owner ruled on 2026-09-08 that the *menu label* is the
     destination's name, so the tab now agrees with the link that brought the
     reader here rather than with the headline. IW-002's purpose survives — the
     click and the tab match — and the headline stays a headline. Both halves
     are asserted here so neither can drift back alone. */
  it("keeps the editorial heading intact", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    const h1 = html.match(/<h1[^>]*id="war-heading"[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1).not.toBeNull();
    const text = h1![1].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "");
    expect(text).toBe("This is an information war.");
    const page = readFileSync(path.join(ROOT, "app/information-war/page.tsx"), "utf8");
    expect(page).toContain('const HEADLINE = "This is an information war"');
  });

  it("names the destination in the tab the way the menu names it", () => {
    const page = readFileSync(path.join(ROOT, "app/information-war/page.tsx"), "utf8");
    expect(page).toContain('const TITLE = "How it works"');
  });

  it("preserves the reading anchors and fixes the publication retry target", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    for (const id of ["page-content", "problem", "system", "cycle", "record", "activity"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("renders inspectable architecture and a no-animation reading alternative", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    expect((html.match(/aria-controls="node-inspector"/g) ?? []).length).toBe(9);
    expect(html).toContain("Read every journey without the animation");
    expect(html).toContain("Interactive explanation · not live telemetry");
    expect(html).toContain("Illustrative source relationship");
    expect(html).toContain("Machine-authored editorial run");
    expect(html).toContain("AI assists the work but is never evidence");
    expect(html).not.toContain("Online — public record readable");
    expect(html).not.toContain("all twelve checks");
  });

  it("offers explicit playback controls and respects motion and visibility changes", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    /* Restated 2026-09-17 for the paused default (workstream G): both step
       machines now render stopped, so the control a reader meets says
       "Play journey"; "Pause journey" is its own paused-state twin, one
       half of the same aria-label expression. The names are asserted from
       the *source* for the inactive label and from the HTML for the active
       one, so neither half of the toggle can drift away alone. */
    expect(html).toContain("Previous step");
    expect(html).toContain("Next step");
    expect(html).toContain("Play journey");
    const trace = readFileSync(path.join(ROOT, "components/briefs/information-war/PipelineTrace.tsx"), "utf8");
    expect(trace).toContain('"Pause journey"');
    expect(trace).not.toMatch(/useState\(true\)/);
    const client = readFileSync(path.join(ROOT, "components/briefs/information-war/PipelineTrace.tsx"), "utf8");
    expect(client).toContain('prefers-reduced-motion: reduce');
    expect(client).toContain('preference.addEventListener("change", update)');
    expect(client).toContain('!document.hidden');
    expect(client).toContain('!playing || reduced || !visible');
    const css = readFileSync(path.join(ROOT, "components/briefs/information-war-system.module.css"), "utf8");
    expect(css.slice(css.indexOf("prefers-reduced-motion"))).toContain(".packet { display: none; }");
    expect(css).not.toMatch(/position:\s*(sticky|fixed)/);
    /* The retry control re-runs the failed read with the App Router. */
    const retry = readFileSync(path.join(ROOT, "components/briefs/information-war/RetryRefresh.tsx"), "utf8");
    expect(retry).toContain("router.refresh()");
    /* The architecture diagram must not be covered by the Ask launcher. That
       was a per-page exception — `html:has([id="war-heading"]) .dockTrigger`
       pulled the fixed pill into the flow below 1100px — until 2026-09-08,
       when the launcher moved into the masthead on every route and stopped
       being fixed anywhere (UX-07). The invariant is the same; the mechanism
       is now that there is no floating launcher to make an exception for. */
    const dock = readFileSync(path.join(ROOT, "components/ask/ask.module.css"), "utf8");
    expect(dock).not.toMatch(/\.dockTrigger\s*\{[^}]*position:\s*fixed/);
  });

  it("keeps real public destinations, with no pretend uptime claim", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    for (const href of ["/geopolitical-brief", "/fact-check", "/october-7", "/search", "/ask", "/support-us", "/methodology", "/corrections"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("Publication dates, not job activity");
    expect(html).toContain("Machine-authored editorial runs are identified through machine provenance");
  });
});
