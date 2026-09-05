import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentActivity } from "@/components/briefs/information-war/LivePanels";
import { listBriefingPublications } from "@/lib/publications";

vi.mock("@/lib/publications", () => ({ listBriefingPublications: vi.fn() }));
const read = vi.mocked(listBriefingPublications);
afterEach(() => read.mockReset());

// Deliberately labelled test fixtures; never rendered as public fallbacks.
describe("information-war published record", () => {
  it("renders the supplied publication and its full date, without upgrading it to live state", async () => {
    read.mockResolvedValue([{ publicId: "fixture-record", title: "Test fixture publication", section: "daily_brief", publishedAt: "2026-09-01T10:30:00Z" }] as Awaited<ReturnType<typeof listBriefingPublications>>);
    const html = renderToStaticMarkup(await RecentActivity());
    expect(read).toHaveBeenCalledWith("?limit=4");
    expect(html).toContain('href="/articles/fixture-record"');
    expect(html).toContain("01 Sept 2026, 13:30");
    expect(html).toContain("Daily Brief");
    expect(html).not.toMatch(/Online|Today|Running/);
  });

  it("does not manufacture records for an empty response", async () => {
    read.mockResolvedValue([]);
    const html = renderToStaticMarkup(await RecentActivity());
    expect(html).toContain("No publications returned.");
    expect(html).not.toContain("/articles/");
  });

  it("shows an honest read failure and a retry anchor that exists on the page", async () => {
    read.mockRejectedValue(new Error("Test read failure"));
    const html = renderToStaticMarkup(await RecentActivity());
    expect(html).toContain("The record could not be loaded.");
    expect(html).toContain('href="/information-war#activity"');
    expect(html).not.toContain("/articles/");
  });
});
