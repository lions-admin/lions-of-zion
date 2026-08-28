import "server-only";

/**
 * Item operations. Owns policy; owns no SQL.
 *
 * Every mutation runs in one transaction and goes out through
 * `recordVersion`, so nothing can change without a version, an audit row and a
 * queued reindex. The identity is set on the transaction first, because the
 * status-transition trigger reads it to attribute the trail.
 */

import { ApiError, notFound } from "@/server/http/responses";
import { recordVersion, setIdentity } from "@/server/core/versioning";
import { emit, TOPICS } from "@/server/core/outbox";
import { informationItem } from "@/server/db/schema";
import { itemRepo } from "./repo";
import { canTransition, LEGAL_TRANSITIONS } from "@/server/contracts/item";
import { assertHumanReviewer, findReviewer } from "@/server/modules/assessments";
import type { CreateItem, ListItems, TransitionItem, UpdateItem } from "@/server/contracts/item";
import type { Actor } from "@/server/core/audit";
import type { InformationItem } from "@/server/db/schema";

type Tx = Parameters<typeof recordVersion>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

export function itemService(db: unknown) {
  const run = db as unknown as Runner;

  return {
    async get(id: string): Promise<InformationItem> {
      const item = await itemRepo(db).byId(id);
      if (!item) throw notFound("Information item");
      return item;
    },

    list: (filters: ListItems) => itemRepo(db).list(filters),

    listPublished: (limit: number) => itemRepo(db).listPublished(limit),

    async create(input: CreateItem, actor: Actor, requestId?: string): Promise<InformationItem> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const repo = itemRepo(tx);

        const item = await repo.insert({
          publicId: await uniquePublicId(repo, input.title),
          type: input.type,
          title: input.title,
          canonicalText: input.canonicalText,
          summary: input.summary ?? null,
          language: input.language,
          eventId: input.eventId ?? null,
          primaryTopicId: input.primaryTopicId ?? null,
          createdBy: actor.userId ?? null,
        });

        if (input.topicIds?.length) await repo.setTopics(item.id, input.topicIds);

        await recordVersion(tx as Tx, informationItem, item as never, {
          entityType: "information_item",
          entityId: item.id,
          actor,
          changeSummary: "Item created",
          changeSource: "human_edit",
          requestId,
        });

        await emit(tx as never, TOPICS.itemDetected, { id: item.id }, {
          entityType: "information_item",
          entityId: item.id,
        });

        return item;
      });
    },

    /** Owner-approved scheduled collection creates a detected claim record;
     * it is not an assessment and cannot become public by itself. */
    async autoCreate(input: CreateItem, actor: Actor, requestId?: string): Promise<InformationItem> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const repo = itemRepo(tx);
        const item = await repo.insert({
          publicId: await uniquePublicId(repo, input.title),
          type: input.type,
          title: input.title,
          canonicalText: input.canonicalText,
          summary: input.summary ?? null,
          language: input.language,
          eventId: input.eventId ?? null,
          primaryTopicId: input.primaryTopicId ?? null,
          createdBy: null,
        });
        if (input.topicIds?.length) await repo.setTopics(item.id, input.topicIds);
        await recordVersion(tx as Tx, informationItem, item as never, {
          entityType: "information_item",
          entityId: item.id,
          actor,
          changeSummary: "Automatically collected briefing claim",
          changeSource: "workflow",
          requestId,
        });
        await emit(tx as never, TOPICS.itemDetected, { id: item.id }, {
          entityType: "information_item",
          entityId: item.id,
        });
        return item;
      });
    },

    async update(
      id: string,
      input: UpdateItem,
      actor: Actor,
      requestId?: string,
    ): Promise<InformationItem> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const repo = itemRepo(tx);
        const before = await repo.byId(id);
        if (!before) throw notFound("Information item");

        const { changeSummary, topicIds, ...fields } = input;
        const after = await repo.update(id, {
          ...prune(fields),
          updatedAt: new Date(),
        });
        if (topicIds?.length) await repo.setTopics(id, topicIds);

        await recordVersion(tx as Tx, informationItem, after as never, {
          entityType: "information_item",
          entityId: id,
          actor,
          changeSummary,
          changeSource: "human_edit",
          requestId,
          before,
        });

        return after;
      });
    },

    /**
     * Moves an item through the workflow.
     *
     * Legality is checked here so the caller gets a sentence naming the legal
     * destinations, and enforced again by a trigger so a bug here cannot move
     * an item somewhere it should not go. The duplication is the point.
     */
    async transition(
      id: string,
      input: TransitionItem,
      actor: Actor,
      requestId?: string,
    ): Promise<InformationItem> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const repo = itemRepo(tx);
        const before = await repo.byId(id);
        if (!before) throw notFound("Information item");

        if (before.status === input.to) return before;

        if (!canTransition(before.status, input.to)) {
          throw new ApiError(
            "PRECONDITION_FAILED",
            `An item in "${before.status}" cannot move to "${input.to}". ` +
              `It may move to: ${LEGAL_TRANSITIONS[before.status].join(", ") || "nowhere"}.`,
          );
        }
        if (input.to === "rejected" && !input.reason?.trim()) {
          throw new ApiError(
            "VALIDATION_ERROR",
            "Rejecting an item requires a reason. An unexplained rejection is not a record of anything.",
          );
        }

        /* Entering `approved` is the approval act itself — this is the one
         * place `information_item.approved_by` is ever set. Re-entering it
         * (e.g. after `edited`) re-attributes it to whoever approved it most
         * recently, which is correct: an approval before a rewrite does not
         * carry over to the rewrite. */
        const extra: Record<string, unknown> = {};
        if (input.to === "approved") {
          if (!actor.userId) {
            throw new ApiError(
              "FORBIDDEN",
              "Approving an item requires a known reviewer identity, not just a label.",
            );
          }
          const reviewer = await findReviewer(tx, actor.userId);
          if (!reviewer) throw new ApiError("VALIDATION_ERROR", "Unknown reviewer identity.");
          assertHumanReviewer(reviewer, before.createdBy);
          extra.approvedBy = actor.userId;
        }
        /* `published_at` marks when an item first went public and is not
         * reset on a later republish (`updated` → `published`). */
        if (input.to === "published" && !before.publishedAt) {
          extra.publishedAt = new Date();
        }

        const after = await repo.update(id, {
          status: input.to,
          statusReason: input.reason ?? null,
          updatedAt: new Date(),
          ...extra,
        });

        await recordVersion(tx as Tx, informationItem, after as never, {
          entityType: "information_item",
          entityId: id,
          actor,
          changeSummary: `Status ${before.status} → ${input.to}`,
          changeSource: "human_edit",
          requestId,
          before,
        });

        return after;
      });
    },
  };
}

const prune = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/** A readable slug, made unique by a short suffix rather than a counter query. */
async function uniquePublicId(
  repo: ReturnType<typeof itemRepo>,
  title: string,
): Promise<string> {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "item";
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 7);
    const candidate = `${base}-${suffix}`;
    if (!(await repo.byPublicId(candidate))) return candidate;
  }
  throw new ApiError("CONFLICT", "Could not allocate a public id for this item");
}

export type ItemService = ReturnType<typeof itemService>;
