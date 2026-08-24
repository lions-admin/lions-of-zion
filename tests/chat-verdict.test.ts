import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { chatService } from "@/server/modules/chat/service";
import { chatRepo } from "@/server/modules/chat/repo";
import { searchService } from "@/server/modules/search/service";
import { itemService } from "@/server/modules/items/service";
import { appUser, itemAssessment } from "@/server/db/schema";
import type { Answerer, Retriever } from "@/server/modules/chat/service";
import type { RetrievedDocument } from "@/server/contracts/chat";

/**
 * Chat is the most persuasive surface in the system and used to see the least.
 * `search_document` indexes title, body and language only — deliberately, so a
 * query for "verified" does not match every verified item. The cost was that a
 * model answering from claim text had no idea what had been concluded about
 * it, and would summarise a debunked claim as though it stood.
 *
 * These check that the verdict now travels beside the text — and, just as
 * importantly, that it did not leak into the index while doing so.
 */

const who = { label: "analyst@example.org", userId: null };

const assessmentFields = {
  summary: "Checked against three independent sources.",
  knownGaps: "The original upload timestamp could not be recovered.",
  confidenceEvidenceCoverage: "high" as const,
  confidenceSourceIndependence: "high" as const,
  confidenceSourceAuthority: "high" as const,
  confidenceMediaProvenance: "medium" as const,
  confidenceTemporalConsistency: "high" as const,
  confidenceGeographicConsistency: "high" as const,
  confidenceContradictionLevel: "limited" as const,
  confidenceTranslationCertainty: "high" as const,
  confidenceHumanReviewState: "high" as const,
  confidenceRemainingGaps: "medium" as const,
  confidenceSummary: "high" as const,
  eligibility: {},
};

/** An item, indexed for search, optionally with a verdict on it. */
async function seedItem(
  db: TestDatabase,
  opts: { title: string; text: string; assessment?: "false" | "verified"; publish?: boolean },
) {
  const item = await itemService(db).create(
    { type: "claim", title: opts.title, canonicalText: opts.text, language: "en" },
    who,
  );
  await searchService(db).reindex("information_item", item.id);

  if (opts.assessment) {
    await db
      .insert(itemAssessment)
      .values({ itemId: item.id, value: opts.assessment, ...assessmentFields });
  }

  if (opts.publish) {
    const [author] = await db
      .insert(appUser)
      .values({ externalId: `auth|a-${item.id}`, displayName: `Author ${item.id}` })
      .returning();
    const [reviewer] = await db
      .insert(appUser)
      .values({ externalId: `auth|r-${item.id}`, displayName: `Reviewer ${item.id}` })
      .returning();
    await db.execute(sql`UPDATE information_item SET created_by = ${author!.id} WHERE id = ${item.id}`);
    await db.execute(sql`UPDATE item_assessment SET approved_by = ${reviewer!.id} WHERE item_id = ${item.id}`);
    for (const s of ["under_review", "reviewed"]) {
      await db.execute(sql`UPDATE information_item SET status = ${s}::item_status WHERE id = ${item.id}`);
    }
    await db.execute(
      sql`UPDATE information_item SET status = 'approved', approved_by = ${reviewer!.id} WHERE id = ${item.id}`,
    );
    await db.execute(
      sql`UPDATE information_item SET status = 'published', published_at = now() WHERE id = ${item.id}`,
    );
  }

  const [doc] = (
    await db.execute(sql`SELECT id FROM search_document WHERE entity_id = ${item.id}`)
  ).rows as { id: string }[];
  return { itemId: item.id, documentId: doc!.id };
}

