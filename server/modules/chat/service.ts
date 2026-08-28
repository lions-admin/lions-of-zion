import "server-only";

/**
 * Chat. Owns policy; owns no SQL.
 *
 * A turn is: record the user's message → retrieve → ask the model → record
 * the answer, its run, and its citations. Retrieval happens **before** the
 * model is asked, and its results are written to `chat_tool_run` first, so
 * the citation trigger has something to check against by the time the answer
 * is filed. A model that names a document retrieval did not return has its
 * citation refused by the database, not by a reviewer noticing later.
 *
 * `answer` is injected, like the generator in Phase 6 — the whole turn,
 * including the citation guarantee, is testable with a stub model.
 */

import { ApiError, notFound } from "@/server/http/responses";
import { setIdentity } from "@/server/core/versioning";
import { recordChatRun } from "@/server/modules/ai";
import { chatRepo } from "./repo";
import type { Actor } from "@/server/core/audit";
import type { ChatMessageView, CreateThread, PostMessage, RetrievedDocument } from "@/server/contracts/chat";
import type { ChatThread } from "@/server/db/schema";

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

/** What the model is asked, and what it must return. `citations` may only
 *  name documents from `documents` — anything else the database refuses. */
export type Answerer = (input: {
  question: string;
  history: { role: string; content: string }[];
  documents: RetrievedDocument[];
}) => Promise<{
  text: string;
  citations: { documentId: string; quote?: string | null }[];
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number;
  latencyMs: number;
}>;

/** Retrieval, as this module needs it — satisfied by the Phase 5 search
 *  service, injected rather than imported so a chat test needs no index. */
export type Retriever = (query: string, limit: number) => Promise<{ documentId: string }[]>;

export const CHAT_SYSTEM_PROMPT = [
  "You are the Lions of Zion public conversation assistant.",
  "Hold a helpful general conversation and answer ordinary questions clearly.",
  "For questions about this site's evidence, use the provided published documents and cite only their ids.",
  "For current events or questions about posts and discussion on X, use the X search tool when useful.",
  "Never present an unsupported claim as verified, and say plainly when evidence is unavailable.",
  "",
  "Some documents carry an OUR FINDING line. That is this organisation's own reviewed",
  "conclusion about the claim, and it outranks the claim text above it — the text is what",
  "someone asserted, the finding is what we established. Lead with the finding whenever one",
  "exists: state that a claim was found false or misleading before summarising what it said,",
  "so no reader takes a repeated claim for a confirmed one.",
  "",
  "Two findings must never be flattened: a finding marked NOT yet published is still under",
  "review and must not be voiced as settled, and a STILL UNKNOWN line must be carried into",
  "your answer. Omitting the caveats is worse than omitting the finding.",
].join(" ");

export function chatService(
  db: unknown,
  opts: { answer?: Answerer; retrieve?: Retriever; guardBudget?: () => Promise<void> } = {},
) {
  const run = db as unknown as Runner;
  const repo = chatRepo(db);

  return {
    listThreads: (limit = 25) => repo.listThreads(limit),

    async createThread(input: CreateThread, actor: Actor): Promise<ChatThread> {
      return repo.createThread({
        title: input.title ?? null,
        createdBy: actor.userId ?? null,
        createdByLabel: actor.label,
      });
    },

    async transcript(threadId: string): Promise<ChatMessageView[]> {
      const thread = await repo.threadById(threadId);
      if (!thread) throw notFound("Thread");

      const messages = await repo.messages(threadId);
      const citations = await repo.citationsFor(messages.map((m) => m.id));

      return messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        seq: m.seq,
        role: m.role as ChatMessageView["role"],
        content: m.content,
        citations: (citations[m.id] ?? []).map((c) => ({ documentId: c.documentId, quote: c.quote })),
        createdAt: m.createdAt.toISOString(),
      }));
    },

    /**
     * One full turn.
     *
     * Not one transaction: the model call sits in the middle and can take
     * tens of seconds, and holding a Postgres transaction open across it
     * would be the same mistake ingestion avoids in Phase 3. Each write is
     * its own unit, ordered so that nothing references something that does
     * not exist yet.
     */
    async ask(threadId: string, input: PostMessage, actor: Actor): Promise<ChatMessageView> {
      const thread = await repo.threadById(threadId);
      if (!thread) throw notFound("Thread");
      if (!opts.answer) {
        throw new ApiError(
          "NOT_IMPLEMENTED",
          "No AI gateway is configured, so chat cannot answer. Link the Vercel project and pull its OIDC environment.",
        );
      }
      const retrieve = opts.retrieve;
      if (!retrieve) {
        throw new ApiError("NOT_IMPLEMENTED", "No retriever is configured for chat.");
      }

      await opts.guardBudget?.();
      const history = (await repo.messages(threadId))
        .slice(-2)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 600) }));

      await run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        await chatRepo(tx).addMessage({ threadId, role: "user", content: input.content });
      });

      /* Retrieval first, and recorded first — the citation trigger reads
         `chat_tool_run`, so the answer cannot be filed with citations until
         this row exists. */
      const startedAt = Date.now();
      let hits: { documentId: string }[] = [];
      let toolStatus: "ok" | "error" = "ok";
      try {
        hits = await retrieve(input.content, 3);
      } catch {
        toolStatus = "error";
      }

      await repo.recordToolRun({
        threadId,
        tool: "search",
        input: { query: input.content, limit: 3 },
        output: { count: hits.length },
        resultDocumentIds: hits.map((h) => h.documentId),
        status: toolStatus,
        latencyMs: Date.now() - startedAt,
      });

      const documents = await repo.documentsFor(hits.map((h) => h.documentId));
      const answer = await opts.answer({ question: input.content, history, documents });

      /* Drop any citation naming something not retrieved, rather than letting
         the insert fail and lose the whole answer. The database would refuse
         it either way; this turns a hard failure into a recorded answer with
         the fabricated citation stripped, which is the more useful outcome
         and leaves the tool run as evidence of what was actually available. */
      const retrievable = new Set(documents.map((d) => d.documentId));
      const citations = answer.citations.filter((c) => retrievable.has(c.documentId));

      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const txRepo = chatRepo(tx);

        /* The turn's cost lands in the same ledger as every other model call,
           rather than a parallel one only chat knows about. */
        const aiRunId = await recordChatRun(tx, {
          model: answer.model,
          inputTokens: answer.inputTokens,
          outputTokens: answer.outputTokens,
          costUsd: answer.costUsd,
          latencyMs: answer.latencyMs,
          actor,
        });

        const message = await txRepo.addMessage({
          threadId,
          role: "assistant",
          content: answer.text,
          aiRunId,
        });

        await txRepo.attachToolRuns(threadId, message.id);
        await txRepo.addCitations(message.id, citations);

        return {
          id: message.id,
          threadId,
          seq: message.seq,
          role: "assistant" as const,
          content: message.content,
          citations: citations.map((c) => ({ documentId: c.documentId, quote: c.quote ?? null })),
          createdAt: message.createdAt.toISOString(),
        };
      });
    },

    /** The set a citation may draw from — the same thing the trigger checks,
     *  exposed so a client can show what the answer had available. */
    retrievableDocumentIds: (threadId: string) => repo.retrievableDocumentIds(threadId),
  };
}

export type ChatService = ReturnType<typeof chatService>;
