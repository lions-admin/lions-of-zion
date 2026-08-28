import "server-only";

import { db } from "@/server/db/client";
import { generate } from "@/server/core/ai/gateway";
import { aiService, type AiService } from "./service";

/**
 * Lazily bound, so importing this module does not demand a DATABASE_URL or an
 * AI Gateway. The real generator is wired in here and nowhere else — every
 * test constructs `aiService(db, { generate: stub })` instead, which is what
 * keeps the suite free of credentials and network calls.
 */
export const ai = (): AiService => aiService(db(), { generate });

export {
  aiService,
  recordBriefingRun,
  recordChatRun,
  recordEmbeddingRun,
  type AiService,
  type Generator,
} from "./service";
