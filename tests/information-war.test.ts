import { readFileSync } from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import { createElement, type ReactElement } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InformationWarSystem } from "@/components/briefs/InformationWarSystem";

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
  it("keeps an intact accessible heading and its browser title", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    const h1 = html.match(/<h1[^>]*id="war-heading"[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1).not.toBeNull();
    const text = h1![1].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "");
    expect(text).toBe("This is an information war.");
    const page = readFileSync(path.join(ROOT, "app/information-war/page.tsx"), "utf8");
    expect(page).toContain('const TITLE = "This is an information war"');
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
    expect(html).toContain("Direct import");
    expect(html).toContain("does not run the same quality evaluator");
    expect(html).not.toContain("Online — public record readable");
    expect(html).not.toContain("all twelve checks");
  });

  it("offers explicit playback controls and respects motion and visibility changes", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    for (const name of ["Previous step", "Next step", "Pause journey"]) expect(html).toContain(name);
    const client = readFileSync(path.join(ROOT, "components/briefs/information-war/PipelineTrace.tsx"), "utf8");
    expect(client).toContain('prefers-reduced-motion: reduce');
    expect(client).toContain('preference.addEventListener("change", update)');
    expect(client).toContain('!document.hidden');
    expect(client).toContain('!playing || reduced || !visible');
    const css = readFileSync(path.join(ROOT, "components/briefs/information-war-system.module.css"), "utf8");
    expect(css.slice(css.indexOf("prefers-reduced-motion"))).toContain(".packet { display: none; }");
    expect(css).not.toMatch(/position:\s*(sticky|fixed)/);
    const dock = readFileSync(path.join(ROOT, "components/ask/ask.module.css"), "utf8");
    expect(dock).toContain('html:has([id="war-heading"]) .dockTrigger');
  });

  it("keeps real public destinations, with no pretend uptime claim", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    for (const href of ["/geopolitical-brief", "/fact-check", "/october-7", "/search", "/ask", "/support-us", "/methodology", "/corrections"]) {
      expect(html).toContain(`href="${href}"`);
    }
    expect(html).toContain("Publication dates, not job activity");
    expect(html).toContain("does not schedule the daily briefing route");
  });
});
