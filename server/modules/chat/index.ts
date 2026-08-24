import "server-only";

import { db } from "@/server/db/client";
import { search } from "@/server/modules/search";
import { answerFromDocuments } from "./answerer";
import { chatService, type ChatService } from "./service";

let bound: ChatService | undefined;

/**
 * Lazily bound, so importing this module demands neither a DATABASE_URL nor a
 * gateway.
 *
 * Retrieval is the Phase 5 search service, injected rather than imported into
 * the service itself — which is what lets a chat test prove the citation
 * guarantee with a stub retriever and a stub model, no index and no
 * credentials.
 */
export const chat = (): ChatService =>
  (bound ??= chatService(db(), {
    answer: answerFromDocuments,
    retrieve: async (query, limit) => (await search().search({ q: query, limit })).hits,
  }));

export { chatService, CHAT_SYSTEM_PROMPT, type ChatService, type Answerer, type Retriever } from "./service";
export { splitCitations } from "./answerer";
