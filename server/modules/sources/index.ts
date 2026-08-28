import "server-only";

import { db } from "@/server/db/client";
import { sourceFamilyService, sourceService, type SourceFamilyService, type SourceService } from "./service";
import { ingestSource, type IngestResult } from "./ingest";
import { sourceRepo } from "./repo";
import { sourceFetchRepo } from "./repo";
import type { SourceKind } from "@/server/contracts/enums";
import type { Actor } from "@/server/core/audit";
import { googleSearchMonthlyLimit } from "@/server/core/config";

/** Lazily bound, so importing this module does not demand a DATABASE_URL. */
export const sources = (): SourceService => sourceService(db());
export const sourceFamilies = (): SourceFamilyService => sourceFamilyService(db());

/** What the ingestion cron walks: every active source of a registered kind. */
export const activeSources = (kind: SourceKind) => sourceRepo(db()).activeByKind(kind);

export const ingest = (sourceId: string, actor: Actor): Promise<IngestResult> =>
  ingestSource(db(), sourceId, actor);

/** Google discovery is once per Israel-local day per query, with a separate
 * hard monthly ceiling. RSS retains its normal recurring cadence. */
export async function shouldCollectGoogleSource(sourceId: string, now = new Date()): Promise<boolean> {
  const fetches = sourceFetchRepo(db());
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if ((await fetches.countForKindSince("google_search", monthStart)) >= googleSearchMonthlyLimit()) {
    return false;
  }
  const last = await fetches.latestForSource(sourceId);
  return !last || israelDate(last.startedAt) !== israelDate(now);
}

function israelDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export { sourceService, sourceFamilyService, type SourceService, type SourceFamilyService } from "./service";
export { ingestSource, type IngestResult } from "./ingest";
export { CONNECTORS } from "./connectors";
