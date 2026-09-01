import "server-only";

/**
 * The connector registry — static, on purpose.
 *
 * A filesystem scan or a dynamic `import(kind)` would let the bundler miss a
 * connector entirely, and the failure would only show up in production as
 * "connector not found" for a source that looked perfectly configured. A
 * const array the bundler can see and trace has no such failure mode: a
 * missing connector is a `NOT_IMPLEMENTED` the caller can read.
 */

import { ApiError } from "@/server/http/responses";
import type { SourceKind } from "@/server/contracts/enums";
import type { SourceConnector } from "../connector";
import { rssConnector } from "./rss";
import { agentSearchConnector } from "./agent-search";
import { officialApiConnector } from "./api";

/** Google Search Grounding is intentionally not registered. It may answer an
 * interactive question, but it is not a permitted permanent-link collector.
 * Google Agent Search will land as a separate discovery adapter. */
/**
 * The briefing's production discovery contract is deliberately bounded to
 * verified RSS/official endpoints and Google Agent Search. GDELT yielded
 * repeated timeouts and is not a required provider, so legacy GDELT source
 * rows remain visible to administrators but cannot be scheduled.
 */
export const CONNECTORS: readonly SourceConnector[] = [rssConnector, officialApiConnector, agentSearchConnector];

export function connectorFor(kind: SourceKind): SourceConnector {
  const found = CONNECTORS.find((c) => c.kind === kind);
  if (!found) {
    throw new ApiError("NOT_IMPLEMENTED", `No connector is registered for source kind "${kind}"`);
  }
  return found;
}
