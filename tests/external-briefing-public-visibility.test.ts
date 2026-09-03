import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase } from "@/server/db/testing";
import { briefingControl } from "@/server/db/schema";
import { externalBriefingPublishService } from "@/server/modules/briefing/external-publish";
import { publicationService } from "@/server/modules/publications/service";
import {
  externalBriefingPackageSchema,
  type ExternalBriefingPackage,
} from "@/server/contracts/external-briefing";
import type { Actor } from "@/server/core/audit";

/* This service is only ever exercised through `publicationService(db)` here —
 * never through the cached, `unstable_cache`-wrapped `listBriefingPublications`
 * in `lib/publications.ts` that the real `/api/v1/published-publications`
 * route and `/geopolitical-brief` page call. That wrapper resolves its own
 * `db()` singleton rather than taking an injectable database, so it cannot
 * run against this test's PGlite instance. `publicationService(db).listBriefingPublic(...)`
 * is what that cached wrapper calls underneath (see `lib/publications.ts`'s
 * `cachedBriefingPublications`), so asserting through it proves the exact
 * query the public page depends on, without re-testing Next.js's own caching
 * layer — that boundary is covered elsewhere, not by this feature. */

vi.mock("@/server/core/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/core/config")>();
  return {
    ...actual,
    briefingFeatures: () => ({ ...actual.briefingFeatures(), autoPublish: true }),
  };
});

const actor: Actor = { label: "test:external-briefing", userId: null };

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
        url: "https://www.gov.il/en/departments/news/statement-frontier-readiness-2",
        publishedAt: `${localDate}T08:00:00Z`,
        excerpt:
          "The Israeli security cabinet convened and confirmed that the armed forces maintain a heightened readiness posture along the northern frontier in response to ongoing regional tensions and will continue coordinated defensive preparations.",
        language: "en",
      },
      {
        key: "c-jpost",
        publisherKey: "jpost",
        title: "Jerusalem Post Details Continued Northern Frontier Preparations",
        url: "https://www.jpost.com/article/frontier-preparations-2",
        publishedAt: `${localDate}T09:00:00Z`,
        excerpt:
          "According to defense officials cited by the paper, forces along the northern frontier remain on a heightened readiness posture as regional tensions continue, with additional coordinated preparations reported by military correspondents this week.",
        language: "en",
      },
    ],
    dailyBrief: {
      title: "Northern Frontier Readiness Posture Holds Steady, Public Visibility Check",
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

describe("externalBriefingPublishService — public visibility", () => {
  it("a published edition appears through the public listing query exactly once, even after a duplicate resend", async () => {
    const database = await freshDatabase();
    await database.update(briefingControl)
      .set({ automaticPublicationPaused: false })
      .where(eq(briefingControl.id, "global"));

    const service = externalBriefingPublishService(database);
    const pkg = basePackage("public-visibility-run-0001", "2026-09-07");

    const first = await service.publish(pkg, actor);
    expect(first.status).toBe("published");

    const publicRows = await publicationService(database).listBriefingPublic({ limit: 25 });
    const visible = publicRows.find((row) => row.publicId === first.publications[0]!.publicId);
    expect(visible).toBeDefined();
    expect(visible!.title).toBe(pkg.dailyBrief.title);
    expect(visible!.section).toBe("daily_brief");

    // Resend the identical package under the same runId.
    const second = await service.publish(pkg, actor);
    expect(second.status).toBe("duplicate");
    expect(second.publications).toEqual(first.publications);

    const publicRowsAfterResend = await publicationService(database).listBriefingPublic({ limit: 25 });
    const matches = publicRowsAfterResend.filter((row) => row.title === pkg.dailyBrief.title);
    expect(matches).toHaveLength(1);
  });
});
