import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import type { Database } from "@/server/db/client";
import { publicationService } from "@/server/modules/publications/service";
import { updatePublicationSchema } from "@/server/contracts/publication";
import {
  appliesNonContentFields,
  changedTrioFields,
  emptyHumanUpdate,
  incoherentEditorialUpdate,
} from "@/server/modules/publications/rules";

/**
 * VA-46 — a developing story may not publish an internally inconsistent
 * version.
 *
 * The Lebanon record reached Production with a headline describing one version
 * of events, a summary describing the updated version, a body still describing
 * the previous one, and a correction log claiming the story had been updated.
 *
 * The transaction was never at fault. What failed is that every content field
 * is optional and only `changeSummary` is required, so the service faithfully
 * applied whatever subset arrived and `recordVersion` faithfully recorded a
 * revision that had not happened.
 *
 * These cover the two conditions from `publications/rules.ts` at both levels:
 * the pure rules directly, and the service refusing over a real database.
 */

let db: TestDatabase;
beforeAll(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });

const actor = { label: "service:editorial-run", userId: null };
const machineAuthor = "whole-site-editorial";

/**
 * A real `editorial_run` row per operation.
 *
 * `publication.editorial_run_id` carries a foreign key, and migration `0060`'s
 * publish gate additionally requires that id paired with a non-blank operation
 * key and machine author. A fabricated uuid satisfies neither, and a run per
 * operation also keeps `publication_editorial_operation_once` from collapsing
 * two operations that happen to share a key.
 */
async function seedRun(): Promise<string> {
  const id = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO editorial_run (id, run_key, request_hash, mode, local_date, requested_by, request, status, stage)
    VALUES (${id}, ${`coherence-${id}`}, ${"a".repeat(64)}, 'operations', '2026-09-07',
            'service:editorial-run', ${JSON.stringify({ runId: id, mode: "operations", operations: [] })}::jsonb,
            'running', 'publication')
  `);
  return id;
}

const stored = { title: "Strike reported near Beirut", summary: "Early reports.", body: "The first account." };

async function publishStory(key: string, canonicalStoryId: string) {
  return publicationService(db as unknown as Database).applyEditorial(
    {
      key,
      action: "create",
      publication: {
        kind: "brief",
        section: "news",
        canonicalStoryId,
        title: stored.title,
        summary: stored.summary,
        body: stored.body,
        language: "en",
      },
    } as never,
    { runId: await seedRun(), machineAuthor },
    null,
    actor,
  );
}

/** The editorial path, over a real database. */
async function applyUpdate(publicationId: string, key: string, publication: Record<string, unknown>) {
  return publicationService(db as unknown as Database).applyEditorial(
    { key, action: "update", publicationId, publication } as never,
    { runId: await seedRun(), machineAuthor },
    null,
    actor,
  );
}

describe("the update contract refuses a claim carrying no change", () => {
  it("rejects a change summary sent on its own", () => {
    const parsed = updatePublicationSchema.safeParse({ changeSummary: "Updated with the new casualty figure." });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toMatch(/at least one field/i);
  });

  it("accepts a change summary that carries a field", () => {
    expect(updatePublicationSchema.safeParse({
      changeSummary: "Corrected the body.",
      body: "A corrected account.",
    }).success).toBe(true);
  });
});

describe("the pure coherence rules", () => {
  it("does not count a resent identical field as a change", () => {
    expect(changedTrioFields(stored, { title: stored.title })).toEqual([]);
    expect(changedTrioFields(stored, { title: "A different headline" })).toEqual(["title"]);
  });

  it("treats a null summary and a blank summary as the same absence", () => {
    expect(changedTrioFields({ ...stored, summary: null }, { summary: "" })).toEqual([]);
  });

  it("counts an explicit null on a non-content field as an application", () => {
    expect(appliesNonContentFields({ editorialTopic: null })).toBe(true);
    expect(appliesNonContentFields({ editorialTopic: undefined })).toBe(false);
    expect(appliesNonContentFields({ title: "x" })).toBe(false);
  });

  it("refuses a headline revision that leaves the body behind", () => {
    expect(incoherentEditorialUpdate(stored, { title: "Strike confirmed near Beirut" }))
      .toMatch(/must restate the body/i);
  });

  it("refuses a summary revision that leaves the body behind", () => {
    expect(incoherentEditorialUpdate(stored, { summary: "Now confirmed by two sources." }))
      .toMatch(/must restate the body/i);
  });

  it("allows a headline revision that restates the body", () => {
    expect(incoherentEditorialUpdate(stored, {
      title: "Strike confirmed near Beirut",
      summary: "Confirmed by two sources.",
      body: "A confirmed account.",
    })).toBeNull();
  });

  it("allows a body-only correction", () => {
    expect(incoherentEditorialUpdate(stored, { body: "A corrected account." })).toBeNull();
  });

  it("allows a non-content revision such as a section move", () => {
    expect(incoherentEditorialUpdate(stored, { section: "israel_update" })).toBeNull();
  });

  it("refuses an operation that applies nothing at all", () => {
    expect(incoherentEditorialUpdate(stored, {})).toMatch(/applies no change/i);
    expect(incoherentEditorialUpdate(stored, { title: stored.title })).toMatch(/applies no change/i);
  });

  it("carries only the empty-update rule into the human path", () => {
    // A human fixing a headline typo must not be forced to resubmit the body.
    expect(emptyHumanUpdate(stored, { title: "Strike reported near Beirut." })).toBe(false);
    expect(emptyHumanUpdate(stored, {})).toBe(true);
  });
});

describe("the editorial path refuses an incoherent update against a real database", () => {
  it("refuses a headline change that does not restate the body, and publishes nothing", async () => {
    const created = await publishStory("op-headline", "beirut-strike-headline");

    await expect(applyUpdate(created.id, "op-headline-2", {
      title: "Strike confirmed near Beirut",
      changeSummary: "Headline and body updated with the confirmation.",
    })).rejects.toThrow(/must restate the body/i);

    const after = await publicationService(db as unknown as Database).get(created.id);
    expect(after.title).toBe(stored.title);
    expect(after.body).toBe(stored.body);
    expect(after.status).toBe("published");
  });

  it("accepts the same revision when the body travels with it", async () => {
    const created = await publishStory("op-coherent", "beirut-strike-coherent");

    const updated = await applyUpdate(created.id, "op-coherent-2", {
      title: "Strike confirmed near Beirut",
      summary: "Confirmed by two sources.",
      body: "A confirmed account, with the figure revised.",
      changeSummary: "Confirmed the strike and revised the casualty figure.",
    });

    expect(updated.title).toBe("Strike confirmed near Beirut");
    expect(updated.body).toBe("A confirmed account, with the figure revised.");
    expect(updated.status).toBe("updated");
    // A legitimate developing-story update keeps the record it belongs to.
    expect(updated.publicId).toBe(created.publicId);
    expect(updated.canonicalStoryId).toBe("beirut-strike-coherent");
  });

  it("refuses an update whose fields all match what is already stored", async () => {
    const created = await publishStory("op-noop", "beirut-strike-noop");

    await expect(applyUpdate(created.id, "op-noop-2", {
      title: stored.title,
      body: stored.body,
      changeSummary: "Updated the story.",
    })).rejects.toThrow(/applies no change/i);
  });
});
