import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { collapseExactDuplicates } from "@/components/briefs/LiveBriefHub";
import { PublicSessionProvider } from "@/components/auth/PublicSessionProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { isCurrentChromeLink } from "@/components/site/navigation-model";
import { resolveActiveChromeSection, resolveSiteSectionId } from "@/lib/site-navigation";

/** The three fields the collapse is allowed to read, and nothing else. */
const record = (title: string, summary: string | null, publishedAt: string, publicId = `${title}|${publishedAt}`) => ({
  publicId,
  title,
  summary,
  publishedAt,
});

describe("VA-12 — the news archive's exact-duplicate collapse", () => {
  it("keeps the newest of an identical title-and-summary pair", () => {
    const older = record("Outpost cleared in the West Bank", "Forces removed the structures overnight.", "2026-09-05T06:00:00.000Z");
    const newer = record("Outpost cleared in the West Bank", "Forces removed the structures overnight.", "2026-09-06T06:00:00.000Z");
    const collapsed = collapseExactDuplicates([newer, older]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toBe(newer);
    /* Order of arrival must not decide which record survives: the archive is
       sorted newest-first today, and the rule may not quietly depend on it. */
    expect(collapseExactDuplicates([older, newer])[0]).toBe(newer);
  });

  it("keeps both records when the titles match but the summaries do not", () => {
    const first = record("Strike in southern Lebanon", "A launcher position was hit near Tyre.", "2026-09-06T06:00:00.000Z");
    const second = record("Strike in southern Lebanon", "A separate operation was reported near Nabatieh.", "2026-09-05T06:00:00.000Z");
    expect(collapseExactDuplicates([first, second])).toHaveLength(2);
  });

  it("keeps both records when the summaries match but the titles do not", () => {
    const first = record("Civil defence briefing", "Guidance was reissued for the northern districts.", "2026-09-06T06:00:00.000Z");
    const second = record("Home Front Command update", "Guidance was reissued for the northern districts.", "2026-09-05T06:00:00.000Z");
    expect(collapseExactDuplicates([first, second])).toHaveLength(2);
  });

  it("collapses across whitespace and capitalisation differences only", () => {
    const canonical = record("Civil defence briefing", "Guidance was reissued.", "2026-09-06T06:00:00.000Z");
    const spaced = record("  Civil   defence\nbriefing ", "GUIDANCE   was reissued.", "2026-09-05T06:00:00.000Z");
    expect(collapseExactDuplicates([canonical, spaced])).toHaveLength(1);
    /* One character of real difference is a different record. The cheap rule
       is only allowed to act where it is certain — VA-19 owns the rest. */
    const punctuated = record("Civil defence briefing", "Guidance was reissued", "2026-09-04T06:00:00.000Z");
    expect(collapseExactDuplicates([canonical, punctuated])).toHaveLength(2);
  });

  it("treats a missing summary as a value rather than a wildcard", () => {
    const noSummary = record("Lebanon developments", null, "2026-09-06T06:00:00.000Z");
    const alsoNoSummary = record("Lebanon developments", null, "2026-09-05T06:00:00.000Z");
    const withSummary = record("Lebanon developments", "Overnight movement was reported.", "2026-09-04T06:00:00.000Z");
    expect(collapseExactDuplicates([noSummary, alsoNoSummary])).toHaveLength(1);
    expect(collapseExactDuplicates([noSummary, withSummary])).toHaveLength(2);
  });

  it("handles an empty archive and one with nothing to collapse", () => {
    expect(collapseExactDuplicates([])).toEqual([]);
    const distinct = [
      record("One", "First summary.", "2026-09-06T06:00:00.000Z"),
      record("Two", "Second summary.", "2026-09-05T06:00:00.000Z"),
      record("Three", "Third summary.", "2026-09-04T06:00:00.000Z"),
    ];
    expect(collapseExactDuplicates(distinct)).toEqual(distinct);
  });

  it("is a projection: it never mutates the list it was given", () => {
    const items = [
      record("Same", "Same summary.", "2026-09-06T06:00:00.000Z"),
      record("Same", "Same summary.", "2026-09-05T06:00:00.000Z"),
    ];
    const before = [...items];
    collapseExactDuplicates(items);
    expect(items).toEqual(before);
  });
});

describe("VA-15 — active-state ownership for How it works", () => {
  it("no longer folds /information-war onto the News hub", () => {
    expect(resolveSiteSectionId("information-war")).toBeUndefined();
    expect(resolveActiveChromeSection("information-war")).toBe("information-war");
    expect(isCurrentChromeLink("information-war", "/information-war")).toBe(true);
    expect(isCurrentChromeLink("information-war", "/geopolitical-brief")).toBe(false);
  });

  it("still resolves a destination route to its own destination", () => {
    expect(resolveSiteSectionId("geopolitical-brief")).toBe("geopolitical-brief");
    expect(resolveActiveChromeSection("geopolitical-brief")).toBe("geopolitical-brief");
    expect(isCurrentChromeLink("geopolitical-brief", "/geopolitical-brief")).toBe(true);
    expect(isCurrentChromeLink("geopolitical-brief", "/information-war")).toBe(false);
    /* Containment and the legacy addresses are the rules that survive; they
       name destinations those routes really are inside. */
    expect(resolveActiveChromeSection("october-7/testimonies")).toBe("october-7");
    expect(resolveActiveChromeSection("our-heroes")).toBe("people-of-israel");
  });

  it("marks nothing current on an article route", () => {
    /* `app/articles/[publicId]/page.tsx` mounts the shell with `routeId="articles"`. */
    expect(resolveSiteSectionId("articles")).toBeUndefined();
    expect(resolveActiveChromeSection("articles")).toBe("articles");
    for (const href of ["/geopolitical-brief", "/information-war", "/fake-resistance", "/october-7"]) {
      expect(isCurrentChromeLink("articles", href)).toBe(false);
    }
  });

  it("puts aria-current on the system link and on no other bar destination", () => {
    /* The header reads the shared session; `usePublicSession` throws without a
       provider on purpose, so this render wraps it the way `app/layout.tsx`
       does. See `tests/site-navigation.test.ts` for the full reasoning. */
    const html = renderToStaticMarkup(
      createElement(
        PublicSessionProvider,
        null,
        createElement(SiteHeader, { activeSection: resolveActiveChromeSection("information-war") }),
      ),
    );
    /* Attribute order is React's, not ours, so read every anchor and keep the
       ones that carry the mark rather than assuming where it sits. */
    const current = [...html.matchAll(/<a\b([^>]*)>/g)]
      .map((match) => match[1])
      .filter((attributes) => attributes.includes('aria-current="page"'))
      .map((attributes) => /href="([^"]+)"/.exec(attributes)?.[1]);
    expect(current.length).toBeGreaterThan(0);
    expect(new Set(current)).toEqual(new Set(["/information-war"]));
  });
});
