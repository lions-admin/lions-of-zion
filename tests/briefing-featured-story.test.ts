import { describe, expect, it } from "vitest";
import {
  limitEditionArticles,
  normalizeEditionForPublication,
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
        { section: "narrative_watch", featuredIsraelStory: true },
        { section: "israel_update", featuredIsraelStory: true },
        { section: "israel_update", featuredIsraelStory: true },
        { section: "narrative_watch", featuredIsraelStory: true },
      ],
    } as unknown as Parameters<typeof normalizeFeaturedIsraelStory>[0]);

    expect(edition.articles.map((article: { featuredIsraelStory: boolean }) => article.featuredIsraelStory)).toEqual([false, true, false, false]);
  });

  it("keeps the first three Israel Updates and first five Narrative Watch articles", () => {
    const edition = limitEditionArticles({
      articles: [
        ...Array.from({ length: 4 }, (_, index) => ({ section: "israel_update", title: `Israel ${index}`, evidenceIds: ["source"] })),
        ...Array.from({ length: 6 }, (_, index) => ({ section: "narrative_watch", title: `Narrative ${index}`, evidenceIds: ["source"] })),
      ],
    } as unknown as Parameters<typeof limitEditionArticles>[0]);

    expect(edition.articles.map((article: { title: string }) => article.title)).toEqual([
      "Israel 0", "Israel 1", "Israel 2",
      "Narrative 0", "Narrative 1", "Narrative 2", "Narrative 3", "Narrative 4",
    ]);
  });

  it("keeps at most one unsourced analysis per edition", () => {
    const edition = limitEditionArticles({
      articles: [
        { section: "narrative_watch", title: "Analysis one", evidenceIds: [] },
        { section: "narrative_watch", title: "Analysis two", evidenceIds: [] },
        { section: "narrative_watch", title: "Sourced refutation", evidenceIds: ["source"] },
      ],
    } as unknown as Parameters<typeof limitEditionArticles>[0]);

    expect(edition.articles.map((article: { title: string }) => article.title)).toEqual([
      "Analysis one", "Sourced refutation",
    ]);
  });

  it("routes adversarial-only stories to Narrative Watch and injects official Israeli context", () => {
    const stories = normalizeTriageStories([
      { title: "Hostile outlet claim", section: "israel_update", evidenceIds: ["hostile"], sourceClaim: "Claim", narrativeTitle: null },
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
    const edition = normalizeEditionForPublication({
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
        section: "israel_update", title: "Regional outlet advances an unverified claim", summary: "A single adversarial outlet advanced a claim that remains unresolved.", evidenceIds: [adversarialId],
        claims: [{ title: "Outlet claim", text: "The outlet made the claim.", layer: "observed_fact", assessment: "unresolved", attributedTo: null, uncertainty: null, evidenceLinks: [{ evidenceId: adversarialId, relation: "supports", strength: "adequate", rationale: "It is the source of the claim." }] }],
        passages: [{ text: "The outlet advanced a claim that remains unresolved in the available source packet.", claimIndex: 0, evidenceIds: [adversarialId] }, { text: "Its report is being tracked as a narrative rather than an independently verified event.", claimIndex: 0, evidenceIds: [adversarialId] }],
        narrativeTitle: null, editorialTopic: "regional media", primaryActor: null, arena: "regional", featuredIsraelStory: false, narrativeWatchDetails: null,
      }],
    } as never, new Map([
      [officialId, { id: officialId, title: "Official Israeli security update", excerpt: "An official Israeli source published a detailed security update for the public.", canonicalUrl: "https://gov.il/update", publisher: "Government of Israel", publisherDomain: "gov.il", sourceFamilyId: "official", sourceCategory: "official_israeli", usableTextLength: 100, retrievalStatus: "fetched", accessState: "open" }],
      [adversarialId, { id: adversarialId, title: "Regional outlet report", excerpt: "The outlet made an unverified regional claim.", canonicalUrl: "https://example.com/report", publisher: "Regional outlet", publisherDomain: "example.com", sourceFamilyId: "regional", sourceCategory: "regional_critical", usableTextLength: 100, retrievalStatus: "fetched", accessState: "open" }],
    ]) as never);

    expect(edition.dailyBrief.evidenceIds).toContain(officialId);

    /* Corrected 2026-09-02. This asserted `situation.passages[0]`, and had been
       failing ever since it was written in 9a7e16f — `normalizeDailyBriefOfficialContext`
       never touches `situation`. That is the right behaviour, not a bug to fix:
       an official Israeli source IS the Israeli position, so the normalizer
       synthesises a passage there (creating the section when the draft left it
       null) and leaves the situation reporting whatever it actually reported.
       Asserting the real contract also pins the section's creation, which the
       old expectation did not cover. */
    expect(edition.dailyBrief.situation.passages[0]?.evidenceIds).toEqual([adversarialId]);
    expect(edition.dailyBrief.israeliPosition?.label).toBe("Israeli position");
    expect(edition.dailyBrief.israeliPosition?.passages[0]?.evidenceIds).toEqual([officialId]);
    expect(edition.articles[0]?.section).toBe("narrative_watch");
    expect(edition.articles[0]?.title).toBe("Reported claim: Regional outlet advances an unverified claim");
    expect(edition.articles[0]?.claims[0]).toMatchObject({ layer: "source_claim", attributedTo: "Regional outlet" });
    expect(edition.articles[0]?.narrativeWatchDetails?.verificationState).toBe("unresolved");
    expect(edition.articles[0]?.narrativeWatchDetails?.evidenceBasis).toBe("sourced");
  });

  it("labels an unsourced refutation as analysis and prefixes its headline accordingly", () => {
    /* A sourced Narrative Watch record is a *report of* a claim; an unsourced
     * one is our own answer to it. The two cannot share a headline prefix, and
     * the basis is derived here rather than taken from the model. */
    const edition = normalizeEditionForPublication({
      dailyBrief: {
        title: "Israel daily security update",
        summary: "A source-grounded summary of the current Israeli security picture.",
        evidenceIds: [],
        claims: [{ title: "Placeholder", text: "A claim.", layer: "source_claim", assessment: "unresolved", attributedTo: "Outlet", uncertainty: "Unconfirmed.", evidenceLinks: [] }],
        situation: { label: "Situation", passages: [{ text: "A paragraph of the daily situation snapshot for the edition.", claimIndex: 0, evidenceIds: [] }] },
        keyEvents: { label: "Events", passages: [{ text: "A paragraph of the daily key events for the edition.", claimIndex: 0, evidenceIds: [] }] },
        israeliPosition: null,
        internationalResponses: null,
        watchPoints: { label: "Watch", passages: [{ text: "A paragraph of the daily watch points for the edition.", claimIndex: 0, evidenceIds: [] }] },
      },
      articles: [{
        section: "narrative_watch",
        title: "The convoy accusation asserts intent it never demonstrates",
        summary: "The circulating accusation infers deliberate targeting from an outcome alone.",
        evidenceIds: [],
        claims: [{ title: "Intent is assumed", text: "The accusation infers intent from outcome.", layer: "editorial_conclusion", assessment: "refuted", attributedTo: "Lions of Zion editorial analysis", uncertainty: "This addresses the accusation's structure, not any commander's knowledge.", evidenceLinks: [] }],
        passages: [
          { text: "The accusation moves from a terrible outcome to an assumed purpose without the step between them.", claimIndex: 0, evidenceIds: [] },
          { text: "The context it removes is a convoy moving through an active combat corridor.", claimIndex: 0, evidenceIds: [] },
        ],
        narrativeTitle: null, editorialTopic: "atrocity framing", primaryActor: null, arena: "international media", featuredIsraelStory: false,
        narrativeWatchDetails: {
          exactClaim: "Israel deliberately targeted a humanitarian convoy and blocked every investigation.",
          propagators: [], arenas: ["international media"], trendDirection: "rising",
          israeliPosition: null, securityContext: null,
          supportingEvidenceIds: [], contradictingEvidenceIds: [],
          verificationState: "refuted", knownUnknowns: [],
        },
      }],
    } as never, new Map() as never);

    expect(edition.articles[0]?.section).toBe("narrative_watch");
    expect(edition.articles[0]?.title).toBe("Analysis: The convoy accusation asserts intent it never demonstrates");
    expect(edition.articles[0]?.narrativeWatchDetails?.evidenceBasis).toBe("analysis");
    expect(edition.articles[0]?.claims[0]?.layer).toBe("editorial_conclusion");
  });

  it("rejects a model reference to evidence outside this run's packet", () => {
    const packet = new Map([["evidence-in-run", { id: "evidence-in-run" }]]) as never;

    expect(() => validateEvidenceIds(["evidence-in-run"], packet)).not.toThrow();
    expect(() => validateEvidenceIds(["evidence-from-another-run"], packet))
      .toThrow(/outside this collection window/);
  });
});
