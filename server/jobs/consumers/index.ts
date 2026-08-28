import "server-only";

/**
 * What happens when an outbox message is actually delivered.
 *
 * One entry per topic in `server/core/outbox.ts::TOPICS`. A topic with no
 * entry here is a bug — the queue route throws loudly rather than silently
 * acknowledging a message nothing handled. A topic whose real work has not
 * been built yet gets an explicit placeholder instead of being left out, so
 * "not implemented" and "forgotten" cannot look the same from the queue's
 * side.
 *
 * Handlers call module services, never `server/db` directly — this registry
 * is orchestration, and an editorial `if` inside it would put policy in the
 * one file that is supposed to have none.
 */

import { TOPICS } from "@/server/core/outbox";
import { search } from "@/server/modules/search";
import { entityTypeSchema } from "@/server/contracts/enums";
import { reports } from "@/server/modules/reports";
import { sendWorkspaceEmail } from "@/server/core/email";

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

  [TOPICS.embeddingRefresh]: async () => {
    /* Embeddings are pulled from the backlog by the cron, not pushed per
       message: the backlog is derived from a hash comparison, so it is
       already correct without anyone telling it what changed. This topic is
       kept as a way to nudge that cron early, and does nothing on its own. */
  },

  [TOPICS.itemDetected]: async () => {
    // Reserved for a future notification job; nothing subscribes yet.
  },

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
};

export function consumerFor(topic: string): Consumer | undefined {
  return CONSUMERS[topic];
}
