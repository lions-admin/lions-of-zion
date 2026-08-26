import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { freshDatabase, violation, type TestDatabase } from "@/server/db/testing";
import { chatService } from "@/server/modules/chat/service";
import { splitCitations } from "@/server/modules/chat/answerer";
import { chatCitation, chatMessage, chatToolRun, aiRun } from "@/server/db/schema";
import type { Answerer, Retriever } from "@/server/modules/chat/service";

/**
 * The guarantee this phase exists for: a citation must name a document that
 * retrieval actually returned in this thread. Everything here is a way of
 * trying to get a fabricated citation past that.
 */

const actor = { label: "analyst@example.org", userId: null };

async function seedDocs(db: TestDatabase, titles: string[]): Promise<string[]> {
  const ids: string[] = [];
  const reviewer = await db.execute(sql`
    INSERT INTO app_user (external_id, display_name)
    VALUES (${`auth|${crypto.randomUUID()}`}, 'Public fixture reviewer')
    RETURNING id
  `);
  const reviewerId = (reviewer.rows[0] as { id: string }).id;
  for (const title of titles) {
    const item = await db.execute(sql`
      INSERT INTO information_item
        (public_id, type, title, canonical_text, language, status, assessment, approved_by, published_at)
      VALUES
        (${`fixture-${crypto.randomUUID()}`}, 'claim', ${title}, ${`Body of ${title}`}, 'en',
         'published', 'verified', ${reviewerId}, now())
      RETURNING id
    `);
    const itemId = (item.rows[0] as { id: string }).id;
    const r = await db.execute(sql`
      INSERT INTO search_document (entity_type, entity_id, title, body, language)
      VALUES ('information_item', ${itemId}, ${title}, ${`Body of ${title}`}, 'en')
      RETURNING id
    `);
    ids.push((r.rows[0] as { id: string }).id);
  }
  return ids;
}

const stubAnswer =
  (text: string, citations: string[] = []): Answerer =>
  async () => ({
    text,
    citations: citations.map((documentId) => ({ documentId })),
    model: "anthropic/claude-sonnet-4.6",
    inputTokens: 500,
    outputTokens: 80,
    costUsd: 0.0009,
    latencyMs: 30,
  });

const stubRetrieve =
  (ids: string[]): Retriever =>
  async () =>
    ids.map((documentId) => ({ documentId }));

