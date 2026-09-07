import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/core/auth/actor", () => ({
  authenticateAdmin: vi.fn(), registerActor: vi.fn(), requireActor: vi.fn(),
}));

import { APP_RESOURCE_MIME_TYPE, WIDGETS, WIDGET_BY_TOOL } from "@/server/modules/chatgpt-mcp/widgets";
import { mcpToolSpecs } from "@/server/modules/chatgpt-mcp/tools";
import type { ChatgptAutomationService } from "@/server/modules/chatgpt-automation";

/**
 * The widget templates.
 *
 * There is no jsdom in this project — the global vitest environment is `node`
 * because PGlite needs it — so these assert on the template a host will
 * receive rather than on a rendered tree. That is the right level for the
 * properties that actually matter here: what the host is asked to load, what
 * it is allowed to fetch, and whether the markup states the distinctions the
 * system depends on.
 */

const widget = (name: string) => WIDGETS.find(entry => entry.name === name)!;

describe("the Apps SDK templates", () => {
  it("registers one template per surface, each with a versioned cache key", () => {
    expect(WIDGETS.length).toBe(5);
    for (const entry of WIDGETS) {
      expect(entry.uri).toMatch(/^ui:\/\/lions-of-zion\/[a-z-]+\/v\d+\.html$/);
      expect(entry.description.length).toBeGreaterThan(30);
    }
    /* Unique URIs, because the host caches against them. */
    expect(new Set(WIDGETS.map(entry => entry.uri)).size).toBe(WIDGETS.length);
  });

  it("uses the MCP Apps mimetype, not the retired one", () => {
    expect(APP_RESOURCE_MIME_TYPE).toBe("text/html;profile=mcp-app");
    expect(APP_RESOURCE_MIME_TYPE).not.toContain("skybridge");
  });

  /* Everything inlined is what makes this work at all: the site sends
     `frame-ancestors 'none'` and `X-Frame-Options: DENY` on every path, so a
     template that fetched anything from this origin would be blocked. */
  it("inlines everything and fetches nothing", () => {
    for (const entry of WIDGETS) {
      expect(entry.html).toContain('<div id="loz-root"');
      expect(entry.html).toContain("<style>");
      expect(entry.html).toContain('<script type="module">');
      expect(entry.html).not.toMatch(/<script[^>]+src=/);
      expect(entry.html).not.toMatch(/<link[^>]+rel=["']stylesheet/);
      expect(entry.html).not.toMatch(/@import/);
      /* No call back to our own origin, and no third-party host. */
      expect(entry.html).not.toMatch(/fetch\(|XMLHttpRequest|import\(/);
    }
  });

  it("links out to the public site only, and never to an internal path", () => {
    for (const entry of WIDGETS) {
      const urls = entry.html.match(/https?:\/\/[^"'` )]+/g) ?? [];
      for (const url of urls) {
        expect(url.startsWith("https://lionsofzion.io")).toBe(true);
        expect(url).not.toContain("/api/");
      }
    }
  });

  it("carries no secret, no token and no credential", () => {
    for (const entry of WIDGETS) {
      expect(entry.html).not.toMatch(/authorization|bearer|secret|password|DATABASE_URL/i);
    }
  });

  /* A tool result renders through its widget, but the tool must remain usable
     with no UI at all — the fallback the whole design rests on. */
  it("attaches a template to five tools and leaves the rest usable without one", () => {
    const specs = mcpToolSpecs({} as unknown as ChatgptAutomationService);
    for (const [tool] of WIDGET_BY_TOOL) {
      expect(specs.some(spec => spec.name === tool)).toBe(true);
    }
    expect([...WIDGET_BY_TOOL.keys()].sort()).toEqual(
      ["find_publication", "get_editorial_context", "get_editorial_run", "get_homepage", "get_ops_view"],
    );
    expect(specs.length).toBeGreaterThan(WIDGET_BY_TOOL.size);
  });

  it("feature-detects the host bridge instead of assuming it", () => {
    for (const entry of WIDGETS) {
      expect(entry.html).toContain("window.openai");
      /* Every use is guarded — a template whose host has no bridge still
         renders what it was handed. */
      expect(entry.html).toMatch(/typeof window !== "undefined"/);
    }
  });

  it("draws an explicit state for waiting, for nothing, and for a fault", () => {
    for (const entry of WIDGETS) {
      expect(entry.html).toContain("Waiting for data");
      expect(entry.html).toContain("could not be drawn");
    }
    expect(widget("editorial-overview").html).toContain("The desk reads as empty");
    expect(widget("publication").html).toContain("does not exist yet");
  });

  /* The distinction `whole-site-update-v2` exists to make. A veto is a
     decision and a failure is a fault; the headings say so in words, because
     colour alone is not a signal. */
  it("separates an editorial veto from a technical failure, in words", () => {
    const html = widget("editorial-run").html;
    expect(html).toContain("Vetoed — editorial decisions, not faults");
    expect(html).toContain("Media warnings — publication continued");
    expect(html).toContain("Failed — technical faults");
    expect(html.indexOf("Vetoed — editorial")).toBeLessThan(html.indexOf("Failed — technical"));
    expect(html.indexOf("Media warnings — publication continued")).toBeLessThan(html.indexOf("Failed — technical"));
    /* And a veto never takes the alert tone that marks a fault. */
    expect(html).toContain('pill("editorial veto")');
  });

  it("says when a v1 run could not represent research or a veto, rather than showing nothing", () => {
    const html = widget("editorial-run").html;
    expect(html).toContain("whole-site-update-v1, which had no research ledger");
    expect(html).toContain("could not distinguish an editorial refusal from a technical failure");
  });

  /* The one lie this design must never tell: the connector archives, and the
     UI must not offer a button that says otherwise. */
  it("offers no delete control and explains why", () => {
    const html = widget("publication").html;
    expect(html).toContain("Deletion is not offered");
    expect(html).toContain("archive, which is reversible");
    /* Asserted on the action labels rather than the word, which also appears
       in the source comment explaining the absence. */
    const labels = [...html.matchAll(/label:\s*"([^"]+)"/g)].map(match => match[1]);
    expect(labels).toEqual(["Archive", "Take off the site", "Publish"]);
    expect(labels.some(label => /delete|remove permanently/i.test(label!))).toBe(false);
    expect(html).not.toContain("delete_publication");
    expect(html).not.toContain("Deleted successfully");
  });

  it("never presents a generated image as documentation", () => {
    const html = widget("publication").html;
    expect(html).toContain("Editorial illustration — not evidence");
    expect(html).toContain("Safe cover — not the original material");
    /* Rights and sensitivity are shown as words, not inferred from presence. */
    expect(html).toContain("rights ");
  });

  it("re-reads the server after a mutation rather than repainting optimistically", () => {
    const html = widget("publication").html;
    expect(html).toContain("the server's own account of its state");
  });

  it("keeps the site's type floors and states status in words as well as colour", () => {
    const html = widget("editorial-overview").html;
    /* Body 16px, metadata 13px — the phone floors the site itself keeps. */
    expect(html).toContain("font-size: 16px");
    expect(html).toContain("font-size: 13px");
    /* Every pill carries a label; none is a bare coloured dot. */
    expect(html).toContain("no hero image");
    expect(html).toMatch(/aria-live="polite"/);
  });

  it("bounds every list so one bad day cannot render a thousand rows", () => {
    expect(widget("editorial-overview").html).toContain(".slice(0, 8)");
    expect(widget("ops-dashboard").html).toContain(".slice(0, 10)");
    expect(widget("publication").html).toContain(".slice(0, 12)");
  });

  it("degrades at a phone width instead of overflowing", () => {
    for (const entry of WIDGETS) {
      expect(entry.html).toContain("@media (max-width: 420px)");
      expect(entry.html).toContain("overflow-wrap: anywhere");
      /* A long source URL must wrap rather than push the card sideways. */
      expect(entry.html).toContain("minmax(120px, 1fr)");
    }
  });

  it("keeps controls reachable and focus visible", () => {
    const html = widget("publication").html;
    expect(html).toContain("min-height: 34px");
    expect(html).toContain(":focus-visible");
    expect(html).toContain("outline: 2px solid");
  });
});
