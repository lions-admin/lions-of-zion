import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase } from "@/server/db/testing";
import { externalBriefingPublishService } from "@/server/modules/briefing/external-publish";
import {
  externalBriefingPackageSchema,
  type ExternalBriefingPackage,
} from "@/server/contracts/external-briefing";
import { ANALYSIS_AUTHOR } from "@/server/contracts/publication";
import { briefingQualityCheck, briefingRun, externalBriefingSubmission, publication, publicationEvidence } from "@/server/db/schema";
import type { Actor } from "@/server/core/audit";

const actor: Actor = { label: "test:external-briefing", userId: null };

/** A minimal, fully sourced package: two independent, differently-categorised
 * publishers back one Daily Brief claim, satisfying every quality check that
 * applies to a sourced record (including `daily_brief_official_context`,
 * which needs an `official_israeli` source, and `single_source_attribution`,
 * which this sidesteps by citing two independent families). No articles —
 * `articles` has no floor in the contract, so an edition with only a Daily
 * Brief is legal. */
function basePackage(runId: string, localDate: string): ExternalBriefingPackage {
  const raw = {
    runId,
    localDate,
    contractVersion: "external-briefing-v1",
    composer: "test-composer",
    publishers: [
      {
        key: "gov-il",
        name: "Government Office",
        homepageUrl: "https://www.gov.il",
        language: "en",
        country: "IL",
        official: true,
      },
      {
        key: "jpost",
        name: "Jerusalem Post",
        homepageUrl: "https://www.jpost.com",
        language: "en",
        country: "IL",
        official: false,
      },
    ],
    citations: [
      {
        key: "c-gov",
        publisherKey: "gov-il",
        title: "Security Cabinet Statement on Northern Frontier Readiness",
        url: "https://www.gov.il/en/departments/news/statement-frontier-readiness",
        publishedAt: `${localDate}T08:00:00Z`,
        excerpt:
          "The Israeli security cabinet convened on Sunday and confirmed that the armed forces maintain a heightened readiness posture along the northern frontier in response to ongoing regional tensions and will continue coordinated defensive preparations.",
        language: "en",
      },
      {
        key: "c-jpost",
        publisherKey: "jpost",
        title: "Jerusalem Post Details Continued Northern Frontier Preparations",
        url: "https://www.jpost.com/article/frontier-preparations",
        publishedAt: `${localDate}T09:00:00Z`,
        excerpt:
          "According to defense officials cited by the paper, forces along the northern frontier remain on a heightened readiness posture as regional tensions continue, with additional coordinated preparations reported by military correspondents this week.",
        language: "en",
      },
    ],
    dailyBrief: {
      title: "Northern Frontier Readiness Posture Holds Steady Amid Regional Tensions",
      summary:
        "A summary of the northern frontier readiness posture amid regional tensions, based on an official statement and independent reporting.",
      citationKeys: ["c-gov", "c-jpost"],
      claims: [
        {
          title: "Security cabinet confirms elevated readiness posture",
          text:
            "The security cabinet confirmed that armed forces maintain an elevated readiness posture along the northern frontier amid regional tensions.",
          layer: "source_claim",
          assessment: "verified",
          attributedTo: "Government Office",
          uncertainty: null,
          citationLinks: [{
            citationKey: "c-gov",
            relation: "supports",
            strength: "strong",
            rationale: "The official statement directly confirms this readiness posture.",
          }],
        },
      ],
      situation: {
        label: "Situation",
        passages: [{
          text:
            "The security cabinet convened and confirmed that armed forces maintain an elevated readiness posture along the northern frontier amid ongoing regional tensions.",
          claimIndex: 0,
          citationKeys: ["c-gov"],
        }],
      },
      keyEvents: {
        label: "Key Events",
        passages: [{
          text:
            "Jerusalem Post reporting corroborated that forces along the northern frontier remain on heightened alert as regional tensions continue this week.",
          claimIndex: 0,
          citationKeys: ["c-jpost"],
        }],
      },
      israeliPosition: null,
      internationalResponses: null,
      watchPoints: {
        label: "Watch Points",
        passages: [{
          text:
            "Officials indicated that coordinated defensive preparations along the northern frontier will continue as regional tensions are monitored closely.",
          claimIndex: 0,
          citationKeys: ["c-gov"],
        }],
      },
    },
    articles: [] as unknown[],
  };
  return externalBriefingPackageSchema.parse(raw);
}

