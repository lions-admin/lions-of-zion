/**
 * The P3 console wave: Agent Search actual cost, prompt registry
 * management, generic entity-version reads, and the evidence provenance
 * trail — plus the contract rule that stops new GDELT sources.
 *
 * Each read is checked for the rows it returns and the parse against the
 * contract; each write for the state it leaves, the audit row written in the
 * same transaction, and the refusal when the precondition is not met.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import {
  auditLog,
  evidenceProvenance as provenanceTable,
  promptRegistry,
  source,
  sourceFamily,
  sourceFetch,
} from "@/server/db/schema";
import { createSourceSchema } from "@/server/contracts/source";

vi.mock("@/server/core/auth/neon", () => ({
  neonAuth: () => ({ getSession: async () => ({ data: null }) }),
}));

/* The ingest tests run against a stubbed connector so no test reaches for the
 * network; the stub is where the fetch result's actual cost comes from. */
const stubs = vi.hoisted(() => ({
  result: {
    status: "success",
    httpStatus: 200,
    items: [],
    query: "israel",
    actualCostUsd: 0.0015,
  } as {
    status: "success" | "partial" | "failed";
    httpStatus?: number;
    items: unknown[];
    query?: string;
    actualCostUsd?: number;
  },
}));

vi.mock("@/server/modules/sources/connectors", () => ({
  connectorFor: () => ({
    kind: "agent_search",
    fetch: async () => stubs.result,
  }),
}));

const { adminConsoleService } = await import("@/server/modules/admin-console/service");
const { publicationService } = await import("@/server/modules/publications/service");
const { evidenceService } = await import("@/server/modules/evidence/service");
const { ingestSource } = await import("@/server/modules/sources/ingest");

const actor = { label: "admin:test", userId: null };

afterEach(() => {
  stubs.result = { status: "success", httpStatus: 200, items: [], query: "israel", actualCostUsd: 0.0015 };
  delete process.env.GOOGLE_SEARCH_ESTIMATED_COST_PER_QUERY_USD;
});

async function seedSource(db: TestDatabase, kind: "agent_search" | "rss") {
  const [family] = await db.insert(sourceFamily).values({ slug: `p3-${kind}`, label: "P3 Feed" }).returning();
  const [src] = await db.insert(source).values({
    sourceFamilyId: family!.id,
    kind,
    slug: `p3-${kind}`,
    name: "P3 Feed",
    feedUrl: kind === "rss" ? "https://example.org/p3.xml" : null,
    config: kind === "agent_search" ? { query: "israel" } : null,
    language: "en",
    active: false,
  }).returning();
  return src!;
}

const auditActions = async (db: TestDatabase) => (await db.select().from(auditLog)).map((row) => row.action);

