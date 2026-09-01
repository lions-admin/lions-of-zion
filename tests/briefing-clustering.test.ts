import { describe, expect, it } from "vitest";
import { clusterEvidence } from "@/server/modules/briefing/service";
import type { BriefingEvidence } from "@/server/modules/briefing/repo";

function evidence(id: string, title: string, excerpt: string, hash: string | null = null): BriefingEvidence {
  return {
    id,
    title,
    excerpt,
    url: `https://news.example/${id}`,
    canonicalUrl: `https://news.example/${id}`,
    publisherDomain: "news.example",
    language: "en",
    publishedAt: new Date("2026-08-31T06:00:00.000Z"),
    capturedAt: new Date("2026-08-31T06:05:00.000Z"),
    publisher: "Example News",
    sourceFamilyId: `family-${id}`,
    sourceCategory: "international_media",
    normalizedContentHash: hash,
    usableTextLength: excerpt.length,
    retrievalStatus: "fetched",
    accessState: "open",
  };
}

describe("briefing story clustering", () => {
  it("groups wire rewrites when titles differ but the underlying text is materially alike", () => {
    const clusters = clusterEvidence([
      evidence(
        "11111111-1111-4111-8111-111111111111",
        "Israel cabinet approves emergency protection plan for northern towns",
        "The Israeli cabinet approved an emergency protection plan for northern towns after a security assessment. The plan funds shelters, medical readiness and local recovery work.",
      ),
      evidence(
        "22222222-2222-4222-8222-222222222222",
        "Government endorses Israel protection plan following northern security assessment",
        "Following a security assessment, the Israeli government approved the emergency protection plan for northern towns. Funding covers shelters, medical readiness and recovery work in local communities.",
      ),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.evidenceIds).toHaveLength(2);
  });

  it("does not bridge broad regional stories merely because they share generic words", () => {
    const clusters = clusterEvidence([
      evidence(
        "33333333-3333-4333-8333-333333333333",
        "Israel cabinet approves emergency protection plan for northern towns",
        "The Israeli cabinet approved an emergency protection plan for northern towns after a security assessment. The plan funds shelters and medical readiness.",
      ),
      evidence(
        "44444444-4444-4444-8444-444444444444",
        "Israel discusses regional security in meeting with foreign diplomats",
        "Israeli diplomats discussed regional security, ceasefire negotiations and cross-border diplomacy in a meeting with foreign representatives.",
      ),
    ]);

    expect(clusters).toHaveLength(2);
  });
});
