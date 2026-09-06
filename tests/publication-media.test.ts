import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { briefingRun, publication } from "@/server/db/schema";
import { freshDatabase } from "@/server/db/testing";
import { mediaRepo, type EditorialMediaDraft } from "@/server/modules/media/repo";
import { publicationService } from "@/server/modules/publications/service";
import { routePublication } from "@/lib/publication-routing";
import { isHomepageSafeMedia } from "@/server/contracts/editorial-media";

/**
 * The whole point of `editorial_media` is that one stored asset reaches every
 * public surface. That claim is about the *read path*, so this pins it there:
 * a hero attached once must come back on the list projection and on the detail
 * projection, identically, without a `media.json` mapping anywhere.
 *
 * The surface filters are asserted from the same fixture rather than in
 * isolation, because the bug they exist to prevent is a rights decision that
 * holds on one surface and quietly leaks on the other.
 */

const cleared = (over: Partial<EditorialMediaDraft> = {}): EditorialMediaDraft => ({
  src: "https://store123.public.blob.vercel-storage.com/publications/media/abc.webp",
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
  contentHash: "a".repeat(64),
  byteSize: 40_000, contentType: "image/webp", generated: false,
  provenance: { composer: "test", runId: "run-1" },
  ...over,
});

async function publishedWithHero(draft = cleared()) {
  const db = await freshDatabase();
  /* `enforce_publication_publish_gate` refuses an `auto_published_at` row
     without machine provenance, so the fixture carries a real run. */
  const [run] = await db.insert(briefingRun).values({
    localDate: "2026-09-06", stage: "publish", status: "completed",
    startedAt: new Date("2026-09-06T07:00:00.000Z"),
  }).returning();
  const [row] = await db.insert(publication).values({
    kind: "news_update", section: "israel_update", publicId: "media-round-trip",
    title: "An update carrying its own picture", body: "A source-linked update.",
    summary: "It has a hero.", language: "en",
    status: "published", publishedAt: new Date(), autoPublishedAt: new Date(),
    briefingRunId: run!.id, briefingCandidateKey: "article-1", machineAuthor: "machine:test",
  }).returning();
  const store = mediaRepo(db);
  const asset = await store.insertMedia(draft);
  await store.attachToPublication(row!.id, asset.id);
  return { db, row: row!, asset };
}

describe("publication hero media", () => {
  it("returns the same asset on the list projection and the detail projection", async () => {
    const { db } = await publishedWithHero();
    const service = publicationService(db);

    const [listed] = await service.listPublic({ limit: 10 });
    const detail = await service.getPublicDetail("media-round-trip");

    expect(listed!.media).not.toBeNull();
    expect(listed!.media!.src).toBe(cleared().src);
    expect(listed!.media!.alt).toBe(cleared().alt);
    expect(listed!.media!.focalPoint).toEqual({ x: 50, y: 40 });
    /* Same record, same picture — the failure this guards is a listing and a
       page disagreeing about what illustrates the same story. */
    expect(detail.media).toEqual(listed!.media);
  });

  it("is one asset and one attachment when the same bytes arrive twice", async () => {
    const { db, row } = await publishedWithHero();
    const store = mediaRepo(db);
    const again = await store.insertMedia(cleared());
    await store.attachToPublication(row.id, again.id);

    expect(again.id).toBe((await store.byContentHash("a".repeat(64)))!.id);
    const assets = await db.execute<{ count: string }>(
      sql`SELECT count(*)::text AS count FROM editorial_media`,
    );
    const links = await db.execute<{ count: string }>(
      sql`SELECT count(*)::text AS count FROM publication_media WHERE publication_id = ${row.id}`,
    );
    expect(Number(assets.rows[0]!.count)).toBe(1);
    expect(Number(links.rows[0]!.count)).toBe(1);
    await expect(store.heroMedia(row.id)).resolves.not.toBeNull();
  });

  it("withholds an asset the rights do not clear for the article surface", async () => {
    const { db } = await publishedWithHero(cleared({
      contentHash: "b".repeat(64),
      rights: {
        status: "cleared", basis: "Homepage-only permission", reference: "internal",
        clearedAt: "2026-09-06", surfaces: ["homepage"],
      },
    }));
    const [listed] = await publicationService(db).listPublic({ limit: 10 });
    /* Cleared, but not for this surface. The projection's bar is the article
       bar, so a homepage-only clearance renders nothing on the record page. */
    expect(listed!.media).toBeNull();
  });

  it("keeps an uncleared asset off every public surface", async () => {
    const { db } = await publishedWithHero(cleared({
      contentHash: "c".repeat(64),
      rights: { status: "unknown", basis: "No basis established", reference: "n/a", clearedAt: null, surfaces: [] },
    }));
    const [listed] = await publicationService(db).listPublic({ limit: 10 });
    expect(listed!.media).toBeNull();
  });

  /**
   * The deploy window, pinned.
   *
   * Code and migration `0057` cannot land in the same instant, and the media
   * read sits on every public read path — the homepage, the news hub, the
   * narrative desk, `/articles/*`, `/updates`, `/fact-check`, the sitemap and
   * the public API. Before this was guarded, deploying ahead of the migration
   * did not merely hide pictures: `42P01` propagated and took all of them
   * down. A hero image is enrichment, so its absence must cost the picture and
   * nothing else, in either deploy order.
   */
  it("serves publications from a database that has no media tables at all", async () => {
    const { db } = await publishedWithHero();
    await db.execute(sql`DROP TABLE publication_media`);
    await db.execute(sql`DROP TABLE editorial_media`);
    const service = publicationService(db);

    const listed = await service.listPublic({ limit: 10 });
    expect(listed).toHaveLength(1);
    expect(listed[0]!.media).toBeNull();
    await expect(service.getPublicDetail("media-round-trip")).resolves.toMatchObject({ media: null });
  });

  it("routes every section to one destination, and the homepage bar is stricter", () => {
    expect(routePublication("daily_brief").homepageSection).toBe("news");
    expect(routePublication("israel_update").homepageSection).toBe("news");
    expect(routePublication("narrative_watch").homepageSection).toBe("fakeResistance");
    expect(routePublication("narrative_watch").href).toBe("/fake-resistance");
    expect(routePublication("daily_brief").href).toBe("/geopolitical-brief");

    /* Sensitive-but-cleared passes the article bar and fails the homepage's. */
    const sensitive = { ...cleared(), sensitivity: "sensitive" as const };
    expect(isHomepageSafeMedia({
      id: "x", ...sensitive, sourceUrl: undefined, caption: undefined,
    } as never)).toBe(false);
  });
});
