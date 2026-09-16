import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentActivity } from "@/components/briefs/information-war/LivePanels";
import { listBriefingPublications } from "@/lib/publications";

vi.mock("@/lib/publications", () => ({ listBriefingPublications: vi.fn() }));
/* The retry control reads the App Router (`router.refresh()`), which a bare
   server render does not mount; the mock stands in for it only. */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {}, back: () => {}, prefetch: () => {} }),
}));
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

  it("shows an honest read failure with a retry that re-runs the read", async () => {
    read.mockRejectedValue(new Error("Test read failure"));
    const html = renderToStaticMarkup(await RecentActivity());
    expect(html).toContain("The record could not be loaded.");
    /* Restated 2026-09-17 (workstream G): the old "Try again" was a link to
       the very anchor it sat on — it could not re-run the read it apologised
       for. The retry is a control now (`router.refresh()`), asserted in
       RetryRefresh's own source by tests/information-war.test.ts. */
    expect(html).toContain("Try again");
    expect(html).not.toContain("/articles/");
  });
});
