import { queueClient } from "@/server/core/queue-client";
import { handleSourceCollectionDelivery } from "@/server/modules/briefing";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Queue-triggered source collection only. Editorial package execution is
 * received separately and is never started by this route. */
export const POST = queueClient.handleCallback(async (raw, metadata) => {
  await handleSourceCollectionDelivery(raw, metadata);
}, {
  visibilityTimeoutSeconds: 480,
  retry: (_error, metadata) => ({
    afterSeconds: Math.min(3_600, 30 * 2 ** Math.max(0, metadata.deliveryCount - 1)),
  }),
});
