import "server-only";

import { db } from "@/server/db/client";
import { withDatabaseRole } from "@/server/db/client";
import { briefingService, type BriefingService } from "./service";
import { externalBriefingPublishService, type ExternalBriefingPublishService } from "./external-publish";
import { briefingJobMessageSchema, briefingJobStore, processBriefingJob } from "./jobs";
import { importCodexBriefing } from "./codex-import";
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

/** Queue routes only authenticate and hand off here; the module owns the
 * database claim, pause/defer, checkpoint, and failure semantics. */
export async function handleBriefingQueueDelivery(
  raw: unknown,
  metadata: { messageId: string; deliveryCount: number },
): Promise<void> {
  const message = briefingJobMessageSchema.parse(raw);
  await withDatabaseRole("app_service", "service:briefing-queue", async () => {
    const store = briefingJobStore(db());
    const claim = await store.claim(message.jobId, metadata.messageId, metadata.deliveryCount);
    if (claim.status === "duplicate") return;
    if (claim.status === "busy" || !claim.job) {
      throw new Error(`Briefing job ${message.jobId} is not ready for this delivery.`);
    }
    try {
      const result = await processBriefingJob(claim.job, { label: "service:briefing-queue", userId: null });
      if (result && typeof result === "object"
        && (result as { status?: string; reason?: string }).status === "skipped"
        && (result as { reason?: string }).reason === "processing_paused") {
        await store.defer(claim.job.id, metadata.messageId, "Briefing processing is paused.");
        return;
      }
      const checkpoint = claim.job.stage === "collect" && result && typeof result === "object"
        ? {
            fetchId: (result as { fetch?: { id?: string } }).fetch?.id ?? null,
            evidenceCreated: (result as { evidenceCreated?: number }).evidenceCreated ?? 0,
          }
        : { completed: true, result };
      await store.complete(claim.job.id, metadata.messageId, checkpoint);
    } catch (cause) {
      const outcome = await store.fail(claim.job, metadata.messageId, cause);
      if (!outcome.quarantined) throw cause;
    }
  });
}

export { briefingService, israelLocalDate, israelLocalHour, type BriefingService } from "./service";
