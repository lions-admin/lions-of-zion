import { readFileSync } from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import { createElement, type ReactElement } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InformationWarSystem } from "@/components/briefs/InformationWarSystem";

/* There is no database behind this render, so `RecentActivity` always takes
   its failure branch — which is the branch worth rendering here, because it
   is the one that owns the retry control. That control is a client component
   holding `useRouter()`, and a bare `renderToPipeableStream` has no app
   router mounted, so the router is stubbed rather than the branch avoided. */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

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
    /* The `id="war-heading"` this used to key on belonged to the page's own
       shell. The route is on `DocPage` since 2026-09-16 — the shell
       `/methodology` and `/corrections` wear — and the shell owns the `<h1>`.
       What IW-002 asked for is unchanged and is what is asserted: the page
       has exactly one first-level heading and it reads the editorial
       sentence. */
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1).not.toBeNull();
    expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
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

  it("renders all nine parts of the architecture and a plain-text alternative", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    expect((html.match(/aria-controls="node-inspector"/g) ?? []).length).toBe(9);
    expect(html).toContain("Read every journey as plain text");
    expect(html).toContain("Interactive explanation · not live telemetry");
    expect(html).toContain("Illustrative source relationship");
    expect(html).toContain("Machine-authored editorial run");
    expect(html).toContain("AI assists the work but is never evidence");
    expect(html).not.toContain("Online — public record readable");
    expect(html).not.toContain("all twelve checks");
  });

  /* This page carried two self-advancing step machines and two infinite
     packet loops on one screen. The architecture is reader-driven now: there
     is no clock, so the four assertions that used to check the clock's
     reduced-motion listener, its visibility gate and its `document.hidden`
     check are replaced by the stronger property — there is nothing to gate.
     The one explainer left, `HomeEvidencePipeline`, starts paused. */
  it("drives the architecture from the reader, with no clock to pause", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    for (const name of ["Previous step", "Next step"]) expect(html).toContain(name);
    const client = readFileSync(path.join(ROOT, "components/briefs/information-war/PipelineTrace.tsx"), "utf8");
    /* Code, not prose: the doc comment above the component names both of the
       things that were removed. */
    expect(client).not.toMatch(/window\.set(Interval|Timeout)\(|new IntersectionObserver\(/);
    expect(client).not.toContain("Pause journey");
    const walkthrough = readFileSync(path.join(ROOT, "components/home/HomeEvidencePipeline.tsx"), "utf8");
    expect(walkthrough).toContain("const [playing, setPlaying] = useState(false)");
    expect(walkthrough).not.toMatch(/new IntersectionObserver\(/);
    const css = readFileSync(path.join(ROOT, "components/briefs/information-war-system.module.css"), "utf8");
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/\binfinite\b/);
    expect(css).not.toMatch(/position:\s*(sticky|fixed)/);
    /* The architecture diagram must not be covered by the Ask launcher. That
       was a per-page exception — `html:has([id="war-heading"]) .dockTrigger`
       pulled the fixed pill into the flow below 1100px — until 2026-09-08,
       when the launcher moved into the masthead on every route and stopped
       being fixed anywhere (UX-07). The invariant is the same; the mechanism
       is now that there is no floating launcher to make an exception for. */
    const dock = readFileSync(path.join(ROOT, "components/ask/ask.module.css"), "utf8");
    expect(dock).not.toMatch(/\.dockTrigger\s*\{[^}]*position:\s*fixed/);
  });

  /* The failure state used to end on a link to the anchor the reader was
     already standing on, so "Try again" moved the scroll and re-read nothing.
     The control re-runs the server render that failed. */
  it("offers a retry that actually retries the failed read", async () => {
    const html = await renderFully(createElement(InformationWarSystem));
    expect(html).toContain("The record could not be loaded.");
    expect(html).toContain("Try again");
    expect(html).not.toContain('href="/information-war#activity"');
    const control = readFileSync(path.join(ROOT, "components/briefs/information-war/RecordUnavailable.tsx"), "utf8");
    expect(control).toContain("router.refresh()");
    expect(control).toContain('absenceStatus("unavailable")');
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
