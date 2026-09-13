/**
 * The task board's SQL rules, asserted against PGlite so they behave as in
 * Neon: the timeline is append-only, a status change is recorded by the
 * database, the public role sees nothing, and a replayed event key is a
 * no-op rather than a duplicate.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { as, freshDatabase, SQLSTATE, violation, type TestDatabase } from "@/server/db/testing";

let db: TestDatabase;
beforeAll(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });

async function insertTask(taskKey: string): Promise<string> {
  const rows = (await db.execute(sql`
    INSERT INTO ops_task (task_key, title, agent, environment, status)
    VALUES (${taskKey}, ${"Task " + taskKey}, 'claude', 'test', 'running') RETURNING id`)).rows as { id: string }[];
  return rows[0]!.id;
}

describe("ops_task_event is append-only", () => {
  it("rejects UPDATE and DELETE through reject_mutation()", async () => {
    const taskId = await insertTask("storage:append-only");
    const [event] = (await db.execute(sql`
      INSERT INTO ops_task_event (task_id, kind, actor_label, message)
      VALUES (${taskId}, 'note', 'test', 'first') RETURNING id`)).rows as { id: string }[];

    const update = await violation(db.execute(sql`UPDATE ops_task_event SET message = 'rewritten' WHERE id = ${event!.id}`));
    expect(update.code).toBe(SQLSTATE.restrictViolation);
    expect(update.message).toMatch(/ops_task_event is append-only; UPDATE is not permitted/);

    const remove = await violation(db.execute(sql`DELETE FROM ops_task_event WHERE id = ${event!.id}`));
    expect(remove.code).toBe(SQLSTATE.restrictViolation);
    expect(remove.message).toMatch(/DELETE is not permitted/);
  });
});

describe("status transitions are recorded by the database", () => {
  it("writes a status event with the request identity on a bare UPDATE", async () => {
    const taskId = await insertTask("storage:trigger");
    await as(db, "app_service", "service:test-writer", async (tx) => {
      await tx.execute(sql`UPDATE ops_task SET status = 'blocked' WHERE id = ${taskId}`);
      const rows = (await tx.execute(sql`
        SELECT kind, actor_label, from_status, to_status FROM ops_task_event WHERE task_id = ${taskId}`)).rows;
      expect(rows).toEqual([
        { kind: "status", actor_label: "service:test-writer", from_status: "running", to_status: "blocked" },
      ]);
    });
  });

  it("does not record a transition twice when the transaction already wrote it", async () => {
    const taskId = await insertTask("storage:trigger-dedupe");
    await db.execute(sql.raw("BEGIN"));
    try {
      await db.execute(sql`
        INSERT INTO ops_task_event (task_id, kind, actor_label, from_status, to_status, message)
        VALUES (${taskId}, 'finished', 'service:ops-reporter', 'running', 'completed', 'done')`);
      await db.execute(sql`UPDATE ops_task SET status = 'completed', reported_finish = true WHERE id = ${taskId}`);
      const rows = (await db.execute(sql`SELECT kind FROM ops_task_event WHERE task_id = ${taskId} ORDER BY created_at`)).rows;
      expect(rows).toEqual([{ kind: "finished" }]);
    } finally {
      await db.execute(sql.raw("ROLLBACK"));
    }
  });

  it("leaves a non-status UPDATE unrecorded", async () => {
    const taskId = await insertTask("storage:trigger-quiet");
    await db.execute(sql`UPDATE ops_task SET summary = 'progress' WHERE id = ${taskId}`);
    const rows = (await db.execute(sql`SELECT count(*)::int AS n FROM ops_task_event WHERE task_id = ${taskId}`)).rows as { n: number }[];
    expect(rows[0]!.n).toBe(0);
  });
});

describe("row-level security", () => {
  it("hides every board table from app_public", async () => {
    await insertTask("storage:rls");
    for (const table of ["ops_task", "ops_task_event", "ops_task_attachment", "ops_reporter"]) {
      const v = await as(db, "app_public", null, (tx) => violation(tx.execute(sql.raw(`SELECT * FROM ${table}`))));
      expect(v.code, table).toBe("42501");
      expect(v.message).toMatch(new RegExp(`permission denied for table ${table}`));
    }
  });

  it("lets app_staff read and append, and refuses an app_staff DELETE on events", async () => {
    const taskId = await insertTask("storage:rls-staff");
    await as(db, "app_staff", "human:owner", async (tx) => {
      await tx.execute(sql`INSERT INTO ops_task_event (task_id, kind, actor_label) VALUES (${taskId}, 'note', 'human:owner')`);
      const rows = (await tx.execute(sql`SELECT count(*)::int AS n FROM ops_task_event WHERE task_id = ${taskId}`)).rows as { n: number }[];
      expect(rows[0]!.n).toBe(1);
      const v = await violation(tx.execute(sql`DELETE FROM ops_task_event WHERE task_id = ${taskId}`));
      expect(v.code).toBe("42501");
    });
  });
});

describe("event_key idempotency", () => {
  it("refuses a second event with the same key on the same task, and allows it on another", async () => {
    const first = await insertTask("storage:idempotent-a");
    const second = await insertTask("storage:idempotent-b");
    await db.execute(sql`INSERT INTO ops_task_event (task_id, event_key, kind, actor_label) VALUES (${first}, 'evt-1', 'progress', 'test')`);
    const dup = await violation(db.execute(sql`INSERT INTO ops_task_event (task_id, event_key, kind, actor_label) VALUES (${first}, 'evt-1', 'progress', 'test')`));
    expect(dup.code).toBe(SQLSTATE.uniqueViolation);
    await db.execute(sql`INSERT INTO ops_task_event (task_id, event_key, kind, actor_label) VALUES (${second}, 'evt-1', 'progress', 'test')`);
    /* ON CONFLICT against the partial index is what the service relies on. */
    const rows = (await db.execute(sql`
      INSERT INTO ops_task_event (task_id, event_key, kind, actor_label) VALUES (${first}, 'evt-1', 'progress', 'test')
      ON CONFLICT (task_id, event_key) WHERE event_key IS NOT NULL DO NOTHING RETURNING id`)).rows;
    expect(rows).toHaveLength(0);
  });

  it("allows any number of key-less events", async () => {
    const taskId = await insertTask("storage:keyless");
    await db.execute(sql`INSERT INTO ops_task_event (task_id, kind, actor_label) VALUES (${taskId}, 'heartbeat', 'test')`);
    await db.execute(sql`INSERT INTO ops_task_event (task_id, kind, actor_label) VALUES (${taskId}, 'heartbeat', 'test')`);
    const rows = (await db.execute(sql`SELECT count(*)::int AS n FROM ops_task_event WHERE task_id = ${taskId}`)).rows as { n: number }[];
    expect(rows[0]!.n).toBe(2);
  });
});

