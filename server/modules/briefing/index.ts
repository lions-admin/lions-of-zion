import "server-only";

import { db, withDatabaseRole } from "@/server/db/client";
import { briefingService, type BriefingService } from "./service";
import { externalBriefingPublishService, type ExternalBriefingPublishService } from "./external-publish";
import { importCodexBriefing } from "./codex-import";
import { briefingJobMessageSchema, briefingJobStore, processSourceCollectionJob } from "./jobs";
import type { CodexBriefingImport } from "@/server/contracts/codex-briefing-import";
import type { Actor } from "@/server/core/audit";

export const briefing = (): BriefingService => briefingService(db());

export const externalBriefingPublish = (): ExternalBriefingPublishService => externalBriefingPublishService(db());
export { externalBriefingPublishService, type ExternalBriefingPublishService } from "./external-publish";

export const receiveCodexBriefing = (
  input: CodexBriefingImport,
  actor: Actor,
  requestId?: string,
) => importCodexBriefing(db(), input, actor, requestId);

/** The only queue consumer left under this module: durable source collection.
 * It cannot advance historic editorial stages or create a publication. */
export async function handleSourceCollectionDelivery(
  raw: unknown,
  metadata: { messageId: string; deliveryCount: number },
): Promise<void> {
  const message = briefingJobMessageSchema.parse(raw);
  await withDatabaseRole("app_service", "service:source-ingest", async () => {
    const store = briefingJobStore(db());
    const claim = await store.claim(message.jobId, metadata.messageId, metadata.deliveryCount);
    if (claim.status === "duplicate") return;
    if (claim.status === "busy" || !claim.job) {
      throw new Error(`Source collection job ${message.jobId} is not ready for this delivery.`);
    }
    try {
      const result = await processSourceCollectionJob(claim.job, { label: "service:source-ingest", userId: null });
      await store.complete(claim.job.id, metadata.messageId, {
        fetchId: (result as { fetch?: { id?: string } }).fetch?.id ?? null,
        evidenceCreated: (result as { evidenceCreated?: number }).evidenceCreated ?? 0,
      });
    } catch (cause) {
      const outcome = await store.fail(claim.job, metadata.messageId, cause);
      if (!outcome.quarantined) throw cause;
    }
  });
}

export { briefingService, israelLocalDate, israelLocalHour, type BriefingService } from "./service";
