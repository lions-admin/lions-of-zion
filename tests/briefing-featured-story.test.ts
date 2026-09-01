import { describe, expect, it } from "vitest";
import {
  limitEditionArticles,
  normalizeEditionForQuality,
  normalizeTriageStories,
  normalizeFeaturedIsraelStory,
  storyHasCitableSupport,
  storyHasIndependentSupport,
  validateEvidenceIds,
} from "@/server/modules/briefing/service";

describe("briefing featured Israel story", () => {
  it("keeps one eligible Israel Update and clears misplaced or duplicate flags", () => {
    const edition = normalizeFeaturedIsraelStory({
      articles: [
        { section: "war_update", featuredIsraelStory: true },
        { section: "israel_update", featuredIsraelStory: true },
        { section: "israel_update", featuredIsraelStory: true },
        { section: "narrative_watch", featuredIsraelStory: true },
      ],
    } as unknown as Parameters<typeof normalizeFeaturedIsraelStory>[0]);

    expect(edition.articles.map((article: { featuredIsraelStory: boolean }) => article.featuredIsraelStory)).toEqual([false, true, false, false]);
  });

  it("keeps the first five general articles and first three Narrative Watch articles", () => {
    const edition = limitEditionArticles({
      articles: [
        ...Array.from({ length: 6 }, (_, index) => ({ section: "war_update", title: `General ${index}` })),
        ...Array.from({ length: 4 }, (_, index) => ({ section: "narrative_watch", title: `Narrative ${index}` })),
      ],
    } as unknown as Parameters<typeof limitEditionArticles>[0]);

    expect(edition.articles.map((article: { title: string }) => article.title)).toEqual([
      "General 0", "General 1", "General 2", "General 3", "General 4",
      "Narrative 0", "Narrative 1", "Narrative 2",
    ]);
  });

  it("routes adversarial-only stories to Narrative Watch and injects official Israeli context", () => {
    const stories = normalizeTriageStories([
      { title: "Hostile outlet claim", section: "war_update", evidenceIds: ["hostile"], sourceClaim: "Claim", narrativeTitle: null },
    ] as never, new Map([
      ["hostile", { id: "hostile", sourceCategory: "hostile_state_media" }],
      ["official", { id: "official", title: "Official Israeli update", excerpt: "Official update text", sourceCategory: "official_israeli" }],
    ]) as never);

    expect(stories.map((story) => [story.title, story.section, story.narrativeTitle])).toEqual([
      ["Official Israeli update", "israel_update", null],
      ["Hostile outlet claim", "narrative_watch", "Hostile outlet claim"],
    ]);
  });

  it("requires independent source families unless a source is officially attributed", () => {
    const evidence = new Map([
      ["first", { sourceFamilyId: "family-a", sourceCategory: "international_media" }],
      ["second", { sourceFamilyId: "family-b", sourceCategory: "international_media" }],
      ["official", { sourceFamilyId: "official-family", sourceCategory: "official_israeli" }],
    ]);

    expect(storyHasIndependentSupport(["first", "second"], evidence as never)).toBe(true);
    expect(storyHasIndependentSupport(["first"], evidence as never)).toBe(false);
    expect(storyHasIndependentSupport(["official"], evidence as never)).toBe(true);
  });

  it("allows a citable single-source story without calling it independent", () => {
    const evidence = new Map([
      ["first", { sourceFamilyId: "family-a", sourceCategory: "international_media" }],
    ]);

    expect(storyHasCitableSupport(["first"], evidence as never)).toBe(true);
    expect(storyHasIndependentSupport(["first"], evidence as never)).toBe(false);
  });

  it("normalizes adversarial routing, single-source attribution, and the Daily Brief official lead", () => {
    const officialId = "11111111-1111-4111-8111-111111111111";
    const adversarialId = "22222222-2222-4222-8222-222222222222";
    const edition = normalizeEditionForQuality({
      dailyBrief: {
        title: "Israel daily security update",
        summary: "A source-grounded summary of the current Israeli security picture.",
        evidenceIds: [adversarialId],
        claims: [{ title: "Other report", text: "A report made a claim.", layer: "source_claim", assessment: "unresolved", attributedTo: "Regional outlet", uncertainty: "Unconfirmed.", evidenceLinks: [{ evidenceId: adversarialId, relation: "supports", strength: "adequate", rationale: "Source claim." }] }],
        situation: { label: "Situation", passages: [{ text: "A regional outlet published a report whose underlying facts remain unconfirmed.", claimIndex: 0, evidenceIds: [adversarialId] }] },
        keyEvents: { label: "Events", passages: [{ text: "The report is being monitored as an attributed source claim rather than a verified fact.", claimIndex: 0, evidenceIds: [adversarialId] }] },
        israeliPosition: null,
        internationalResponses: null,
        watchPoints: { label: "Watch", passages: [{ text: "Additional independent evidence is needed before drawing a conclusion from the report.", claimIndex: 0, evidenceIds: [adversarialId] }] },
      },
      articles: [{
        section: "war_update", title: "Regional outlet advances an unverified claim", summary: "A single adversarial outlet advanced a claim that remains unresolved.", evidenceIds: [adversarialId],
        claims: [{ title: "Outlet claim", text: "The outlet made the claim.", layer: "observed_fact", assessment: "unresolved", attributedTo: null, uncertainty: null, evidenceLinks: [{ evidenceId: adversarialId, relation: "supports", strength: "adequate", rationale: "It is the source of the claim." }] }],
        passages: [{ text: "The outlet advanced a claim that remains unresolved in the available source packet.", claimIndex: 0, evidenceIds: [adversarialId] }, { text: "Its report is being tracked as a narrative rather than an independently verified event.", claimIndex: 0, evidenceIds: [adversarialId] }],
        narrativeTitle: null, editorialTopic: "regional media", primaryActor: null, arena: "regional", featuredIsraelStory: false, narrativeWatchDetails: null,
      }],
    } as never, new Map([
      [officialId, { id: officialId, title: "Official Israeli security update", excerpt: "An official Israeli source published a detailed security update for the public.", canonicalUrl: "https://gov.il/update", publisher: "Government of Israel", publisherDomain: "gov.il", sourceFamilyId: "official", sourceCategory: "official_israeli", usableTextLength: 100, retrievalStatus: "fetched", accessState: "open" }],
      [adversarialId, { id: adversarialId, title: "Regional outlet report", excerpt: "The outlet made an unverified regional claim.", canonicalUrl: "https://example.com/report", publisher: "Regional outlet", publisherDomain: "example.com", sourceFamilyId: "regional", sourceCategory: "regional_critical", usableTextLength: 100, retrievalStatus: "fetched", accessState: "open" }],
    ]) as never);

    expect(edition.dailyBrief.evidenceIds).toContain(officialId);
    expect(edition.dailyBrief.situation.passages[0]?.evidenceIds).toEqual([officialId]);
    expect(edition.articles[0]?.section).toBe("narrative_watch");
    expect(edition.articles[0]?.title).toBe("Reported claim: Regional outlet advances an unverified claim");
    expect(edition.articles[0]?.claims[0]).toMatchObject({ layer: "source_claim", attributedTo: "Regional outlet" });
    expect(edition.articles[0]?.narrativeWatchDetails?.verificationState).toBe("unresolved");
  });

  it("rejects a model reference to evidence outside this run's packet", () => {
    const packet = new Map([["evidence-in-run", { id: "evidence-in-run" }]]) as never;

    expect(() => validateEvidenceIds(["evidence-in-run"], packet)).not.toThrow();
    expect(() => validateEvidenceIds(["evidence-from-another-run"], packet))
      .toThrow(/outside this collection window/);
  });
});