describe("threads and transcripts", () => {
  it("records a turn in sequence, with the answer attributed to a run", async () => {
    const db = await freshDatabase();
    const ids = await seedDocs(db, ["Border incident"]);
    const svc = chatService(db, {
      answer: stubAnswer("The reporting says the incident occurred at dawn.", ids),
      retrieve: stubRetrieve(ids),
    });

    const thread = await svc.createThread({ title: "Border" }, actor);
    await svc.ask(thread.id, { content: "What happened at the border?" }, actor);

    const transcript = await svc.transcript(thread.id);
    expect(transcript.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(transcript.map((m) => m.seq)).toEqual([1, 2]);
    expect(transcript[1]!.citations).toHaveLength(1);

    const runs = await db.select().from(aiRun);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.kind).toBe("chat");
  });

  it("allocates sequence numbers in the database, not the caller", async () => {
    const db = await freshDatabase();
    const ids = await seedDocs(db, ["A"]);
    const svc = chatService(db, { answer: stubAnswer("Answer.", ids), retrieve: stubRetrieve(ids) });
    const thread = await svc.createThread({}, actor);

    await svc.ask(thread.id, { content: "First question" }, actor);
    await svc.ask(thread.id, { content: "Second question" }, actor);

    const rows = await db.select().from(chatMessage).where(eq(chatMessage.threadId, thread.id));
    expect(rows.map((r) => r.seq).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it("reports a missing thread as not found", async () => {
    const db = await freshDatabase();
    await expect(chatService(db).transcript(crypto.randomUUID())).rejects.toThrow(/was not found/);
  });

  it("refuses to answer when no gateway is configured", async () => {
    const db = await freshDatabase();
    const svc = chatService(db);
    const thread = await svc.createThread({}, actor);
    await expect(svc.ask(thread.id, { content: "Anything?" }, actor)).rejects.toThrow(
      /No AI gateway is configured/,
    );
  });
});

describe("the citation guarantee", () => {
  it("refuses a citation for a document that was never retrieved", async () => {
    const db = await freshDatabase();
    const [retrieved, neverRetrieved] = await seedDocs(db, ["Retrieved", "Never retrieved"]);
    const svc = chatService(db, {
      answer: stubAnswer("An answer.", [retrieved!]),
      retrieve: stubRetrieve([retrieved!]),
    });
    const thread = await svc.createThread({}, actor);
    const message = await svc.ask(thread.id, { content: "Question?" }, actor);

    /* The document is real, and the FK is satisfied. What the trigger refuses
       is that it was never handed to the model in this thread. */
    const v = await violation(
      db.insert(chatCitation).values({ messageId: message.id, documentId: neverRetrieved! }),
    );
    expect(v.message).toMatch(/was never returned by a retrieval in thread/);
  });

  it("strips a fabricated citation instead of losing the whole answer", async () => {
    const db = await freshDatabase();
    const [retrieved, fabricated] = await seedDocs(db, ["Retrieved", "Fabricated"]);
    const svc = chatService(db, {
      /* A model citing one real retrieved document and one it invented. */
      answer: stubAnswer("An answer citing both.", [retrieved!, fabricated!]),
      retrieve: stubRetrieve([retrieved!]),
    });

    const thread = await svc.createThread({}, actor);
    const message = await svc.ask(thread.id, { content: "Question?" }, actor);

    expect(message.citations.map((c) => c.documentId)).toEqual([retrieved]);
    /* The answer itself survives — the reader gets it, minus the invention. */
    expect(message.content).toBe("An answer citing both.");
  });

  it("refuses citations on a user message", async () => {
    const db = await freshDatabase();
    const ids = await seedDocs(db, ["Doc"]);
    const svc = chatService(db, { answer: stubAnswer("Answer.", ids), retrieve: stubRetrieve(ids) });
    const thread = await svc.createThread({}, actor);
    await svc.ask(thread.id, { content: "Question?" }, actor);

    const [userMessage] = await db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.role, "user"));

    const v = await violation(
      db.insert(chatCitation).values({ messageId: userMessage!.id, documentId: ids[0]! }),
    );
    expect(v.message).toMatch(/only an assistant message may carry citations/);
  });

  it("does not count a failed retrieval as having retrieved anything", async () => {
    const db = await freshDatabase();
    const ids = await seedDocs(db, ["Doc"]);
    const svc = chatService(db, {
      answer: stubAnswer("An answer.", []),
      retrieve: async () => {
        throw new Error("search is down");
      },
    });
    const thread = await svc.createThread({}, actor);
    const message = await svc.ask(thread.id, { content: "Question?" }, actor);

    const [toolRun] = await db.select().from(chatToolRun);
    expect(toolRun!.status).toBe("error");

    /* The error run must not become a licence to cite. */
    const v = await violation(
      db.insert(chatCitation).values({ messageId: message.id, documentId: ids[0]! }),
    );
    expect(v.message).toMatch(/was never returned by a retrieval/);
  });

  it("exposes exactly the set the trigger enforces", async () => {
    const db = await freshDatabase();
    const ids = await seedDocs(db, ["A", "B", "C"]);
    const retrieved = [ids[0]!, ids[1]!];
    const svc = chatService(db, {
      answer: stubAnswer("An answer.", retrieved),
      retrieve: stubRetrieve(retrieved),
    });
    const thread = await svc.createThread({}, actor);
    await svc.ask(thread.id, { content: "Question?" }, actor);

    const allowed = await svc.retrievableDocumentIds(thread.id);
    expect(allowed.sort()).toEqual([...retrieved].sort());
  });
});

describe("the tool-run log", () => {
  it("records what retrieval returned, before the answer is filed", async () => {
    const db = await freshDatabase();
    const ids = await seedDocs(db, ["A", "B"]);
    const svc = chatService(db, { answer: stubAnswer("Answer.", ids), retrieve: stubRetrieve(ids) });
    const thread = await svc.createThread({}, actor);
    const message = await svc.ask(thread.id, { content: "Question?" }, actor);

    const [toolRun] = await db.select().from(chatToolRun);
    expect(toolRun!.tool).toBe("search");
    expect(toolRun!.resultDocumentIds.sort()).toEqual([...ids].sort());
    /* Linked to the answer it produced, once that answer existed. */
    expect(toolRun!.messageId).toBe(message.id);
  });

  it("is append-only apart from that one linking write", async () => {
    const db = await freshDatabase();
    const ids = await seedDocs(db, ["A"]);
    const svc = chatService(db, { answer: stubAnswer("Answer.", ids), retrieve: stubRetrieve(ids) });
    const thread = await svc.createThread({}, actor);
    await svc.ask(thread.id, { content: "Question?" }, actor);

    const v = await violation(
      db.execute(sql`UPDATE chat_tool_run SET result_document_ids = '{}'::uuid[]`),
    );
    expect(v.message).toMatch(/chat_tool_run is append-only/);
  });
});

describe("splitCitations", () => {
  const id = "11111111-2222-3333-4444-555555555555";

  it("separates the answer from its citation tail", () => {
    const { text, citedIds } = splitCitations(`The answer.\n\nCITED_DOCUMENT_IDS: ${id}`);
    expect(text).toBe("The answer.");
    expect(citedIds).toEqual([id]);
  });

  it("handles several ids, and deduplicates them", () => {
    const other = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const { citedIds } = splitCitations(`Answer.\nCITED_DOCUMENT_IDS: ${id}, ${other}, ${id}`);
    expect(citedIds).toEqual([id, other]);
  });

  it("reads an explicit none as no citations", () => {
    const { text, citedIds } = splitCitations("The documents do not say.\nCITED_DOCUMENT_IDS: none");
    expect(text).toBe("The documents do not say.");
    expect(citedIds).toEqual([]);
  });

  it("returns the whole answer when the model omits the tail", () => {
    const { text, citedIds } = splitCitations("Just an answer, no tail.");
    expect(text).toBe("Just an answer, no tail.");
    expect(citedIds).toEqual([]);
  });

  it("ignores anything in the tail that is not a uuid", () => {
    const { citedIds } = splitCitations(`Answer.\nCITED_DOCUMENT_IDS: doc-1, see above, ${id}`);
    expect(citedIds).toEqual([id]);
  });
});
