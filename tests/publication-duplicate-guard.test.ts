import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { briefingRun } from "@/server/db/schema";
import type { Database } from "@/server/db/client";
import { publicationService } from "@/server/modules/publications/service";

/**
 * VA-48 — one event, one canonical record.
 *
 * The guard existed, but it was written inline in `applyEditorial`'s create
 * branch and reachable from nowhere else. So the whole-site editorial run was
 * protected and the briefing auto-publish paths, which are the other way a
 * record reaches the public desk, were not. The audit measured the result:
 * three exact-title pairs live and five near-duplicate pairs.
 *
 * These pin the guard on the paths that publish, and pin the deliberate
 * override: a human may still draft a genuinely separate story for an event
 * that already has a canonical record, because `create` writes a draft and
 * nothing is public until a person drives `transition`.
 */

let db: TestDatabase;
beforeAll(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });

const actor = { label: "service:briefing-run", userId: null };
const service = () => publicationService(db as unknown as Database);

async function seedEvent(slug: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.execute(sql`INSERT INTO event (id, slug, title) VALUES (${id}, ${slug}, ${`Event ${slug}`})`);
  return id;
}

const story = (title: string, eventId?: string) => ({
  kind: "brief" as const,
  section: "news" as const,
  title,
  body: "The account as filed.",
  language: "en",
  ...(eventId ? { eventId } : {}),
});

/**
 * One briefing run for the whole file.
 *
 * `publication.briefing_run_id` carries a foreign key so the run must exist,
 * and `briefing_run_once_per_stage_day` allows only one run per date and
 * stage — so the run is shared and only the candidate key varies, which is
 * what `automaticCandidates` actually keys on.
 */
let run: { id: string };
beforeAll(async () => {
  const [inserted] = await db.insert(briefingRun).values({
    localDate: "2026-09-07", stage: "publish", status: "running", startedAt: new Date(),
  }).returning();
  run = inserted!;
});

const automation = () => ({
  briefingRunId: run.id, machineAuthor: "briefing", candidateKeys: [crypto.randomUUID()],
});

describe("the auto-publish path refuses a record another run already published", () => {
  it("refuses a second record naming the same event", async () => {
    const eventId = await seedEvent("strike-on-the-vessel");

    const first = await service().autoPublish(
      story("Iran says it struck an American unmanned vessel", eventId) as never,
      automation(), actor,
    );
    expect(first.status).toBe("published");

    await expect(service().autoPublish(
      story("Iran claims a strike on a US unmanned vessel", eventId) as never,
      automation(), actor,
    )).rejects.toThrow(/Likely duplicate of .* the same event identifier/i);
  });

  it("refuses a second record claiming an existing canonical story", async () => {
    await service().autoPublish(
      { ...story("Aerogel research at Ben-Gurion University"), canonicalStoryId: "bgu-aerogel" } as never,
      automation(), actor,
    );

    await expect(service().autoPublish(
      { ...story("A second look at BGU aerogel research"), canonicalStoryId: "bgu-aerogel" } as never,
      automation(), actor,
    )).rejects.toThrow(/Canonical story already exists as/i);
  });

  it("allows two genuinely different stories that share no event and no story id", async () => {
    const one = await service().autoPublish(story("Rain closes the northern crossing") as never, automation(), actor);
    const two = await service().autoPublish(story("A new desalination plant opens in Ashkelon") as never, automation(), actor);
    expect(one.publicId).not.toBe(two.publicId);
    expect(two.status).toBe("published");
  });
});

describe("the deliberate override", () => {
  it("lets a human draft a separate story for an event that already has one", async () => {
    const eventId = await seedEvent("contested-outpost");

    await service().autoPublish(
      story("Unauthorised outposts recorded in the West Bank", eventId) as never,
      automation(), actor,
    );

    /* The machine has no door here. A person does: `create` writes a draft,
       which is not public, and only a human `transition` makes it so. */
    const human = { label: "admin@lionsofzion.io", userId: null };
    const draft = await service().create(
      story("A separate account of the same outpost dispute", eventId) as never,
      human,
    );

    expect(draft.status).toBe("draft");
    expect(draft.autoPublishedAt).toBeNull();
    expect(draft.eventId).toBe(eventId);
  });
});
