import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { SQLSTATE, freshDatabase, violation } from "@/server/db/testing";
import { appUser, auditLog, capabilityGrant, entityVersion, outbox } from "@/server/db/schema";
import { NEVER_AUTOMATED_CAPABILITIES } from "@/server/contracts/enums";

/**
 * These assert the constraints, not the ORM. Every one of them describes a way
 * the platform could publish something it should not have, and each is written
 * as "the database refuses this" rather than "the service avoids this".
 */

const human = { externalId: "auth|human", displayName: "A Human" };
const robot = { externalId: "svc|ingest", displayName: "Ingest Worker", isAutomated: true };

describe("migrations", () => {
  it("applies cleanly and creates every enum type", async () => {
    const db = await freshDatabase();
    const { rows } = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM pg_type WHERE typtype = 'e'`,
    );
    expect(Number(rows[0]!.n)).toBe(21);
  });
});

describe("append-only tables", () => {
  it("refuses UPDATE on audit_log", async () => {
    const db = await freshDatabase();
    await db.insert(auditLog).values({
      actorLabel: "system", action: "test", entityType: "information_item",
    });
    const v = await violation(db.execute(sql`UPDATE audit_log SET action = 'tampered'`));
    expect(v.code).toBe(SQLSTATE.restrictViolation);
    expect(v.message).toMatch(/audit_log is append-only; UPDATE is not permitted/);
  });

  it("refuses DELETE on audit_log", async () => {
    const db = await freshDatabase();
    await db.insert(auditLog).values({
      actorLabel: "system", action: "test", entityType: "information_item",
    });
    const v = await violation(db.execute(sql`DELETE FROM audit_log`));
    expect(v.code).toBe(SQLSTATE.restrictViolation);
    expect(v.message).toMatch(/audit_log is append-only; DELETE is not permitted/);
  });

  it("refuses UPDATE on entity_version", async () => {
    const db = await freshDatabase();
    const [user] = await db.insert(appUser).values(human).returning();
    await db.insert(entityVersion).values({
      entityType: "information_item", entityId: crypto.randomUUID(), versionNumber: 1,
      snapshot: { title: "before" }, changeSummary: "created",
      changeSource: "human_edit", changedBy: user!.id, changedByLabel: "A Human",
      contentHash: "d41d8cd98f00b204e9800998ecf8427e",
    });
    const v = await violation(
      db.execute(sql`UPDATE entity_version SET snapshot = '{"title":"after"}'`),
    );
    expect(v.code).toBe(SQLSTATE.restrictViolation);
    expect(v.message).toMatch(/entity_version is append-only/);
  });
});

describe("automation may never publish", () => {
  it("refuses a publishing capability to an automated identity", async () => {
    const db = await freshDatabase();
    const [bot] = await db.insert(appUser).values(robot).returning();
    const v = await violation(
      db.insert(capabilityGrant).values({
        userId: bot!.id, capability: "assessment.publish", rationale: "convenience",
      }),
    );
    expect(v.code).toBe(SQLSTATE.restrictViolation);
    expect(v.message).toMatch(/assessment\.publish may never be granted to an automated identity/);
  });

  it("allows a non-publishing capability to an automated identity", async () => {
    const db = await freshDatabase();
    const [bot] = await db.insert(appUser).values(robot).returning();
    const granted = await db
      .insert(capabilityGrant)
      .values({ userId: bot!.id, capability: "source.fetch", rationale: "runs the RSS connector" })
      .returning();
    expect(granted).toHaveLength(1);
  });

  it("refuses to flip a privileged identity to automated after the fact", async () => {
    const db = await freshDatabase();
    const [user] = await db.insert(appUser).values(human).returning();
    await db.insert(capabilityGrant).values({
      userId: user!.id, capability: "assessment.publish", rationale: "senior editor",
    });
    const v = await violation(
      db.execute(sql`UPDATE app_user SET is_automated = true WHERE id = ${user!.id}`),
    );
    expect(v.message).toMatch(/while it holds assessment\.publish/);
  });

  it("keeps the SQL capability list in step with the contract", async () => {
    const db = await freshDatabase();
    const { rows } = await db.execute<{ def: string }>(
      sql`SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname = 'reject_automated_privilege'`,
    );
    const body = rows[0]!.def;
    for (const capability of NEVER_AUTOMATED_CAPABILITIES) {
      expect(body).toContain(capability);
    }
  });
});

describe("reasoning fields cannot be blank", () => {
  it("refuses a capability grant with no rationale", async () => {
    const db = await freshDatabase();
    const [user] = await db.insert(appUser).values(human).returning();
    const v = await violation(
      db.insert(capabilityGrant).values({
        userId: user!.id, capability: "source.fetch", rationale: "   ",
      }),
    );
    expect(v.code).toBe(SQLSTATE.checkViolation);
    expect(v.constraint).toBe("capability_grant_states_why");
  });

  it("refuses a version with no change summary", async () => {
    const db = await freshDatabase();
    const v = await violation(
      db.insert(entityVersion).values({
        entityType: "brief", entityId: crypto.randomUUID(), versionNumber: 1,
        snapshot: {}, changeSummary: "", changeSource: "human_edit",
        changedByLabel: "someone", contentHash: "d41d8cd98f00b204e9800998ecf8427e",
      }),
    );
    expect(v.code).toBe(SQLSTATE.checkViolation);
    expect(v.constraint).toBe("entity_version_states_what_changed");
  });

  it("refuses an AI-sourced version that names no AI run", async () => {
    const db = await freshDatabase();
    const v = await violation(
      db.insert(entityVersion).values({
        entityType: "brief", entityId: crypto.randomUUID(), versionNumber: 1,
        snapshot: {}, changeSummary: "accepted a suggestion",
        changeSource: "ai_suggestion_accepted", changedByLabel: "editor",
        contentHash: "d41d8cd98f00b204e9800998ecf8427e",
      }),
    );
    expect(v.code).toBe(SQLSTATE.checkViolation);
    expect(v.constraint).toBe("ai_change_names_its_run");
  });
});

describe("outbox", () => {
  it("only indexes undrained rows", async () => {
    const db = await freshDatabase();
    await db.insert(outbox).values({ topic: "search.reindex", payload: { id: 1 } });
    const pending = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM outbox WHERE published_at IS NULL`,
    );
    expect(Number(pending.rows[0]!.n)).toBe(1);
  });

  it("refuses a message with no topic", async () => {
    const db = await freshDatabase();
    const v = await violation(db.insert(outbox).values({ topic: " ", payload: {} }));
    expect(v.code).toBe(SQLSTATE.checkViolation);
    expect(v.constraint).toBe("outbox_names_a_topic");
  });
});