describe("the verdict reaches the model", () => {
  it("carries a published finding, its confidence and its gaps", async () => {
    const db = await freshDatabase();
    const { documentId } = await seedItem(db, {
      title: "The hospital was struck",
      text: "A claim about a strike on a hospital.",
      assessment: "false",
      publish: true,
    });

    const [doc] = await chatRepo(db).documentsFor([documentId]);
    expect(doc!.verdict).toMatchObject({
      assessment: "false",
      confidence: "high",
      isPublished: true,
    });
    expect(doc!.verdict!.knownGaps).toMatch(/upload timestamp/);
  });

  it("marks an unpublished finding as not settled", async () => {
    const db = await freshDatabase();
    const { documentId } = await seedItem(db, {
      title: "An unreviewed claim",
      text: "Still being checked.",
      assessment: "verified",
    });

    const [doc] = await chatRepo(db).documentsFor([documentId]);
    expect(doc!.verdict!.assessment).toBe("verified");
    expect(doc!.verdict!.isPublished, "still internal — must not be voiced as settled").toBe(false);
  });

  it("reports an unassessed claim as having no verdict rather than as fine", async () => {
    const db = await freshDatabase();
    const { documentId } = await seedItem(db, {
      title: "Nobody has checked this",
      text: "An unexamined claim.",
    });

    const [doc] = await chatRepo(db).documentsFor([documentId]);
    expect(doc!.verdict).not.toBeNull();
    expect(doc!.verdict!.assessment, "no verdict is not the same as a clean one").toBeNull();
  });

  it("gives evidence no verdict of its own", async () => {
    const db = await freshDatabase();
    const fam = (
      await db.execute(sql`INSERT INTO source_family (slug,label) VALUES ('w','W') RETURNING id`)
    ).rows[0] as { id: string };
    const src = (
      await db.execute(sql`
        INSERT INTO source (source_family_id,kind,slug,name,language)
        VALUES (${fam.id},'manual','m','M','en') RETURNING id`)
    ).rows[0] as { id: string };
    const ev = (
      await db.execute(sql`
        INSERT INTO evidence (source_id,kind,title,excerpt,language)
        VALUES (${src.id},'article','A wire report','Some reporting.','en') RETURNING id`)
    ).rows[0] as { id: string };
    await searchService(db).reindex("evidence", ev.id);

    const [doc] = (
      await db.execute(sql`SELECT id FROM search_document WHERE entity_id = ${ev.id}`)
    ).rows as { id: string }[];
    const [retrieved] = await chatRepo(db).documentsFor([doc!.id]);
    expect(retrieved!.verdict, "evidence is material, not a finding").toBeNull();
  });
});

describe("the verdict does not pollute the index", () => {
  it("keeps verdict vocabulary out of the searchable text", async () => {
    /* The whole reason the verdict is joined on after retrieval instead of
       being indexed: a search for "false" must not match every claim we
       found false. */
    const db = await freshDatabase();
    await seedItem(db, {
      title: "A claim about a bridge",
      text: "Someone asserted a bridge collapsed.",
      assessment: "false",
      publish: true,
    });

    const rows = (
      await db.execute(sql`SELECT title, body FROM search_document`)
    ).rows as { title: string; body: string }[];
    for (const r of rows) {
      expect(`${r.title} ${r.body}`).not.toMatch(/\bfalse\b|\bverified\b|OUR FINDING/i);
    }

    const { hits } = await searchService(db).search({ q: "false", limit: 10 });
    expect(hits, "searching the verdict word must not match the claim").toEqual([]);
  });

  it("reads the verdict live, so a stale projection cannot show a stale finding", async () => {
    /* `search_document` is refreshed by a queue drain and can lag by minutes.
       `information_item.assessment` is trigger-maintained and correct at once.
       Reading it at retrieval time is what keeps the two from disagreeing. */
    const db = await freshDatabase();
    const { itemId, documentId } = await seedItem(db, {
      title: "A developing claim",
      text: "Something asserted.",
    });

    let [doc] = await chatRepo(db).documentsFor([documentId]);
    expect(doc!.verdict!.assessment).toBeNull();

    /* An assessment lands. The projection is NOT reindexed.
       `misleading` must state the false impression it creates — a Phase 4
       CHECK, and it applies to fixtures too. */
    await db.insert(itemAssessment).values({
      itemId,
      value: "misleading",
      falseImpression: "Implies the collapse was deliberate when the cause is unestablished.",
      ...assessmentFields,
    });

    [doc] = await chatRepo(db).documentsFor([documentId]);
    expect(doc!.verdict!.assessment, "the finding must be current, not as-indexed").toBe(
      "misleading",
    );
  });
});

describe("the answerer states the finding", () => {
  const capture = () => {
    const seen: RetrievedDocument[] = [];
    const answer: Answerer = async ({ documents }) => {
      seen.push(...documents);
      return {
        text: "An answer.",
        citations: [],
        model: "anthropic/claude-sonnet-4.6",
        inputTokens: 100,
        outputTokens: 20,
        latencyMs: 5,
      };
    };
    return { seen, answer };
  };

  it("hands the model the verdict alongside the claim", async () => {
    const db = await freshDatabase();
    const { documentId } = await seedItem(db, {
      title: "The bridge claim",
      text: "A bridge was said to have collapsed.",
      assessment: "false",
      publish: true,
    });

    const { seen, answer } = capture();
    const retrieve: Retriever = async () => [{ documentId }];
    const svc = chatService(db, { answer, retrieve });
    const thread = await svc.createThread({}, who);
    await svc.ask(thread.id, { content: "What about the bridge?" }, who);

    expect(seen).toHaveLength(1);
    expect(seen[0]!.verdict!.assessment).toBe("false");
    expect(seen[0]!.excerpt, "the claim text itself stays untouched").toContain("bridge");
  });
});
