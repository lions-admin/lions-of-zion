import { createElement, type ComponentProps } from "react";
import { renderToReadableStream } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ApiProblem } from "@/components/search/http";
import { classifySearchState } from "@/components/search/useSearch";
import { SensitiveContent } from "@/components/content/SensitiveContent";
import type { SearchHit } from "@/server/contracts/search";

const ROOT = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(ROOT, relativePath), "utf8");

const hit = {
  documentId: "00000000-0000-4000-8000-000000000001",
  entityType: "brief",
  entityId: "00000000-0000-4000-8000-000000000002",
  publicId: "record-1",
  href: "/articles/record-1",
  title: "A published record",
  score: 1,
} as SearchHit;

describe("UX-003 search state contract", () => {
  it("classifies every visible state without conflating fallback and no-results", () => {
    expect(classifySearchState("", undefined, null)).toBe("idle");
    expect(classifySearchState("a", undefined, null)).toBe("invalid-query");
    expect(classifySearchState("alpha", undefined, null)).toBe("loading");
    expect(classifySearchState("alpha", { hits: [hit], semantic: true }, null)).toBe("results");
    expect(classifySearchState("alpha", { hits: [], semantic: true }, null)).toBe("no-results");
    expect(classifySearchState("alpha", { hits: [hit], semantic: false }, null)).toBe("fallback");
    expect(
      classifySearchState("alpha", undefined, new ApiProblem("UNKNOWN", 0, "failed")),
    ).toBe("error");
  });

  it("bounds a request and exposes the state on the panel", () => {
    const hook = read("components/search/useSearch.ts");
    expect(hook).toContain("REQUEST_TIMEOUT_MS = 15_000");
    expect(hook).toContain('new ApiProblem(\n            "TIMEOUT"');
    expect(read("components/search/SearchPanel.tsx")).toContain("data-search-state={state}");
  });
});

describe("UX-010 safe-media boundary", () => {
  it("renders covered by default without rendering protected children", async () => {
    const stream = await renderToReadableStream(
      createElement(
        SensitiveContent,
        {
          category: "Film",
          warning: "Graphic material.",
        } as ComponentProps<typeof SensitiveContent>,
        createElement("img", { src: "/must-not-load.jpg", alt: "protected" }),
      ),
    );
    await stream.allReady;
    const markup = await new Response(stream).text();
    expect(markup).toContain('data-state="covered"');
    expect(markup).toContain('data-boundary="on-request"');
    expect(markup).toContain("Graphic material.");
    expect(markup).toContain("Show this material");
    expect(markup).not.toContain("must-not-load.jpg");
  });

  it("keeps reveal reversible and does not persist acknowledgement", () => {
    const source = read("components/content/SensitiveContent.tsx");
    expect(source).toContain("setRevealed(true)");
    expect(source).toContain("setRevealed(false)");
    expect(source).toContain("Hide this material");
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});

describe("UX-005 Ask lifecycle", () => {
  it("has a synchronous duplicate-submit lock and a bounded request", () => {
    const source = read("components/ask/useAskThread.ts");
    expect(source).toContain("if (!content || inFlight.current) return");
    expect(source).toContain("inFlight.current = true");
    expect(source).toContain("125_000");
    expect(source).toContain('"TIMEOUT"');
  });

  it("exposes submitting, loading and resolved evidence states", () => {
    const hook = read("components/ask/useAskThread.ts");
    expect(hook).toContain('"submitting" | "loading"');
    const desk = read("components/ask/AskDesk.tsx");
    expect(desk).toContain('"success-with-sources"');
    expect(desk).toContain('"insufficient-evidence"');
    expect(desk).toContain('"no-answer"');
    expect(read("components/ask/AskComposer.tsx")).toContain("data-ask-composer-state");
  });
});

describe("UX-006 account lifecycle", () => {
  it("bounds checking and separates signed-out from unavailable/error", () => {
    const source = read("components/auth/PublicAuthControl.tsx");
    expect(source).toContain("10_000");
    expect(source).toContain('"checking" | "ready" | "unavailable" | "error"');
    expect(source).toContain("Sign-in status is temporarily unavailable.");
    expect(source).toContain('actionText="Try again"');
  });
});