describe("constraints", () => {
  it("accepts only self-hosted attachment URLs", async () => {
    const taskId = await insertTask("storage:attachment-url");
    const hotlink = await violation(db.execute(sql`
      INSERT INTO ops_task_attachment (task_id, kind, url, content_type, byte_size, actor_label)
      VALUES (${taskId}, 'screenshot', 'https://cdn.example.com/shot.png', 'image/png', 10, 'test')`));
    expect(hotlink.constraint).toBe("ops_task_attachment_is_self_hosted");
    await db.execute(sql`
      INSERT INTO ops_task_attachment (task_id, kind, url, content_type, byte_size, actor_label)
      VALUES (${taskId}, 'screenshot', 'https://abc123.public.blob.vercel-storage.com/ops/attachments/x/y.png', 'image/png', 10, 'test')`);
  });

  it("refuses an unknown agent, kind or status", async () => {
    const agent = await violation(db.execute(sql`INSERT INTO ops_task (task_key, title, agent, environment) VALUES ('c:1', 'x', 'copilot', 'test')`));
    expect(agent.constraint).toBe("ops_task_agent_known");
    const status = await violation(db.execute(sql`INSERT INTO ops_task (task_key, title, agent, environment, status) VALUES ('c:2', 'x', 'claude', 'test', 'done')`));
    expect(status.constraint).toBe("ops_task_status_known");
    const kind = await violation(db.execute(sql`INSERT INTO ops_task (task_key, title, agent, environment, kind) VALUES ('c:3', 'x', 'claude', 'test', 'misc')`));
    expect(kind.constraint).toBe("ops_task_kind_known");
  });
});
