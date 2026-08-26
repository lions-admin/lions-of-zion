import "server-only";

import { db } from "@/server/db/client";
import { sourceFamilyService, sourceService, type SourceFamilyService, type SourceService } from "./service";
import { ingestSource, type IngestResult } from "./ingest";
import { sourceRepo } from "./repo";
import type { SourceKind } from "@/server/contracts/enums";
import type { Actor } from "@/server/core/audit";

/** Lazily bound, so importing this module does not demand a DATABASE_URL. */
export const sources = (): SourceService => sourceService(db());
export const sourceFamilies = (): SourceFamilyService => sourceFamilyService(db());

/** What the ingestion cron walks: every active source of a registered kind. */
export const activeSources = (kind: SourceKind) => sourceRepo(db()).activeByKind(kind);

export const ingest = (sourceId: string, actor: Actor): Promise<IngestResult> =>
  ingestSource(db(), sourceId, actor);

export { sourceService, sourceFamilyService, type SourceService, type SourceFamilyService } from "./service";
export { ingestSource, type IngestResult } from "./ingest";
export { CONNECTORS } from "./connectors";
