import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToReadableStream } from "react-dom/server";
import type { ReactNode } from "react";
import type { PublicPublication } from "@/server/contracts/publication";
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/publications", () => ({ listBriefingPublications: read }));
vi.mock("@/components/site/EditorialShell", () => ({ EditorialShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/briefs/BriefFilters", () => ({ BriefFilters: () => <form aria-label="Filter archive" /> }));
import { LiveBriefEdition } from "@/components/briefs/LiveBriefHub";
import { NarrativeRecord } from "@/components/briefs/NarrativeRecord";
const story = (section: PublicPublication["section"], title: string): PublicPublication => ({
  publicId: title, canonicalStoryId: null, title, section, kind: "brief", summary: "Published context.", body: "Body", language: "en",
  publishedAt: "2026-09-05T10:00:00Z", updatedAt: "2026-09-05T10:00:00Z", autoPublishedAt: null,
  editorialTopic: null, primaryActor: null, arena: null, featuredIsraelStory: false, narrativeWatchDetails: null,
  media: null,
  topicTags: [],
});
async function html(node: ReactNode) { const stream = await renderToReadableStream(node); await stream.allReady; return new Response(stream).text(); }
beforeEach(() => { read.mockReset(); });
describe("news-first reading hierarchy", () => {
  it("keeps archive selection separate from current stories and excludes monitoring", async () => {
    read.mockImplementation(async (query: string) => {
      const params = new URLSearchParams(query);
      if (params.has("actor")) return [];
      return [story(params.get("section") as PublicPublication["section"], params.get("section") === "israel_update" ? "Current news" : "Daily picture"), story("narrative_watch", "Unresolved allegation")];
    });
    const output = await html(await LiveBriefEdition({ filters: { actor: "No matching actor" } }));
    expect(output).toContain("Current news");
    expect(output).toContain("No reports match these filters.");
    expect(output).not.toContain("Unresolved allegation");
    expect(output.indexOf("Latest story")).toBeLessThan(output.indexOf('aria-label="Filter archive"'));
    expect(output).toMatch(/<details[^>]*open=""/);
  });
  it("keeps the default archive collapsed", async () => {
    read.mockResolvedValue([]);
    const output = await html(await LiveBriefEdition({ filters: {} }));
    expect(output).toMatch(/<details[^>]*id="news-archive"/);
    expect(output).not.toMatch(/<details[^>]*open=/);
    expect(output).toContain("No individual news updates");
  });
  it("does not describe service failure as an empty desk", async () => {
    read.mockImplementation(async () => { throw new Error("unavailable"); });
    const output = await html(await LiveBriefEdition({ filters: {} }));
    expect(output).toContain("News could not be loaded.");
    expect(output).toContain("The archive could not be loaded.");
    expect(output).not.toContain("No individual news updates");
  });
  it("shows uncertainty before a monitored claim", async () => {
    const item = story("narrative_watch", "Reported claim: an unverified allegation");
    item.narrativeWatchDetails = { exactClaim: "an unverified allegation", propagators: [], arenas: ["X"], trendDirection: "unclear", israeliPosition: null, securityContext: null, supportingEvidenceIds: [], contradictingEvidenceIds: [], verificationState: "unresolved", knownUnknowns: [], evidenceBasis: "analysis" };
    const output = await html(<NarrativeRecord item={item} />);
    expect(output.indexOf("Unresolved")).toBeLessThan(output.indexOf("an unverified allegation"));
    expect(output).toContain("no finding has been reached");
    expect(output).toContain("no source cited");
  });
});

describe("wide newsroom composition", () => {
  it("uses the briefing beside a single story without duplicating it outside the archive", async () => {
    read.mockImplementation(async (q: string) => new URLSearchParams(q).get("section") === "daily_brief" ? [story("daily_brief", "Daily picture")] : [story("israel_update", "One story")]);
    const output = await html(await LiveBriefEdition({ filters: {} }));
    const entrance = output.split('<details')[0];
    expect((entrance.match(/>Daily picture<\/a>/g) ?? []).length).toBe(1);
    expect((entrance.match(/id="daily-brief"/g) ?? []).length).toBe(1);
    expect(entrance).not.toContain("More updates");
  });
  it("does not duplicate lead stories in the updates sidebar", async () => {
    read.mockImplementation(async (q: string) => new URLSearchParams(q).get("section") === "daily_brief" ? [] : [story("israel_update", "Lead"), story("israel_update", "Second")]);
    const output = await html(await LiveBriefEdition({ filters: {} }));
    expect(output).toContain("More updates");
    expect(output).toContain("Second");
  });
});

it("shows the briefing when there are no individual news stories", async () => {
  read.mockImplementation(async (q: string) => new URLSearchParams(q).get("section") === "daily_brief" ? [story("daily_brief", "Only briefing")] : []);
  const output = await html(await LiveBriefEdition({ filters: {} }));
  expect(output.split("<details")[0]).toContain("Only briefing");
});
