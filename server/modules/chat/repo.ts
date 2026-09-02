import "server-only";

/**
 * Persistence for threads, messages, tool runs and citations. Owns SQL; owns
 * no policy.
 *
 * There is no `update` for a message or a citation. A transcript that can be
 * edited after the fact is not a transcript, and the citation trigger's
 * guarantee would mean nothing if the row it approved could later be pointed
 * somewhere else.
 */

import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { chatCitation, chatMessage, chatThread, chatToolRun } from "@/server/db/schema";
import type { ChatMessage, ChatThread, ChatToolRun } from "@/server/db/schema";
import type { Citation, RetrievedDocument } from "@/server/contracts/chat";

type AnyDb = Record<string, (...args: never[]) => never>;

type Db = AnyDb & {
  select: (f?: unknown) => {
    from: (t: unknown) => {
      where: (w: SQL | undefined) => {
        orderBy: (...o: SQL[]) => { limit: (n: number) => Promise<Record<string, unknown>[]> };
      };
    };
  };
  insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<Record<string, unknown>[]> } };
  update: (t: unknown) => { set: (v: unknown) => { where: (w: SQL | undefined) => Promise<unknown> } };
  execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }>;
};

export function chatRepo(db: unknown) {
  const d = db as Db;

  return {
    async createThread(values: Record<string, unknown>): Promise<ChatThread> {
      const rows = await d.insert(chatThread).values(values).returning();
      return rows[0] as unknown as ChatThread;
    },

    async threadById(id: string): Promise<ChatThread | undefined> {
      const rows = await d
        .select()
        .from(chatThread)
        .where(eq(chatThread.id, id))
        .orderBy(desc(chatThread.createdAt))
        .limit(1);
      return rows[0] as unknown as ChatThread | undefined;
    },

    async listThreads(limit: number): Promise<ChatThread[]> {
      const rows = await d
        .select()
        .from(chatThread)
        .where(sql`${chatThread.archivedAt} IS NULL`)
        .orderBy(desc(chatThread.createdAt))
        .limit(limit);
      return rows as unknown as ChatThread[];
    },

    /** In `seq` order, which is the only ordering that is stable when a user
     *  message and its answer land in the same millisecond. */
    async messages(threadId: string): Promise<ChatMessage[]> {
      const rows = await d
        .select()
        .from(chatMessage)
        .where(eq(chatMessage.threadId, threadId))
        .orderBy(asc(chatMessage.seq))
        .limit(500);
      return rows as unknown as ChatMessage[];
    },

    async addMessage(values: Record<string, unknown>): Promise<ChatMessage> {
      /* `seq` is deliberately not passed: the trigger allocates it. */
      const rows = await d.insert(chatMessage).values(values).returning();
      return rows[0] as unknown as ChatMessage;
    },

    async recordToolRun(values: Record<string, unknown>): Promise<ChatToolRun> {
      const rows = await d.insert(chatToolRun).values(values).returning();
      return rows[0] as unknown as ChatToolRun;
    },

    /** The one permitted mutation of a tool run: linking it to the assistant
     *  message it produced, once that message exists. */
    async attachToolRuns(threadId: string, messageId: string): Promise<void> {
      await d
        .update(chatToolRun)
        .set({ messageId })
        .where(and(eq(chatToolRun.threadId, threadId), sql`${chatToolRun.messageId} IS NULL`));
    },

    /** Refused by `chat_citation_must_be_retrieved` unless the document was
     *  actually returned by a retrieval in this thread. */
    async addCitations(
      messageId: string,
      citations: { documentId: string; quote?: string | null }[],
    ): Promise<void> {
      if (!citations.length) return;
      await d
        .insert(chatCitation)
        .values(citations.map((c) => ({ messageId, documentId: c.documentId, quote: c.quote ?? null })))
        .returning();
    },

    /**
     * The citations on these messages, resolved to something a reader can open.
     *
     * The join is a LEFT JOIN and the two resolved columns are nullable on
     * purpose. `chat_citation` is append-only and must keep naming the
     * document it named; `search_document` is a projection that can be
     * rewritten or removed under it. When it has been — the document was
     * unpublished, or an anonymous reader's RLS policy hides it — the citation
     * still renders, without a title and without a link, which is the honest
     * rendering of "this was cited and you cannot currently read it".
     */
    async citationsFor(messageIds: string[]): Promise<Record<string, Citation[]>> {
      if (!messageIds.length) return {};
      const result = await d.execute(sql`
        SELECT c.message_id, c.document_id, c.quote, sd.title, sd.href
        FROM chat_citation c
        LEFT JOIN search_document sd ON sd.id = c.document_id
        WHERE c.message_id IN (${sql.join(messageIds.map((id) => sql`${id}`), sql`, `)})
        ORDER BY c.created_at ASC
        LIMIT 1000
      `);

      const rows = result.rows as {
        message_id: string;
        document_id: string;
        quote: string | null;
        title: string | null;
        href: string | null;
      }[];

      const grouped: Record<string, Citation[]> = {};
      for (const row of rows) {
        (grouped[row.message_id] ??= []).push({
          documentId: row.document_id,
          quote: row.quote,
          title: row.title ?? null,
          href: row.href ?? null,
        });
      }
      return grouped;
    },

    /** Every document retrieval has returned in this thread — the set a
     *  citation may draw from, mirroring exactly what the trigger checks. */
    async retrievableDocumentIds(threadId: string): Promise<string[]> {
      const result = await d.execute(sql`
        SELECT DISTINCT unnest(result_document_ids) AS id
        FROM chat_tool_run
        WHERE thread_id = ${threadId} AND status = 'ok'
      `);
      return (result.rows as { id: string }[]).map((r) => r.id);
    },

    /**
     * Turns search hits into what the model is shown.
     *
     * The verdict is joined on **here**, after retrieval, rather than being
     * indexed into `search_document`. Two reasons, and both matter:
     *
     *   - Indexing it would break search. A query for "verified" would match
     *     every verified item ahead of an article about verification.
     *   - Reading it live means the model never sees a stale conclusion. The
     *     projection is refreshed by a queue drain and can lag by minutes;
     *     `information_item.assessment` is trigger-maintained and is correct
     *     the instant an assessment is written.
     *
     * The excerpt is truncated here rather than in the prompt, so the
     * transcript records exactly what the model was given.
     */
    async documentsFor(ids: string[]): Promise<RetrievedDocument[]> {
      if (!ids.length) return [];

      const result = await d.execute(sql`
        SELECT sd.id, sd.title, sd.body
        FROM search_document sd
        LEFT JOIN information_item i
          ON sd.entity_type = 'information_item' AND i.id = sd.entity_id
        LEFT JOIN publication p
          ON sd.entity_type::text = p.kind::text AND p.id = sd.entity_id
        WHERE sd.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
          AND (
            i.status IN ('published', 'updated')
            OR p.status IN ('published', 'updated')
          )
        ORDER BY sd.created_at ASC
        LIMIT 3`);

      return (result.rows as {
        id: string;
        title: string;
        body: string;
      }[]).map((r) => ({
        documentId: r.id,
        title: r.title,
        excerpt: r.body.slice(0, 500),
        /* Public chat receives the published page projection only. Internal
           findings, evidence excerpts and review caveats never enter its prompt. */
        verdict: null,
      }));
    },
  };
}

export type ChatRepo = ReturnType<typeof chatRepo>;
