import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SQLSTATE, as, freshDatabase, violation, type TestDatabase } from "@/server/db/testing";
import { publicationService } from "@/server/modules/publications/service";
import { reportService } from "@/server/modules/reports/service";
import { enforceRateLimit, REPORT_SUBMISSION } from "@/server/core/rate-limit";
import {
  appUser,
  entityVersion,
  narrative,
  publication,
  publicationNarrative,
  report,
  reportStatusHistory,
} from "@/server/db/schema";

const actor = { label: "editor@example.org", userId: null };

async function seedUser(db: TestDatabase, displayName: string) {
  const [row] = await db
    .insert(appUser)
    .values({ externalId: `auth|${displayName}`, displayName })
    .returning();
  return row!;
}

const brief = {
  kind: "brief" as const,
  title: "What we know about the border incident",
  body: "The reporting so far.",
  language: "en",
};

describe("publications", () => {
  it("creates a brief and versions it, like every other versioned entity", async () => {
    const db = await freshDatabase();
    const row = await publicationService(db).create(brief, actor);

    expect(row.kind).toBe("brief");
    expect(row.status).toBe("draft");
    expect(row.publicId).toMatch(/^what-we-know-about-the-border-incident-[a-z0-9]{5}$/);

    const versions = await db.select().from(entityVersion);
    expect(versions).toHaveLength(1);
    expect(versions[0]!.entityType).toBe("brief");
  });

  it("requires a scenario to state a likelihood band", async () => {
    const db = await freshDatabase();
    const v = await violation(
      db.insert(publication).values({
        kind: "scenario",
        publicId: "s-1",
        title: "A scenario",
        body: "What might happen.",
        language: "en",
      }),
    );
    expect(v.code).toBe(SQLSTATE.checkViolation);
    expect(v.constraint).toBe("only_scenarios_state_a_likelihood");
  });

  it("refuses a likelihood band on anything that is not a scenario", async () => {
    const db = await freshDatabase();
    const v = await violation(
      db.insert(publication).values({
        kind: "brief",
        publicId: "b-1",
        title: "A brief",
        body: "Body.",
        language: "en",
        scenarioLikelihood: "likely",
      }),
    );
    expect(v.constraint).toBe("only_scenarios_state_a_likelihood");
  });

  it("accepts a scenario with a band, and stores no number anywhere", async () => {
    const db = await freshDatabase();
    const row = await publicationService(db).create(
      {
        kind: "scenario",
        title: "Escalation along the northern border",
        body: "What would have to happen.",
        language: "en",
        scenarioLikelihood: "unlikely",
        scenarioIndicators: "Reserve call-ups; evacuation orders.",
      },
      actor,
    );
    expect(row.scenarioLikelihood).toBe("unlikely");

    /* There is deliberately no numeric probability column on this table. */
    const columns = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'publication'`);
    const names = columns.rows.map((c) => (c as { column_name: string }).column_name);
    expect(names.filter((n) => /probability|percent|score/.test(n))).toEqual([]);
  });

  it("explains an illegal transition instead of surfacing a constraint error", async () => {
    const db = await freshDatabase();
    const row = await publicationService(db).create(brief, actor);
    await expect(publicationService(db).transition(row.id, { to: "published" }, actor)).rejects.toThrow(
      /cannot move to "published"/,
    );
  });

  it("refuses to approve without a known reviewer identity", async () => {
    const db = await freshDatabase();
    const svc = publicationService(db);
    const row = await svc.create(brief, actor);
    await svc.transition(row.id, { to: "under_review" }, actor);
    await expect(svc.transition(row.id, { to: "approved" }, actor)).rejects.toThrow(
      /known reviewer identity/,
    );
  });

  it("refuses self-approval", async () => {
    const db = await freshDatabase();
    const author = await seedUser(db, "The Author");
    const authorActor = { label: author.displayName, userId: author.id };
    const svc = publicationService(db);
    const row = await svc.create(brief, authorActor);
    await svc.transition(row.id, { to: "under_review" }, authorActor);
    await expect(svc.transition(row.id, { to: "approved" }, authorActor)).rejects.toThrow(
      /cannot also be the reviewer/,
    );
  });

  it("publishes once approved by a second human, and stamps the timestamp", async () => {
    const db = await freshDatabase();
    const author = await seedUser(db, "The Author");
    const reviewer = await seedUser(db, "A Reviewer");
    const authorActor = { label: author.displayName, userId: author.id };
    const reviewerActor = { label: reviewer.displayName, userId: reviewer.id };

    const svc = publicationService(db);
    const row = await svc.create(brief, authorActor);
    await svc.transition(row.id, { to: "under_review" }, authorActor);
    await svc.transition(row.id, { to: "approved" }, reviewerActor);
    const published = await svc.transition(row.id, { to: "published" }, reviewerActor);

    expect(published.status).toBe("published");
    expect(published.approvedBy).toBe(reviewer.id);
    expect(published.publishedAt).not.toBeNull();
  });

  it("refuses to publish with no approver at all", async () => {
    const db = await freshDatabase();
    const [row] = await db
      .insert(publication)
      .values({ kind: "brief", publicId: "b-2", title: "A brief", body: "Body.", language: "en" })
      .returning();
    const v = await violation(
      db.execute(sql`UPDATE publication SET status = 'published' WHERE id = ${row!.id}`),
    );
    expect(v.constraint).toBe("published_publication_has_timestamp_and_approver");
  });

  it("lets public readers see only narratives attached to live publications", async () => {
    const db = await freshDatabase();
    const [visible, privateNarrative] = await db
      .insert(narrative)
      .values([
        { publicId: "n-visible", title: "Visible narrative", language: "en" },
        { publicId: "n-private", title: "Private narrative", language: "en" },
      ])
      .returning();
    const publishedAt = new Date();
    const reviewer = await seedUser(db, "Narrative Reviewer");
    const [live] = await db
      .insert(publication)
      .values({
        kind: "brief",
        section: "narrative_watch",
        publicId: "live-narrative-brief",
        title: "A published narrative brief",
        body: "Source-grounded body.",
        language: "en",
        status: "published",
        publishedAt,
        approvedBy: reviewer.id,
        narrativeWatchDetails: {
          exactClaim: "A monitored claim.",
          propagators: ["A named publisher"],
          arenas: ["news"],
          trendDirection: "stable",
          israeliPosition: "The attributed Israeli position.",
          securityContext: "Relevant security context.",
          supportingEvidenceIds: [],
          contradictingEvidenceIds: [],
          verificationState: "unresolved",
          knownUnknowns: ["Independent confirmation remains unavailable."],
        },
      })
      .returning();
    await db.insert(publicationNarrative).values({
      publicationId: live!.id,
      narrativeId: visible!.id,
    });

    await as(db, "app_public", null, async (publicDb) => {
      const rows = await publicDb.select().from(narrative);
      expect(rows.map((row) => row.publicId)).toEqual(["n-visible"]);

      const detail = await publicationService(publicDb).getPublicDetail(live!.publicId);
      expect(detail.narratives).toEqual([
        expect.objectContaining({ publicId: "n-visible", title: "Visible narrative" }),
      ]);
    });

    expect(privateNarrative!.publicId).toBe("n-private");
  });

  it("allows the service role to create narrative monitoring records", async () => {
    const db = await freshDatabase();
    await as(db, "app_service", "service:briefing", async (serviceDb) => {
      const [row] = await serviceDb
        .insert(narrative)
        .values({ publicId: "n-service", title: "Service-created narrative", language: "en" })
        .returning();
      expect(row?.publicId).toBe("n-service");
    });
  });
});

describe("reports", () => {
  it("accepts a submission and gives back a public id", async () => {
    const db = await freshDatabase();
    const row = await reportService(db).submit({ body: "This video looks altered." });
    expect(row.status).toBe("received");
    expect(row.publicId).toMatch(/^r-/);
    /* Unreviewed public input is internal, not public. */
    expect(row.dataClass).toBe("internal");
  });

  it("hashes the submitter rather than storing them", async () => {
    const db = await freshDatabase();
    const row = await reportService(db).submit({ body: "Something." }, "203.0.113.7");
    expect(row.submittedFromHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.submittedFromHash).not.toContain("203.0.113");
  });

  it("refuses a report that says nothing", async () => {
    const db = await freshDatabase();
    const v = await violation(db.insert(report).values({ publicId: "r-empty", body: "   " }));
    expect(v.constraint).toBe("report_says_something");
  });

  it("records every status change in an append-only trail", async () => {
    const db = await freshDatabase();
    const svc = reportService(db);
    const row = await svc.submit({ body: "This video looks altered." });
    await svc.triage(row.id, { to: "triaged" }, actor);
    await svc.triage(row.id, { to: "investigating" }, actor);

    const trail = await db
      .select()
      .from(reportStatusHistory)
      .where(eq(reportStatusHistory.reportId, row.id));
    expect(trail.map((t) => t.toStatus)).toEqual(["triaged", "investigating"]);
    expect(trail[0]!.actorLabel).toBe(actor.label);

    const v = await violation(db.execute(sql`UPDATE report_status_history SET to_status = 'closed'`));
    expect(v.message).toMatch(/report_status_history is append-only/);
  });

  it("refuses to close a report with no stated reason", async () => {
    const db = await freshDatabase();
    const svc = reportService(db);
    const row = await svc.submit({ body: "Something." });
    await svc.triage(row.id, { to: "triaged" }, actor);
    await expect(svc.triage(row.id, { to: "closed" }, actor)).rejects.toThrow(/resolution note/);
  });

  it("refuses to link to an item without naming one", async () => {
    const db = await freshDatabase();
    const svc = reportService(db);
    const row = await svc.submit({ body: "Something." });
    await svc.triage(row.id, { to: "triaged" }, actor);
    await expect(svc.triage(row.id, { to: "linked_to_existing_item" }, actor)).rejects.toThrow(
      /requires the item/,
    );
  });

  it("explains an illegal transition", async () => {
    const db = await freshDatabase();
    const svc = reportService(db);
    const row = await svc.submit({ body: "Something." });
    await expect(svc.triage(row.id, { to: "converted_to_item" }, actor)).rejects.toThrow(
      /cannot move to "converted_to_item"/,
    );
  });
});

describe("rate limiting", () => {
  it("counts within a window and refuses past the ceiling", async () => {
    const db = await freshDatabase();
    const policy = { limit: 3, windowSeconds: 3600 };

    for (let i = 1; i <= 3; i++) {
      const { count } = await enforceRateLimit(db, "test:bucket", policy);
      expect(count).toBe(i);
    }
    await expect(enforceRateLimit(db, "test:bucket", policy)).rejects.toThrow(/Too many requests/);
  });

  it("counts a refused request too, so being over the limit is not a free retry", async () => {
    const db = await freshDatabase();
    const policy = { limit: 1, windowSeconds: 3600 };
    await enforceRateLimit(db, "b", policy);
    await expect(enforceRateLimit(db, "b", policy)).rejects.toThrow();

    /* Two calls, so the window shows 2 — the refused one incremented from 1
       to 2 rather than being waved through uncounted. Had it not counted, a
       caller over the limit would get a fresh attempt every time, which is
       the opposite of a rate limit. */
    const rows = await db.execute<{ count: number }>(
      sql`SELECT count FROM rate_limit WHERE bucket = 'b'`,
    );
    expect(Number((rows.rows[0] as { count: number }).count)).toBe(2);
  });

  it("keeps buckets independent", async () => {
    const db = await freshDatabase();
    const policy = { limit: 1, windowSeconds: 3600 };
    await enforceRateLimit(db, "one", policy);
    await expect(enforceRateLimit(db, "two", policy)).resolves.toMatchObject({ count: 1 });
  });

  it("has a real ceiling configured for public submission", () => {
    expect(REPORT_SUBMISSION.limit).toBeLessThanOrEqual(20);
    expect(REPORT_SUBMISSION.windowSeconds).toBeGreaterThanOrEqual(600);
  });
});
