import { queueClient } from "@/server/core/queue-client";
import { handleBriefingQueueDelivery } from "@/server/modules/briefing";

export const briefingQueueHandler = queueClient.handleCallback(async (raw, metadata) => {
  await handleBriefingQueueDelivery(raw, metadata);
}, {
  visibilityTimeoutSeconds: 480,
  retry: (_error, metadata) => ({
    afterSeconds: Math.min(3_600, 30 * 2 ** Math.max(0, metadata.deliveryCount - 1)),
  }),
});