/** Adds one narrative_watch article published as this organisation's own
 * analysis — it cites nothing anywhere, which is the one case a Narrative
 * Watch record may take. Exercises `evidenceBasis` derivation end to end. */
function withAnalysisArticle(pkg: ExternalBriefingPackage): ExternalBriefingPackage {
  const raw = {
    ...pkg,
    articles: [{
      section: "narrative_watch",
      title: "False Claim That Strike Deliberately Targeted Civilian Infrastructure",
      summary: "This organisation's own analysis refutes a circulating claim.",
      citationKeys: [],
      claims: [{
        title: "The claim is unsupported by available reporting",
        text:
          "The circulating claim that the strike deliberately targeted civilian infrastructure is not corroborated by any credible reporting reviewed.",
        layer: "editorial_conclusion",
        assessment: "unsupported",
        attributedTo: ANALYSIS_AUTHOR,
        uncertainty: "No independent verification was available for the underlying claim.",
        citationLinks: [],
      }],
      passages: [
        {
          text:
            "Multiple independent researchers reviewed the circulating claim and found no corroborating evidence that the strike was intentionally aimed at civilian infrastructure rather than a legitimate military objective.",
          claimIndex: 0,
          citationKeys: [],
        },
        {
          text:
            "The available reporting instead points to a military target in the vicinity, and no credible outlet has substantiated the allegation that civilians were the intended target.",
          claimIndex: 0,
          citationKeys: [],
        },
      ],
      narrativeTitle: "Civilian infrastructure targeting allegation",
      editorialTopic: "Information warfare",
      primaryActor: null,
      arena: "Social media",
      featuredIsraelStory: false,
      narrativeWatch: {
        exactClaim: "The strike deliberately targeted civilian infrastructure without military justification.",
        propagators: ["Anonymous social media accounts"],
        arenas: ["Social media"],
        trendDirection: "new",
        israeliPosition: null,
        securityContext: null,
        supportingCitationKeys: [],
        contradictingCitationKeys: [],
        verificationState: "unsupported",
        knownUnknowns: ["The original source of the allegation has not been identified."],
      },
    }],
  };
  return externalBriefingPackageSchema.parse(raw);
}

/** Adds one israel_update article resting on a single non-official source
 * without the attributed/uncertainty-aware claim shape `single_source_attribution`
 * requires for a lone non-official family — a deterministic, targeted
 * quality-gate failure. */
function withUnattributedSingleSourceArticle(pkg: ExternalBriefingPackage): ExternalBriefingPackage {
  const raw = {
    ...pkg,
    articles: [{
      section: "israel_update",
      title: "Jerusalem Post Reports New Details on Frontier Posture",
      summary: "A single-source account of the frontier posture.",
      citationKeys: ["c-jpost"],
      claims: [{
        title: "Single-source report on posture",
        text: "Jerusalem Post reported that the military maintains an elevated posture along the frontier.",
        layer: "observed_fact",
        assessment: "unresolved",
        attributedTo: null,
        uncertainty: null,
        citationLinks: [{
          citationKey: "c-jpost",
          relation: "supports",
          strength: "adequate",
          rationale: "Direct report from the outlet.",
        }],
      }],
      passages: [
        {
          text: "Jerusalem Post described continued preparations along the frontier as part of routine posture management this week.",
          claimIndex: 0,
          citationKeys: ["c-jpost"],
        },
        {
          text: "The report did not include comment from any additional independent outlet or official source beyond the one cited above.",
          claimIndex: 0,
          citationKeys: ["c-jpost"],
        },
      ],
      narrativeTitle: null,
      editorialTopic: "Frontier posture",
      primaryActor: null,
      arena: "Northern frontier",
      featuredIsraelStory: false,
      narrativeWatch: null,
    }],
  };
  return externalBriefingPackageSchema.parse(raw);
}

