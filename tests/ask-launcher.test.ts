import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PublicSessionProvider } from "@/components/auth/PublicSessionProvider";

vi.mock("@/components/ask/AskDesk", () => ({ AskDesk: () => null }));

import { AskDock } from "@/components/ask/AskDock";
import { SiteHeader } from "@/components/site/SiteHeader";

const read = (file: string) => readFileSync(`${process.cwd()}/${file}`, "utf8");

const header = (activeSection?: string, home = false) =>
  renderToStaticMarkup(
    createElement(PublicSessionProvider, null, createElement(SiteHeader, { activeSection, home })),
  );

describe("public chat entry", () => {
  /* One home, the masthead, on every route (UX-07, UX-08, 2026-09-08). The
     entry used to be a header slot on the cover and a viewport-fixed pill
     everywhere else, mounted from `app/layout.tsx` through `PublicAskDock`;
     the pill covered the footer's "Back to the top", a lead headline and an
     article hero at 390px. Nothing may bring it back: no second launcher in
     the layout, and no `position: fixed` on the trigger. */
  it("has exactly one launcher, in the masthead, on the cover and on a reading route", () => {
    for (const html of [header(undefined, true), header("geopolitical-brief"), header("articles/example")]) {
      expect(html.match(/data-ask-launcher/g)?.length).toBe(1);
      expect(html).toMatch(/<a[^>]*href="\/ask"[^>]*data-ask-launcher/);
    }
    expect(read("app/layout.tsx")).not.toMatch(/AskDock/);
    expect(read("components/ask/ask.module.css")).not.toMatch(/\.dockTrigger\s*\{[^}]*position:\s*fixed/);
  });

  it("is the same control on the cover as on every other page", () => {
    const launcher = (html: string) => html.match(/<a[^>]*data-ask-launcher[^>]*>/)?.[0];
    expect(launcher(header(undefined, true))).toBe(launcher(header("fake-resistance")));
  });

  /* The visible label was "AI Chat" until VA-58. This destination answered to
     five names — that one, "Ask the desk" in the menu, in the page title and in
     the dialog, and "ask the desk" in the launcher's accessible name — so a
     reader could not tell they were one place. The menu label wins, per the
     owner's naming ruling of 2026-09-08. What the assertion is actually for is
     unchanged: a real, navigable destination with a visible name, before any
     JavaScript runs. */
  it("keeps a real chat destination before hydration", () => {
    const html = renderToStaticMarkup(createElement(AskDock));
    expect(html).toMatch(/<a[^>]*href="\/ask"[^>]*data-ask-launcher/);
    expect(html).toContain("Ask the desk");
    expect(html).not.toContain("AI Chat");
  });

  it("on /ask itself is a current link, and does not open a desk over the desk", () => {
    const html = renderToStaticMarkup(createElement(AskDock, { current: true }));
    expect(html).toMatch(/<a[^>]*data-ask-launcher[^>]*aria-current="page"/);
    expect(html).not.toContain("aria-haspopup");
    expect(html).not.toContain("<dialog");
    expect(header("ask")).toMatch(/<a[^>]*data-ask-launcher[^>]*aria-current="page"/);
  });
});
