import "server-only";

import { db } from "@/server/db/client";
import { embedText } from "@/server/core/ai/gateway";
import { searchService, type SearchService } from "./service";

let bound: SearchService | undefined;

/**
 * Lazily bound, so importing this module does not demand a DATABASE_URL or an
 * AI Gateway.
 *
 * The embedder is the seam Phase 5 left open and Phase 6 filled: this is the
 * only line that turns the semantic arm on. It still does nothing useful
 * until pgvector exists in the database *and* the gateway answers — the
 * service checks both, and `/api/v1/search` reports `semantic: false` rather
 * than presenting lexical results as the whole answer.
 */
export const search = (): SearchService =>
  (bound ??= searchService(db(), { embed: async (text) => (await embedText(text)).embedding }));

export { searchService, type SearchService, type Embedder } from "./service";
export { projectItem, projectEvidence, isIndexable, type Projection } from "./projection";
