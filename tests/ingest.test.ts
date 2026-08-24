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
      <description>A short summary.</description>
    </item>
    <item>
      <title>Follow-up statement issued</title>
      <link>https://example.org/b</link>
      <guid>urn:example:b</guid>
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
  });

  it("does not duplicate evidence on a second fetch of the same feed", async () => {
    const db = await freshDatabase();
    const src = await seedRssSource(db);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(RSS2, { status: 200 })));

    await ingestSource(db, src.id, actor, { storeRaw: stubStoreRaw });
    const second = await ingestSource(db, src.id, actor, { storeRaw: stubStoreRaw });

    expect(second.fetch.itemsSeen).toBe(2);
    expect(second.fetch.itemsNew).toBe(0);
    expect(second.evidenceCreated).toBe(0);

    const rows = await db.select().from(evidence).where(eq(evidence.sourceId, src.id));
    expect(rows).toHaveLength(2);

    const fetches = await db.select().from(sourceFetch).where(eq(sourceFetch.sourceId, src.id));
    expect(fetches).toHaveLength(2);
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
});
