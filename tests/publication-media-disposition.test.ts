import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import type { Database } from "@/server/db/client";
import { publicationService } from "@/server/modules/publications/service";

/**
 * VA-49 — why a record has no picture, recorded on the record.
 *
 * `media = null` was produced by at least four causes with no discriminator,
 * and the only signal that existed lived in the run report's JSON and was never
 * written down. So once the report scrolled past, "an editor chose text" and
 * "we tried and failed" were the same thing.
 *
 * This is a **state, not a gate**. The owner ruled on 2026-09-07 that a picture
 * is not a condition of publishing or of a homepage slot, and these tests pin
 * that too: every disposition still publishes.
 */

let db: TestDatabase;
beforeAll(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });

const actor = { label: "service:editorial-run", userId: null };
const service = () => publicationService(db as unknown as Database);

async function seedRun(): Promise<string> {
  const id = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO editorial_run (id, run_key, request_hash, mode, local_date, requested_by, request, status, stage)
    VALUES (${id}, ${`disposition-${id}`}, ${"b".repeat(64)}, 'operations', '2026-09-08',
            'service:editorial-run', ${JSON.stringify({ runId: id, mode: "operations", operations: [] })}::jsonb,
            'running', 'publication')
  `);
  return id;
}

async function publish(key: string, outcome: "offered" | "unavailable" | "none") {
  return service().applyEditorial(
    {
      key,
      action: "create",
      publication: {
        kind: "brief", section: "news", title: `A record filed as ${key}`,
        body: "The account as filed.", language: "en",
      },
    } as never,
    { runId: await seedRun(), machineAuthor: "whole-site-editorial" },
    null,
    actor,
    undefined,
    outcome,
  );
}

describe("a record records why it has no picture", () => {
  it("marks an operation that offered no media as deliberately text-led", async () => {
    const row = await publish("op-none", "none");
    expect(row.mediaDisposition).toBe("text_led");
  });

  it("marks an operation whose media could not be used as unavailable", async () => {
    const row = await publish("op-failed", "unavailable");
    expect(row.mediaDisposition).toBe("media_unavailable");
  });

  it("publishes either way — this is a state, not a gate", async () => {
    for (const outcome of ["none", "unavailable"] as const) {
      const row = await publish(`op-publishes-${outcome}`, outcome);
      expect(row.status).toBe("published");
      expect(row.publishedAt).not.toBeNull();
    }
  });

  it("carries the disposition onto the public projection", async () => {
    const row = await publish("op-projected", "unavailable");
    const projected = await service().getPublic(row.publicId);
    expect(projected.mediaDisposition).toBe("media_unavailable");
  });
});

describe("an update does not relabel a record it did not re-examine", () => {
  it("keeps the stored disposition when the update brought no media", async () => {
    const created = await publish("op-keep", "unavailable");
    expect(created.mediaDisposition).toBe("media_unavailable");

    const updated = await service().applyEditorial(
      {
        key: "op-keep-2", action: "update", publicationId: created.id,
        publication: { body: "A corrected account.", changeSummary: "Corrected the body." },
      } as never,
      { runId: await seedRun(), machineAuthor: "whole-site-editorial" },
      null,
      actor,
      undefined,
      "none",
    );

    // A typo fix must not turn "we tried and failed" into "deliberately text-led".
    expect(updated.mediaDisposition).toBe("media_unavailable");
  });

  it("does record a new disposition when the update re-examined media", async () => {
    const created = await publish("op-revisit", "none");
    expect(created.mediaDisposition).toBe("text_led");

    const updated = await service().applyEditorial(
      {
        key: "op-revisit-2", action: "update", publicationId: created.id,
        publication: { body: "A revised account.", changeSummary: "Revised, and sought a hero." },
      } as never,
      { runId: await seedRun(), machineAuthor: "whole-site-editorial" },
      null,
      actor,
      undefined,
      "unavailable",
    );

    expect(updated.mediaDisposition).toBe("media_unavailable");
  });
});

describe("rows that predate the column", () => {
  it("read as not recorded, never as deliberate", async () => {
    const row = await publish("op-legacy", "none");
    await db.execute(sql`UPDATE publication SET media_disposition = NULL WHERE id = ${row.id}`);
    const projected = await service().getPublic(row.publicId);
    expect(projected.mediaDisposition).toBeNull();
    expect(projected.mediaDisposition).not.toBe("text_led");
  });
});
