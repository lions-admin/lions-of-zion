import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import type { Database } from "@/server/db/client";
import type { EditorialMediaDraft } from "@/server/modules/media/repo";
import { publicationService } from "@/server/modules/publications/service";

/**
 * VA-49.2 — what `mediaDisposition` actually says, as opposed to what its name
 * suggests.
 *
 * `tests/publication-media-disposition.test.ts` pins the behaviour the field
 * was built for: a run that offers no media records `text_led`, one whose media
 * failed records `media_unavailable`, and an update that brought no media does
 * not relabel what it did not re-examine. All of that is correct and none of it
 * is repeated here.
 *
 * This file pins the *gap* that follows from it, so it is visible in the suite
 * and not only in the comment on `publicPublicationSchema.mediaDisposition`.
 * The value is derived at publish time from that one operation, so it describes
 * the operation rather than the record: a picture-less row that already existed
 * has no path to being declared deliberately text-led, and — the trap a
 * consumer will actually fall into — a row that *does* carry a hero can read
 * `null` forever. Production on 2026-09-08 had 18 live records with a hero and
 * four reading `illustrated`.
 */

let db: TestDatabase;
beforeAll(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });

const actor = { label: "service:editorial-run", userId: null };
const service = () => publicationService(db as unknown as Database);

const cleared = (): EditorialMediaDraft => ({
  src: "https://store123.public.blob.vercel-storage.com/publications/media/hero.webp",
  width: 1200, height: 800,
  alt: "Archive context: a street in Tel Aviv.",
  caption: "Tel Aviv, 2021.",
  credit: "Photographer · resized WebP",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
  originUrl: "https://commons.wikimedia.org/example.jpg",
  disclosure: "Context image — not incident documentation",
  role: "archival-context",
  focalPoint: { x: 50, y: 40 },
  sensitivity: "safe",
  rights: {
    status: "cleared", basis: "CC BY-SA 4.0",
    reference: "https://creativecommons.org/licenses/by-sa/4.0/",
    clearedAt: "2026-09-06", surfaces: ["homepage", "article"],
  },
  contentHash: "c".repeat(64),
  byteSize: 40_000, contentType: "image/webp", generated: false,
  provenance: { composer: "test", runId: "run-disposition" },
});

async function seedRun(): Promise<string> {
  const id = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO editorial_run (id, run_key, request_hash, mode, local_date, requested_by, request, status, stage)
    VALUES (${id}, ${`semantics-${id}`}, ${"c".repeat(64)}, 'operations', '2026-09-08',
            'service:editorial-run', ${JSON.stringify({ runId: id, mode: "operations", operations: [] })}::jsonb,
            'running', 'publication')
  `);
  return id;
}

async function create(key: string, media: EditorialMediaDraft | null) {
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
    media,
    actor,
    undefined,
    media ? "offered" : "none",
  );
}

async function updateWithoutMedia(id: string, key: string) {
  return service().applyEditorial(
    {
      key, action: "update", publicationId: id,
      publication: { body: "A corrected account.", changeSummary: "Corrected the body." },
    } as never,
    { runId: await seedRun(), machineAuthor: "whole-site-editorial" },
    null,
    actor,
    undefined,
    "none",
  );
}

describe("the disposition describes the operation, not the record", () => {
  it("records `illustrated` when the operation carried a picture", async () => {
    const row = await create("op-with-media", cleared());
    expect(row.mediaDisposition).toBe("illustrated");
  });

  it("leaves a picture-less record's disposition alone across an ordinary update", async () => {
    const created = await create("op-null-stays-null", null);
    expect(created.mediaDisposition).toBe("text_led");

    /* Stand in for the 58 live rows published before migration `0064`: the
       column is null and no run has re-examined them since. */
    await db.execute(sql`UPDATE publication SET media_disposition = NULL WHERE id = ${created.id}`);

    const updated = await updateWithoutMedia(created.id, "op-null-stays-null-2");

    /* The distinction the field exists to draw is exactly the one it cannot
       make for a record that already existed: an update carrying no media is
       indistinguishable from a deliberate choice of no picture, so the value
       stays unrecorded rather than being asserted. */
    expect(updated.mediaDisposition).toBeNull();
  });

  it("does not answer `illustrated` for a record that visibly has a hero", async () => {
    const row = await create("op-legacy-hero", cleared());

    /* A record that had its picture attached before `0064` — the hero is
       really there, the disposition never was. Fourteen live rows look like
       this, against four reading `illustrated`. */
    await db.execute(sql`UPDATE publication SET media_disposition = NULL WHERE id = ${row.id}`);
    await updateWithoutMedia(row.id, "op-legacy-hero-2");

    const projected = await service().getPublic(row.publicId);
    expect(projected.media).not.toBeNull();
    /* So `mediaDisposition === "illustrated"` is not a picture check, and a
       consumer that writes one hides most of the images on the site. Ask
       `media`. */
    expect(projected.mediaDisposition).not.toBe("illustrated");
    expect(projected.mediaDisposition).toBeNull();
  });
});
