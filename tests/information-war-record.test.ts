import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentActivity } from "@/components/briefs/information-war/LivePanels";
import { listBriefingPublications } from "@/lib/publications";

vi.mock("@/lib/publications", () => ({ listBriefingPublications: vi.fn() }));
/* The failure branch renders a client control holding `useRouter()`, and a
   bare `renderToStaticMarkup` has no app router mounted. */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
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

  /* The retry used to be `<Link href="/information-war#activity">` — a link to
     the anchor the reader is already standing on, so it moved the scroll and
     re-read nothing. It is a control that re-runs the server render now
     (`RecordUnavailable`), and the old anchor's absence is asserted so it
     cannot come back as a link that cannot retry. */
  it("shows an honest read failure and a retry that actually retries", async () => {
    read.mockRejectedValue(new Error("Test read failure"));
    const html = renderToStaticMarkup(await RecentActivity());
    expect(html).toContain("The record could not be loaded.");
    expect(html).toContain("Try again");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('href="/information-war#activity"');
    expect(html).not.toContain("/articles/");
  });
});