describe("externalBriefingPublishService", () => {
  it("publishes a minimal valid package and derives evidenceBasis correctly", async () => {
    const database = await freshDatabase();
    const service = externalBriefingPublishService(database);
    const pkg = withAnalysisArticle(basePackage("smoke-run-published-0001", "2026-09-03"));

    const result = await service.publish(pkg, actor);

    expect(result.status).toBe("draft");
    expect(result.localDate).toBe("2026-09-03");
    expect(result.evidenceCreated).toBe(2);
    expect(result.publications).toHaveLength(2);
    expect(result.briefUrl).toContain("/geopolitical-brief");

    const brief = result.publications.find((p) => p.section === "daily_brief");
    const narrativeWatch = result.publications.find((p) => p.section === "narrative_watch");
    expect(brief).toBeDefined();
    expect(narrativeWatch).toBeDefined();
    expect(narrativeWatch!.title.startsWith("Analysis: ")).toBe(true);

    const rows = await database.select().from(publication);
    expect(rows).toHaveLength(2);
    const nwRow = rows.find((row) => row.section === "narrative_watch")!;
    expect(nwRow.status).toBe("draft");
    expect((nwRow.narrativeWatchDetails as { evidenceBasis?: string } | null)?.evidenceBasis).toBe("analysis");
    const nwEvidenceLinks = await database.select().from(publicationEvidence)
      .where(eq(publicationEvidence.publicationId, nwRow.id));
    expect(nwEvidenceLinks).toHaveLength(0);

    const briefRow = rows.find((row) => row.section === "daily_brief")!;
    expect(briefRow.narrativeWatchDetails).toBeNull();

    const runs = await database.select().from(briefingRun).where(eq(briefingRun.localDate, "2026-09-03"));
    expect(runs).toHaveLength(1);
    expect(runs[0]!.stage).toBe("external_publish:smoke-run-published-0001");

    const checks = await database.select().from(briefingQualityCheck)
      .where(eq(briefingQualityCheck.briefingRunId, runs[0]!.id));
    const dailyChecks = checks.filter((c) => c.candidateKey === "daily-brief");
    const articleChecks = checks.filter((c) => c.candidateKey === "article-1");
    expect(dailyChecks.length).toBeGreaterThan(0);
    expect(articleChecks.length).toBeGreaterThan(0);
    expect(dailyChecks.every((c) => c.status === "pass")).toBe(true);
    expect(articleChecks.every((c) => c.status === "pass")).toBe(true);
    expect(articleChecks.some((c) => c.checkName === "analysis_disclosure")).toBe(true);
  });

  it("fails a quality check and leaves no trace", async () => {
    const database = await freshDatabase();
    const service = externalBriefingPublishService(database);
    const pkg = withUnattributedSingleSourceArticle(basePackage("smoke-run-failing-0001", "2026-09-04"));

    await expect(service.publish(pkg, actor)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    expect(await database.select().from(briefingRun)).toHaveLength(0);
    expect(await database.select().from(externalBriefingSubmission)).toHaveLength(0);
    expect(await database.select().from(publication)).toHaveLength(0);
    expect(await database.select().from(briefingQualityCheck)).toHaveLength(0);
  });

  it("returns the first run's result as a duplicate on a repeat submission", async () => {
    const database = await freshDatabase();
    const service = externalBriefingPublishService(database);
    const pkg = basePackage("smoke-run-duplicate-0001", "2026-09-05");

    const first = await service.publish(pkg, actor);
    const second = await service.publish(pkg, actor);

    expect(first.status).toBe("draft");
    expect(second.status).toBe("duplicate");
    expect(second.publications).toEqual(first.publications);
    expect(second.evidenceCreated).toBe(first.evidenceCreated);

    expect(await database.select().from(briefingRun)).toHaveLength(1);
    expect(await database.select().from(externalBriefingSubmission)).toHaveLength(1);
    expect(await database.select().from(publication)).toHaveLength(1);
  });

  it("allows separate external editions for the same local date", async () => {
    const database = await freshDatabase();
    const service = externalBriefingPublishService(database);
    const localDate = "2026-09-06";

    await service.publish(basePackage("smoke-run-same-date-0001", localDate), actor);
    await service.publish(basePackage("smoke-run-same-date-0002", localDate), actor);

    const runs = await database.select().from(briefingRun).where(eq(briefingRun.localDate, localDate));
    expect(runs).toHaveLength(2);
    expect(runs.map((run) => run.stage).sort()).toEqual([
      "external_publish:smoke-run-same-date-0001",
      "external_publish:smoke-run-same-date-0002",
    ]);
    expect(await database.select().from(externalBriefingSubmission)).toHaveLength(2);
    expect(await database.select().from(publication)).toHaveLength(2);
  });

  it("rejects a reused runId carrying different package content", async () => {
    const database = await freshDatabase();
    const service = externalBriefingPublishService(database);
    const runId = "smoke-run-conflict-0001";
    const first = basePackage(runId, "2026-09-06");
    const second = { ...basePackage(runId, "2026-09-06"), composer: "a-different-composer" };

    await service.publish(first, actor);
    await expect(service.publish(second, actor)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
