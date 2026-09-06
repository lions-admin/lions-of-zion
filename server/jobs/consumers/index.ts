import "server-only";

/**
 * What happens when an outbox message is actually delivered.
 *
 * One entry per topic in `server/core/outbox.ts::TOPICS`. A topic with no
 * entry here is a bug — the queue route throws loudly rather than silently
 * acknowledging a message nothing handled.
 *
 * There is one further entry per topic in `RETIRED_TOPICS`. Those have no
 * producer left and no work to do; they are registered only so that rows a
 * previous deploy wrote can still be acknowledged instead of retrying against
 * a throw. Each one is deletable on the terms written next to it in
 * `outbox.ts`, and until then it is a tombstone rather than a placeholder —
 * the distinction the "not implemented" placeholders used to blur.
 *
 * Handlers call module services, never `server/db` directly — this registry
 * is orchestration, and an editorial `if` inside it would put policy in the
 * one file that is supposed to have none.
 */

import { RETIRED_TOPICS, TOPICS } from "@/server/core/outbox";
import { search } from "@/server/modules/search";
import { entityTypeSchema } from "@/server/contracts/enums";
import { reports } from "@/server/modules/reports";
import { sendWorkspaceEmail } from "@/server/core/email";
import { expirePublicPublicationCache } from "@/server/core/publication-cache";
import { deliverBriefingAlert } from "@/server/modules/briefing/alerts";
import { deliverEditorialRunReport, processEditorialRun } from "@/server/modules/editorial-update";

export type ConsumerContext = { entityType: string | null; entityId: string | null };
export type Consumer = (payload: unknown, ctx: ConsumerContext) => Promise<void>;

/** The outbox carries the subject on the row as well as in the payload; the
 *  row is authoritative because `recordVersion` sets it for every write. */
function subjectOf(payload: unknown, ctx: ConsumerContext) {
  const fromPayload = payload as { entityType?: unknown; id?: unknown } | null;
  const entityType = ctx.entityType ?? fromPayload?.entityType;
  const entityId = ctx.entityId ?? fromPayload?.id;

  const parsed = entityTypeSchema.safeParse(entityType);
  if (!parsed.success || typeof entityId !== "string") return null;
  return { entityType: parsed.data, entityId };
}

const CONSUMERS: Record<string, Consumer> = {
  [TOPICS.searchReindex]: async (payload, ctx) => {
    const subject = subjectOf(payload, ctx);
    /* A message naming no entity cannot be retried into working, so it is
       dropped rather than thrown — throwing would redeliver it forever. */
    if (!subject) return;
    await search().reindex(subject.entityType, subject.entityId);
  },

  /* Retired. Nothing has emitted `item.detected` since 2026-09-01; this
     drains whatever a previous deploy left in the table. Delete it and the
     `RETIRED_TOPICS` entry together, on the terms recorded there. */
  [RETIRED_TOPICS.itemDetected]: async () => {},

  [TOPICS.emailNotification]: async (payload, ctx) => {
    const subject = subjectOf(payload, ctx);
    if (!subject || subject.entityType !== "report") return;
    const report = await reports().get(subject.entityId);
    await sendWorkspaceEmail({
      to: "admin@lionsofzion.io",
      subject: `New public report — ${report.publicId}`,
      replyTo: report.reporterEmail ?? undefined,
      text: [
        `Reference: ${report.publicId}`,
        `URL: ${report.url || "Not provided"}`,
        `Report: ${report.body || "Not provided"}`,
        `Reporter email: ${report.reporterEmail || "Not provided"}`,
        `Reporter note: ${report.reporterNote || "Not provided"}`,
      ].join("\n"),
    });
  },

  [TOPICS.publicationCacheInvalidate]: async () => {
    expirePublicPublicationCache();
  },

  [TOPICS.briefingAlert]: async (payload) => {
    const alertId = (payload as { alertId?: unknown } | null)?.alertId;
    if (typeof alertId !== "string") return;
    await deliverBriefingAlert(alertId);
  },

  [TOPICS.editorialRunProcess]: async (payload) => {
    await processEditorialRun(payload);
  },

  [TOPICS.editorialRunReport]: async (payload) => {
    await deliverEditorialRunReport(payload);
  },
};

export function consumerFor(topic: string): Consumer | undefined {
  return CONSUMERS[topic];
}
