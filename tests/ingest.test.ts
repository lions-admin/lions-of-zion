import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase } from "@/server/db/testing";
import { evidence, source, sourceFamily, sourceFetch } from "@/server/db/schema";
import { ingestSource } from "@/server/modules/sources/ingest";
import type { TestDatabase } from "@/server/db/testing";
import type { Actor } from "@/server/core/audit";

const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Border incident reported</title>
      <link>https://example.org/a</link>
      <guid>urn:example:a</guid>
      <description>A source-provided summary with enough context.</description>
      <pubDate>Mon, 24 Aug 2026 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Follow-up statement issued</title>
      <link>https://example.org/b</link>
      <guid>urn:example:b</guid>
      <description>A useful follow-up summary with enough source context.</description>
    </item>
  </channel>
</rss>`;

const actor: Actor = { label: "test:ingest", userId: null };
const stubStoreRaw = async (pathname: string) => ({ url: `https://blob.example/${pathname}`, contentType: "application/xml" });

async function seedRssSource(db: TestDatabase) {
  const [family] = await db
    .insert(sourceFamily)
    .values({ slug: "example-wire", label: "Example Wire" })
    .returning();
  const [src] = await db
    .insert(source)
    .values({
      sourceFamilyId: family!.id,
      kind: "rss",
      slug: "example-feed",
      name: "Example Feed",
      feedUrl: "https://example.org/feed.xml",
      language: "en",
    })
    .returning();
  return src!;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ingestSource", () => {
  it("creates one evidence row per new feed item and records the fetch", async () => {
    const db = await freshDatabase();
    const src = await seedRssSource(db);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(RSS2, { status: 200 })));

    const result = await ingestSource(db, src.id, actor, { storeRaw: stubStoreRaw });

    expect(result.fetch.status).toBe("success");
    expect(result.fetch.itemsSeen).toBe(2);
    expect(result.fetch.itemsNew).toBe(2);
    expect(result.evidenceCreated).toBe(2);
    expect(result.fetch.rawBlobUrl).toMatch(/^https:\/\/blob\.example\//);

    const rows = await db.select().from(evidence).where(eq(evidence.sourceId, src.id));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.externalId).sort()).toEqual(["urn:example:a", "urn:example:b"]);
    expect(rows.every((r) => r.sourceFetchId === result.fetch.id)).toBe(true);
    expect(rows[0]).toMatchObject({
      canonicalUrl: "https://example.org/a",
      url: "https://example.org/a",
      discoveryUrl: "https://example.org/a",
      publisherDomain: "example.org",
      title: "Border incident reported",
      excerpt: "A source-provided summary with enough context.",
      publishedAt: new Date("2026-08-24T10:00:00.000Z"),
    });
  });

  it("does not duplicate evidence on a second fetch of the same feed", async () => {
    const db = await freshDatabase();
    const src = await seedRssSource(db);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(RSS2, { status: 200 })));

    const storeRaw = vi.fn(stubStoreRaw);
    await ingestSource(db, src.id, actor, { storeRaw });
    const second = await ingestSource(db, src.id, actor, { storeRaw });

    expect(second.fetch.itemsSeen).toBe(2);
    expect(second.fetch.itemsNew).toBe(0);
    expect(second.evidenceCreated).toBe(0);

    const rows = await db.select().from(evidence).where(eq(evidence.sourceId, src.id));
    expect(rows).toHaveLength(2);

    const fetches = await db.select().from(sourceFetch).where(eq(sourceFetch.sourceId, src.id));
    expect(fetches).toHaveLength(2);
    expect(storeRaw).toHaveBeenCalledTimes(1);
    expect(fetches[0]!.rawBlobUrl).toBe(fetches[1]!.rawBlobUrl);
  });

  it("records a failed fetch with no evidence when the feed is unreachable", async () => {
    const db = await freshDatabase();
    const src = await seedRssSource(db);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network unreachable");
      }),
    );

    const result = await ingestSource(db, src.id, actor, { storeRaw: stubStoreRaw });

    expect(result.fetch.status).toBe("failed");
    expect(result.fetch.errorMessage).toMatch(/network unreachable/);
    expect(result.evidenceCreated).toBe(0);
  });

  it("drops a result without a usable source excerpt instead of storing a thin evidence row", async () => {
    const db = await freshDatabase();
    const src = await seedRssSource(db);
    const empty = RSS2.replace("A source-provided summary with enough context.", "").replace("A useful follow-up summary with enough source context.", "");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(empty, { status: 200 })));

    const result = await ingestSource(db, src.id, actor, { storeRaw: stubStoreRaw });

    expect(result.fetch).toMatchObject({ status: "partial", itemsSeen: 0, itemsNew: 0 });
    expect(result.fetch.errorMessage).toBe("Source returned no usable direct publisher records.");
    expect(await db.select().from(evidence).where(eq(evidence.sourceId, src.id))).toHaveLength(0);
  });
});