describe("agent search actual cost", () => {
  it("records the connector's per-query cost on the fetch row and sums it beside the estimate", async () => {
    const db = await freshDatabase();
    const src = await seedSource(db, "agent_search");
    const result = await ingestSource(db, src.id, actor, {
      storeRaw: async (pathname: string) => ({ url: `https://blob.example/${pathname}`, contentType: "application/json" }),
    });
    expect(result.fetch.actualCostUsd).toBeCloseTo(0.0015, 9);

    /* A fetch with no reported cost stays null — RSS and unconfigured rates
     * must not read as zero spend. A recent successful query is what the
     * month-to-date estimate multiplies. */
    const rss = await seedSource(db, "rss");
    await db.insert(sourceFetch).values({
      sourceId: rss.id,
      status: "success",
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await db.insert(sourceFetch).values({
      sourceId: src.id,
      status: "success",
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    /* The 30-day rollup sums only the fetches that reported a cost. */
    await db.insert(sourceFetch).values({
      sourceId: src.id,
      status: "partial",
      startedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1_000),
      finishedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1_000),
      errorMessage: "Agent Search returned no direct publisher results",
      actualCostUsd: "9.99",
    });

    process.env.GOOGLE_SEARCH_ESTIMATED_COST_PER_QUERY_USD = "0.002";
    const costs = await adminConsoleService(db, { dispatch: null }).costs();
    expect(costs.search.actualSpendUsd).toBeCloseTo(0.0015, 9);
    expect(costs.search.estimatedSpendUsd).toBeCloseTo(0.002, 9);
  });

  it("distinguishes unrecorded spend from recorded zero", async () => {
    const db = await freshDatabase();
    const costs = await adminConsoleService(db, { dispatch: null }).costs();
    expect(costs.search.actualSpendUsd).toBeUndefined();
    expect(costs.search.actualSpendStatus).toBe("unrecorded");
    expect(costs.search.estimatedSpendUsd).toBeNull();
  });
});

describe("prompt registry", () => {
  it("lists slugs with versions and active flags", async () => {
    const db = await freshDatabase();
    const console = adminConsoleService(db, { dispatch: null });
    const first = await console.insertPromptVersion({ slug: "extract.claim", kind: "extract", modelProfile: "fast", template: "v1 text" }, actor);
    await console.insertPromptVersion({ slug: "extract.claim", kind: "extract", modelProfile: "fast", template: "v2 text" }, actor);
    await console.insertPromptVersion({ slug: "suggest.summary", kind: "summarize", template: "summarise", modelProfile: "fast" }, actor);
    expect(first).toMatchObject({ slug: "extract.claim", version: 1, activatedAt: null });

    const read = await console.prompts();
    const extract = read.prompts.find((prompt) => prompt.slug === "extract.claim")!;
    expect(extract.activeVersion).toBeNull();
    expect(extract.kind).toBe("extract");
    expect(extract.versions.map((version) => [version.version, version.template])).toEqual([[2, "v2 text"], [1, "v1 text"]]);
    expect(read.prompts.find((prompt) => prompt.slug === "suggest.summary")!.versions[0]!.modelProfile).toBe("fast");
  });

  it("activates through activate_prompt(), flips the active flag, and audits", async () => {
    const db = await freshDatabase();
    const console = adminConsoleService(db, { dispatch: null });
    await console.insertPromptVersion({ slug: "extract.claim", kind: "extract", modelProfile: "fast", template: "v1 text" }, actor);
    const second = await console.insertPromptVersion({ slug: "extract.claim", kind: "extract", modelProfile: "fast", template: "v2 text" }, actor, "req-act");

    const activated = await console.activatePromptVersion({ slug: "extract.claim", version: 2 }, actor, "req-act");
    expect(activated).toMatchObject({ slug: "extract.claim", version: 2 });
    expect(activated.activatedAt).toBeTruthy();
    const [stored] = await db.select().from(promptRegistry).where(eq(promptRegistry.id, second.id));
    expect(stored!.activatedAt).not.toBeNull();

    const read = await console.prompts();
    expect(read.prompts.find((prompt) => prompt.slug === "extract.claim")!.activeVersion).toBe(2);

    const actions = await auditActions(db);
    expect(actions).toContain("ops.prompt.inserted");
    expect(actions).toContain("ops.prompt.activated");
    const [activation] = (await db.select().from(auditLog))
      .filter((row) => row.action === "ops.prompt.activated");
    expect(activation).toMatchObject({ actorLabel: "admin:test", requestId: "req-act", entityType: "system" });
    expect(activation!.afterState).toMatchObject({ slug: "extract.claim", version: 2 });

    await expect(console.activatePromptVersion({ slug: "extract.claim", version: 2 }, actor)).rejects.toThrow(/already at version 2/);
    await expect(console.activatePromptVersion({ slug: "extract.claim", version: 99 }, actor)).rejects.toThrow(/not found/);
  });

  it("refuses an unknown version before touching the table", async () => {
    const db = await freshDatabase();
    const console = adminConsoleService(db, { dispatch: null });
    await expect(console.activatePromptVersion({ slug: "no.such.prompt", version: 1 }, actor)).rejects.toThrow(/not found/);
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });
});

describe("entity versions", () => {
  it("reads any versioned entity's history newest-first, with a limit", async () => {
    const db = await freshDatabase();
    const publications = publicationService(db);
    const created = await publications.create(
      { kind: "news_update", section: "israel_update", title: "Original", body: "Original body", language: "en" },
      actor,
    );
    await publications.update(created.id, { title: "Edited", body: "Edited body", changeSummary: "Edited" }, actor);
    const console = adminConsoleService(db, { dispatch: null });

    const all = await console.entityVersions({ entityType: "news_update", entityId: created.id, limit: 20 });
    expect(all.versions.map((version) => version.versionNumber)).toEqual([2, 1]);
    expect(all.versions[0]!.changeSummary).toBe("Edited");
    expect(all.versions[0]!.snapshot).toMatchObject({ title: "Edited" });
    expect(all.versions[1]!.changeSource).toBe("human_edit");

    const limited = await console.entityVersions({ entityType: "news_update", entityId: created.id, limit: 1 });
    expect(limited.versions.map((version) => version.versionNumber)).toEqual([2]);
  });

  it("refuses an entity with no history", async () => {
    const db = await freshDatabase();
    const console = adminConsoleService(db, { dispatch: null });
    await expect(
      console.entityVersions({ entityType: "source", entityId: "00000000-0000-0000-0000-000000000000", limit: 20 }),
    ).rejects.toThrow(/not found/);
  });
});

describe("evidence provenance", () => {
  it("reads the trail newest-first and truncates a long detail", async () => {
    const db = await freshDatabase();
    const src = await seedSource(db, "rss");
    const evidence = evidenceService(db);
    const created = await evidence.create({
      sourceId: src.id,
      kind: "article",
      dataClass: "public",
      title: "A discovered article",
      url: "https://example.org/article",
      language: "en",
    }, actor);
    await evidence.enrich(created.id, {
      excerpt: "A fuller excerpt of the article body.",
      usableTextLength: 40,
      retrievalStatus: "fetched",
      accessState: "open",
    }, actor);

    const read = await adminConsoleService(db, { dispatch: null }).evidenceProvenance(created.id);
    expect(read.evidenceId).toBe(created.id);
    expect(read.entries.map((entry) => entry.action)).toEqual(["retrieved", "captured"]);
    expect(read.entries[0]).toMatchObject({ actorLabel: "admin:test" });
    expect(JSON.parse(read.entries[0]!.detail!)).toMatchObject({ retrievalStatus: "fetched" });

    const long = "x".repeat(600);
    await db.insert(provenanceTable).values({
      evidenceId: created.id,
      action: "retrieved",
      actorLabel: "service",
      detail: { note: long },
    });
    const after = await adminConsoleService(db, { dispatch: null }).evidenceProvenance(created.id);
    expect(after.entries[0]!.detail).toBeTruthy();
    expect(after.entries[0]!.detail!.length).toBeLessThanOrEqual(500);
    expect(after.entries[0]!.detail!.endsWith("…")).toBe(true);

    await expect(adminConsoleService(db, { dispatch: null }).evidenceProvenance("00000000-0000-0000-0000-000000000000"))
      .rejects.toThrow(/not found/);
  });
});

describe("source creation and the GDELT block", () => {
  it("rejects gdelt at create and still accepts rss and agent_search", async () => {
    const base = {
      sourceFamilyId: "00000000-0000-0000-0000-000000000000",
      slug: "blocked-wire",
      name: "Blocked Wire",
      language: "en",
    };
    expect(createSourceSchema.safeParse({ ...base, kind: "gdelt", config: { query: "israel" } }).success).toBe(false);
    expect(createSourceSchema.safeParse({ ...base, kind: "rss", feedUrl: "https://example.org/feed.xml" }).success).toBe(true);
    expect(createSourceSchema.safeParse({ ...base, kind: "agent_search", config: { query: "israel" } }).success).toBe(true);

    /* Updates omit `kind`, so a legacy gdelt row keeps working everywhere
     * else — the block is at creation only. */
    const { updateSourceSchema } = await import("@/server/contracts/source");
    expect(updateSourceSchema.safeParse({ name: "Renamed", changeSummary: "rename" }).success).toBe(true);
  });
});
