import "server-only";

/**
 * The operations agent, bound to the real system.
 *
 * This is the only file that connects the tool registry to live modules. The
 * agent itself takes its context as an argument, so a test constructs it with
 * stubs and needs neither a database nor a gateway.
 */

import { db } from "@/server/db/client";
import { generateWithTools } from "@/server/core/ai/gateway";
import { deepHealth } from "@/server/core/deep-health";
import { adminConsole } from "@/server/modules/admin-console";
import { publications } from "@/server/modules/publications";
import { ingest, syncBriefingSourceCatalog } from "@/server/modules/sources";
import { opsAgentService, type OpsAgentService } from "./service";
import type { OpsToolContext } from "./context";

function liveContext(request?: Request): OpsToolContext {
  return {
    console: adminConsole(),
    publications: {
      get: (id) => publications().get(id),
      list: (filters) => publications().list(filters),
      update: (id, input, actor, requestId) => publications().update(id, input, actor, requestId),
      remove: (id, actor, requestId) => publications().remove(id, actor, requestId),
      transition: (id, input, actor, requestId) => publications().transition(id, input, actor, requestId),
      setHomepageFeature: (slot, publicationId, actor) =>
        publications().setHomepageFeature(slot, publicationId, actor),
    },
    sources: {
      verify: (sourceId, actor) => ingest(sourceId, actor),
      syncCatalog: (actor) => syncBriefingSourceCatalog(actor),
    },
    health: (probeRequest) => deepHealth(probeRequest),
    request,
  };
}

/** Lazily bound, so importing this module does not demand a DATABASE_URL. */
export const opsAgent = (request?: Request): OpsAgentService =>
  opsAgentService(db(), liveContext(request), { run: generateWithTools });

export { opsAgentService, OPS_SYSTEM_PROMPT, type OpsAgentService, type ToolLoopRunner } from "./service";
export { OPS_TOOL_DEFINITIONS, opsTool, type OpsToolDefinition } from "./tools";
export { issueConfirmation, verifyConfirmation, CONFIRMATION_TTL_MS } from "./confirmations";
export type { OpsToolContext, ConsoleReads } from "./context";
