import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicSessionProvider } from "@/components/auth/PublicSessionProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { ABOUT_LINKS, BAR_LINKS, REPORTING_LINKS, SECTION_LINKS, REFERENCE_LINKS, isCurrentChromeLink } from "@/components/site/navigation-model";
import WarUpdateRedirect from "@/app/war-update/page";

const read = (file: string) => readFileSync(`${process.cwd()}/${file}`, "utf8");

describe("purpose-led site navigation", () => {
  it("retires the separate war-update destination without deleting its articles", () => {
    expect(SITE_NAVIGATION.some((item) => item.href === "/war-update")).toBe(false);
    expect(SECTION_LINKS.some((item) => item.href === "/war-update")).toBe(false);
    expect(() => WarUpdateRedirect()).toThrow("NEXT_REDIRECT");
    const route = read("app/war-update/page.tsx");
    expect(route).toContain('permanentRedirect("/geopolitical-brief")');
    expect(read("components/briefs/LiveBriefHub.tsx")).not.toContain("war_update");
  });

  it("gives news, narrative work and the archive clear entry points", () => {
    expect(REPORTING_LINKS.map((item) => item.href)).toEqual(["/geopolitical-brief", "/fake-resistance", "/october-7"]);
    expect(REPORTING_LINKS[0].label).toBe("News & Analysis");
    expect(REPORTING_LINKS[1].description).toContain("incitement");
    expect(REPORTING_LINKS[1].description).toContain("X review");
    expect(REPORTING_LINKS[2].description).toContain("share");
  });

  it("promotes the system explainer and keeps trust and account links secondary", () => {
    expect(BAR_LINKS.some((item) => item.href === "/information-war")).toBe(true);
    expect(ABOUT_LINKS[0].href).toBe("/information-war");
    expect(REFERENCE_LINKS.map((item) => item.href)).toEqual(["/methodology", "/corrections", "/account"]);
    const destinations = [...SECTION_LINKS, ...REFERENCE_LINKS].map((item) => item.href);
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it("keeps every menu destination in server HTML without file numbers or jargon", () => {
    /* The header reads the shared session for its account control, and
       `usePublicSession` throws without a provider on purpose — a header that
       silently renders "signed out" because nobody wrapped the tree is the bug
       that guard exists to make unshippable. `app/layout.tsx` wraps the real
       one; this render has to do the same. */
    const html = renderToStaticMarkup(
      createElement(
        PublicSessionProvider,
        null,
        createElement(SiteHeader, { activeSection: "geopolitical-brief" }),
      ),
    );
    for (const link of [...SECTION_LINKS, ...REFERENCE_LINKS]) expect(html).toContain(`href="${link.href}"`);
    expect(html).toContain("Reporting &amp; evidence");
    expect(html).not.toMatch(/All files|The eight files|Reference pages|fileIndex/);
    const source = read("components/site/SiteHeader.tsx");
    expect(source).toContain('hidden={!filesOpen}');
    expect(read("components/site/site-header.module.css")).toContain("@media (scripting: none)");
  });

  it("never invites a sign-in the header cannot know is needed", () => {
    /* The session check has not answered in a server render, so `known` is
       false. The account control must be the neutral, always-true one: a link
       to `/account` and no claim about who the reader is. Greeting a signed-in
       reader with "Sign in" because a request had not landed yet is the exact
       failure `PublicSessionProvider` separates `known` from the identities to
       prevent. */
    const html = renderToStaticMarkup(
      createElement(
        PublicSessionProvider,
        null,
        createElement(SiteHeader, { activeSection: "account" }),
      ),
    );
    expect(html).not.toContain("Sign in");
    expect(html).toMatch(/<a class="[^"]*account[^"]*" aria-current="page" href="\/account">/);
  });

  it("keeps footer labels aligned and marks nested archive pages current", () => {
    const html = renderToStaticMarkup(createElement(SiteFooter, { activeSection: "october-7/testimonies" }));
    expect(html).toContain("News &amp; Analysis");
    expect(html).not.toMatch(/eight files|fileIndex|href="\/war-update"/);
    expect(isCurrentChromeLink("october-7/testimonies", "/october-7")).toBe(true);
    expect(isCurrentChromeLink("information-war", "/geopolitical-brief")).toBe(false);
  });

  it("routes narrative browsing to its dedicated hub and invites contextual archive sharing", () => {
    const hub = read("components/briefs/LiveBriefHub.tsx");
    expect(hub).toContain('href="/fake-resistance"');
    expect(hub).not.toContain('items={narratives}');
    /* 2026-09-06: the October 7 doors were replaced with a rotating
       text-only share showcase (`ArchiveShareShowcase`); these assertions
       were pinned to the retired copy. The invariant is unchanged — the page
       still names its two collections and still keeps a content-warning
       promise before any sharing link — just in the current wording. */
    const archive = read("app/october-7/page.tsx");
    expect(archive).toContain('aria-label="Choose an archive collection"');
    expect(archive).toContain("behind its content warning");
    const watch = read("app/fake-resistance/watch/page.tsx");
    expect(watch).not.toContain("last 24 hours");
    expect(watch).toContain("not a live scan log");
  });
});
