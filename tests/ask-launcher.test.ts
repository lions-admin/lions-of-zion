import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: null as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/components/ask/AskDesk", () => ({ AskDesk: () => null }));

import { AskDock } from "@/components/ask/AskDock";
import { PublicAskDock } from "@/components/ask/PublicAskDock";

describe("public chat entry", () => {
  it.each([null, "/", "/ask", "/admin", "/admin/publications"])(
    "does not emit a duplicate or premature floating entry for %s",
    (pathname) => {
      route.pathname = pathname;
      expect(renderToStaticMarkup(createElement(PublicAskDock))).toBe("");
    },
  );

  it.each([false, true])("keeps a real chat destination before hydration (home=%s)", (home) => {
    const html = renderToStaticMarkup(createElement(AskDock, { home }));
    expect(html).toMatch(/<a[^>]*href="\/ask"[^>]*data-ask-launcher/);
    expect(html).toContain("Ask the desk");
  });

  it("retains the chat entry on an article", () => {
    route.pathname = "/articles/example";
    expect(renderToStaticMarkup(createElement(PublicAskDock))).toContain('href="/ask"');
  });
});
