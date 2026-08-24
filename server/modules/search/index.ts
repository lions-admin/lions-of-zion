import "server-only";

import { db } from "@/server/db/client";
import { searchService, type SearchService } from "./service";

let bound: SearchService | undefined;

/** Lazily bound, so importing this module does not demand a DATABASE_URL.
 *  No embedder is passed: Phase 6 supplies one here, and until then search
 *  runs on its lexical arms alone rather than pretending otherwise. */
export const search = (): SearchService => (bound ??= searchService(db()));

export { searchService, type SearchService, type Embedder } from "./service";
export { projectItem, projectEvidence, isIndexable, type Projection } from "./projection";
