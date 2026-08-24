import "server-only";

/**
 * The real answerer: one model call, constrained to the retrieved documents.
 *
 * Citations are extracted from a structured tail rather than parsed out of
 * prose. Asking a model to inline `[doc:uuid]` markers and then regexing them
 * back out reliably produces citations for documents that were never
 * retrieved — the model completes the *shape* of a uuid perfectly well. A
 * separate, explicit list is easier for the model and easier to validate, and
 * the database refuses whatever still slips through.
 */

import { generateText } from "ai";
import { modelFor } from "@/server/core/config";
import { CHAT_SYSTEM_PROMPT } from "./service";
import type { Answerer } from "./service";
import type { RetrievedDocument } from "@/server/contracts/chat";

const CITATION_HEADER = "CITED_DOCUMENT_IDS:";

function documentBlock(documents: RetrievedDocument[]): string {
  if (!documents.length) return "(no documents were retrieved for this question)";
  return documents
    .map((d) => `--- id: ${d.documentId}\ntitle: ${d.title}\n${d.excerpt}`)
    .join("\n\n");
}

export const answerFromDocuments: Answerer = async ({ question, history, documents }) => {
  const model = modelFor("reasoning");
  const startedAt = Date.now();

  const transcript = history
    .slice(-10)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const result = await generateText({
    model,
    system: `${CHAT_SYSTEM_PROMPT}\n\nAfter your answer, output a final line "${CITATION_HEADER}" followed by a comma-separated list of the document ids you relied on. List only ids present in the documents given to you. If you relied on none, write "${CITATION_HEADER} none".`,
    prompt: [
      transcript && `Conversation so far:\n${transcript}`,
      `Documents:\n${documentBlock(documents)}`,
      `Question: ${question}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    providerOptions: { gateway: { tags: ["feature:chat"] } },
  });

  const { text, citedIds } = splitCitations(result.text);

  return {
    text,
    /* Validated again against what was actually retrieved — belt to the
       database's braces, and it keeps a hallucinated id out of the insert
       rather than relying on the trigger to reject the whole batch. */
    citations: citedIds
      .filter((id) => documents.some((d) => d.documentId === id))
      .map((documentId) => ({ documentId })),
    model,
    inputTokens: result.usage?.inputTokens ?? null,
    outputTokens: result.usage?.outputTokens ?? null,
    latencyMs: Date.now() - startedAt,
  };
};

/** Splits the answer from its citation tail. Exported for its own test —
 *  this is string handling on model output, which is exactly the kind of code
 *  that is quietly wrong until someone looks at it. */
export function splitCitations(raw: string): { text: string; citedIds: string[] } {
  const index = raw.lastIndexOf(CITATION_HEADER);
  if (index === -1) return { text: raw.trim(), citedIds: [] };

  const text = raw.slice(0, index).trim();
  const tail = raw.slice(index + CITATION_HEADER.length).trim();
  if (!tail || tail.toLowerCase().startsWith("none")) return { text, citedIds: [] };

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const citedIds = [
    ...new Set(
      tail
        .split(/[,\s]+/)
        .map((s) => s.trim().replace(/^[[(]|[\])]$/g, ""))
        .filter((s) => uuid.test(s)),
    ),
  ];
  return { text, citedIds };
}
