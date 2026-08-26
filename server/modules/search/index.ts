import "server-only";

import { databaseIdentity, db } from "@/server/db/client";
import { assertWithinBudget, embedText } from "@/server/core/ai/gateway";
import { ai, recordEmbeddingRun } from "@/server/modules/ai";
import { searchService, type SearchService } from "./service";

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
  searchService(db(), {
    embed: async (text) => {
      await assertWithinBudget((since) => ai().spendSince(since));
      const result = await embedText(text);
      await recordEmbeddingRun(db(), { ...result, actorLabel: databaseIdentity() });
      return result.embedding;
    },
  });

export { searchService, type SearchService, type Embedder } from "./service";
export { projectItem, projectEvidence, projectPublication, isIndexable, type Projection } from "./projection";
