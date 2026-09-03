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

/**
 * `/information-war` invariants (IW-002, IW-003, IW-004).
 *
 * The heading check renders the real page markup; the styling and observer
 * invariants live in stylesheets and module structure, so those follow
 * `shell-landmarks.test.ts` and read the source.
 */
describe("information war surface", () => {
  it("IW-002: the heading's rendered text is exactly the sentence, spaces included", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    const h1 = html.match(/<h1[^>]*id="war-heading"[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1).not.toBeNull();
    /* The visual line breaks come from block spans; the accessible name is
       the concatenated text. Word spaces must survive inside the spans, or
       the sentence reads as "This is aninformationwar." to every screen
       reader — which is the bug this pins. */
    const text = h1![1].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "");
    expect(text).toBe("This is an information war.");
  });

  it("IW-002: the browser title is the same sentence", () => {
    const page = readFileSync(path.join(ROOT, "app/information-war/page.tsx"), "utf8");
    expect(page).toContain('const TITLE = "This is an information war"');
  });

  it("IW-001: both diagrams keep their server-rendered anchors", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    /* Seven stages on the rail, five copies over one origin — the beams'
       anchor marks are server markup, so the diagrams exist before (and
       without) any client JavaScript. */
    expect((html.match(/data-beam-node/g) ?? []).length).toBe(7);
    expect((html.match(/data-beam-copy/g) ?? []).length).toBe(5);
    expect(html).toContain("data-beam-origin");
    for (const id of ["battlefield", "pressure", "independence", "system", "output"]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("IW-003: the system intro pins only behind a viewport-height gate", () => {
    const css = readFileSync(
      path.join(ROOT, "components/briefs/information-war-system.module.css"),
      "utf8",
    );
    /* Every `position: sticky` in the file must sit inside a media query
       that requires a minimum viewport height, so no pinned scene exists on
       a 320×568 viewport or a short landscape phone. */
    const stickyAt = [...css.matchAll(/position:\s*sticky/g)].map((m) => m.index);
    expect(stickyAt.length).toBeGreaterThan(0);
    for (const index of stickyAt) {
      const before = css.slice(0, index);
      const queryStart = before.lastIndexOf("@media");
      expect(queryStart).toBeGreaterThan(-1);
      const query = css.slice(queryStart, before.indexOf("{", queryStart));
      expect(query).toContain("min-height");
    }
  });

  it("IW-004: SignalBeam owns one shared observer system and a beam cap", () => {
    const beam = readFileSync(path.join(ROOT, "components/motion/SignalBeam.tsx"), "utf8");
    /* One ResizeObserver and one IntersectionObserver constructed for the
       whole module — never one per beam. */
    expect(beam.match(/new ResizeObserver/g)?.length).toBe(1);
    expect(beam.match(/new IntersectionObserver/g)?.length).toBe(1);
    expect(beam).toContain("MAX_ANIMATED_BEAMS");
    /* Offscreen beams defer measurement instead of reading layout. */
    expect(beam).toMatch(/if \(!beam\.visible\) \{\s*[\s\S]{0,200}?dirty = true;\s*return;/);
  });

  it("IW-004: reduced motion leaves a static connector", () => {
    const css = readFileSync(
      path.join(ROOT, "components/motion/signal-beam.module.css"),
      "utf8",
    );
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(reduced).toContain(".packet");
    expect(reduced).toContain("display: none");
    /* The track survives — the relationship outlives the animation. */
    expect(reduced).toContain(".track");
  });
});
