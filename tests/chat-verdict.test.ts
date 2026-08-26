import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { chatRepo } from "@/server/modules/chat/repo";
import { chatService } from "@/server/modules/chat/service";
import type { Answerer, Retriever } from "@/server/modules/chat/service";
import type { RetrievedDocument } from "@/server/contracts/chat";

const who = { label: "analyst@example.org", userId: null };

async function seedPublicItem(db: TestDatabase) {
  const reviewer = await db.execute(sql`
    INSERT INTO app_user (external_id, display_name)
    VALUES (${`auth|${crypto.randomUUID()}`}, 'Fixture reviewer') RETURNING id
  `);
  const reviewerId = (reviewer.rows[0] as { id: string }).id;
  const item = await db.execute(sql`
    INSERT INTO information_item
      (public_id, type, title, canonical_text, language, status, assessment,
       confidence_summary, approved_by, published_at)
    VALUES
      (${`fixture-${crypto.randomUUID()}`}, 'claim', 'The public bridge article',
       'A bridge was reported closed.', 'en', 'published', 'false', 'high',
       ${reviewerId}, now())
    RETURNING id
  `);
  const itemId = (item.rows[0] as { id: string }).id;
  const document = await db.execute(sql`
    INSERT INTO search_document (entity_type, entity_id, title, body, language)
    VALUES ('information_item', ${itemId}, 'The public bridge article',
            'A bridge was reported closed.', 'en') RETURNING id
  `);
  return (document.rows[0] as { id: string }).id;
}

describe("public chat data boundary", () => {
  it("retrieves published page text without internal findings", async () => {
    const db = await freshDatabase();
    const documentId = await seedPublicItem(db);
    const [document] = await chatRepo(db).documentsFor([documentId]);

    expect(document).toMatchObject({
      documentId,
      title: "The public bridge article",
      verdict: null,
    });
    expect(document!.excerpt).toContain("bridge");
  });

  it("does not return evidence documents to public chat", async () => {
    const db = await freshDatabase();
    const document = await db.execute(sql`
      INSERT INTO search_document (entity_type, entity_id, title, body, language)
      VALUES ('evidence', gen_random_uuid(), 'Internal evidence', 'Not public prompt text', 'en')
      RETURNING id
    `);
    const id = (document.rows[0] as { id: string }).id;
    expect(await chatRepo(db).documentsFor([id])).toEqual([]);
  });

  it("hands only the published projection to the answerer", async () => {
    const db = await freshDatabase();
    const documentId = await seedPublicItem(db);
    const seen: RetrievedDocument[] = [];
    const answer: Answerer = async ({ documents }) => {
      seen.push(...documents);
      return {
        text: "An answer.",
        citations: [],
        model: "anthropic/claude-haiku-4.5",
        inputTokens: 100,
        outputTokens: 20,
        costUsd: 0.0002,
        latencyMs: 5,
      };
    };
    const retrieve: Retriever = async () => [{ documentId }];
    const service = chatService(db, { answer, retrieve });
    const thread = await service.createThread({}, who);
    await service.ask(thread.id, { content: "What about the bridge?" }, who);

    expect(seen).toHaveLength(1);
    expect(seen[0]!.verdict).toBeNull();
    expect(seen[0]!.excerpt).toContain("bridge");
  });
});
