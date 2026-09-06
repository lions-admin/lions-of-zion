import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
const { cases, watch, antisemitism, influence } = vi.hoisted(() => ({ cases: vi.fn(), watch: vi.fn(), antisemitism: vi.fn(), influence: vi.fn() }));
vi.mock("@/lib/content/fake-resistance-cases", () => ({ getCaseIndex: cases }));
vi.mock("@/lib/content/fake-resistance-watch", () => ({ getNarrativeWatchFeed: watch, getAntisemitismFeed: antisemitism, getInfluenceInvestigationFeed: influence }));
vi.mock("@/components/site/EditorialShell", () => ({ EditorialShell: ({children}: {children: ReactNode}) => <main>{children}</main> }));
import Page from "@/app/fake-resistance/page";
beforeEach(() => { cases.mockReset(); watch.mockReset(); antisemitism.mockReset(); influence.mockReset(); antisemitism.mockResolvedValue([]); influence.mockResolvedValue([]); });
const sample = { slug: "case-one", title: "A documented investigation", question: "What does the record show?", updatedAt: "2026-09-05", counts: {exhibits: 2, sources: 4} };
describe("narrative hub", () => {
  it("keeps research visible during monitoring failure without duplicating the lead", async () => {
    cases.mockResolvedValue([sample]); watch.mockRejectedValue(new Error("unavailable"));
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("A documented investigation");
    expect(html).toContain("Monitoring is temporarily unavailable");
    expect(html).not.toContain("Further investigations");
    expect(html).not.toContain("On this page");
    expect(html).not.toContain("The consciousness war");
  });
  it("distinguishes research failure from an empty research collection", async () => {
    cases.mockRejectedValue(new Error("unavailable")); watch.mockResolvedValue([]);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("Investigations could not be loaded");
    expect(html).toContain("No monitoring records have been published");
    expect(html).not.toContain("No investigations are available yet");
  });
  it("keeps research and monitoring visible when the antisemitism feed fails", async () => {
    cases.mockResolvedValue([sample]); watch.mockResolvedValue([]); antisemitism.mockRejectedValue(new Error("unavailable"));
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("A documented investigation");
    expect(html).toContain("No monitoring records have been published");
    expect(html).toContain("Antisemitism records are temporarily unavailable");
  });
  /* Each of the four reads on this hub is settled independently. The influence
     section is the newest of them, and it must not be the one that takes the
     desk down — nor state an empty desk when the read simply failed. */
  it("keeps the rest of the hub when only the influence read fails", async () => {
    cases.mockResolvedValue([sample]); watch.mockResolvedValue([]); influence.mockRejectedValue(new Error("unavailable"));
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain("A documented investigation");
    expect(html).toContain("Influence investigations are temporarily unavailable");
    expect(html).not.toContain("No influence investigations have been published yet");
  });
});
