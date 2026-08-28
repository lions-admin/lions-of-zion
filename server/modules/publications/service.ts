import "server-only";

/**
 * The four publication surfaces. Owns policy; owns no SQL of its own beyond
 * the repository below it.
 *
 * Everything here is deliberately assembly rather than invention: it uses
 * `recordVersion` from Phase 2 and the same approver rules as Phase 4's
 * publish gate. If this file looks repetitive of `items/service.ts`, that is
 * the intended outcome of merging four surfaces into one table — the
 * alternative was four files that looked repetitive of each other *and* of
 * this one.
 */

import { ApiError, notFound } from "@/server/http/responses";
import { recordVersion, setIdentity } from "@/server/core/versioning";
import { assertHumanReviewer, findReviewer } from "@/server/modules/assessments";
import { homepageFeature, publication } from "@/server/db/schema";
import { repo } from "./repo";
import {
  canTransitionPublication,
  LEGAL_PUBLICATION_TRANSITIONS,
} from "@/server/contracts/publication";
import type {
  CreatePublication,
  ListPublicPublications,
  ListPublications,
  PublicPublicationDetail,
  PublicPublication,
  TransitionPublication,
  UpdatePublication,
} from "@/server/contracts/publication";
import type { Actor } from "@/server/core/audit";
import type { Publication } from "@/server/db/schema";

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };


export function publicationService(db: unknown) {
  const run = db as unknown as Runner;

  return {
    async get(id: string): Promise<Publication> {
      const row = await repo(db).byId(id);
      if (!row) throw notFound("Publication");
      return row;
    },

    list: (filters: ListPublications) => repo(db).list(filters),

    async create(input: CreatePublication, actor: Actor, requestId?: string): Promise<Publication> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);

        const row = await r.insert({
          kind: input.kind,
          section: input.section ?? "israel_update",
          publicId: await uniquePublicId(r, input.title),
          title: input.title,
          summary: input.summary ?? null,
          body: input.body,
          language: input.language,
          eventId: input.eventId ?? null,
          primaryTopicId: input.primaryTopicId ?? null,
          scenarioLikelihood: input.scenarioLikelihood ?? null,
          scenarioIndicators: input.scenarioIndicators ?? null,
          createdBy: actor.userId ?? null,
        });

        if (input.itemIds?.length) await r.linkItems(row.id, input.itemIds);
        if (input.narrativeIds?.length) await r.linkNarratives(row.id, input.narrativeIds);
        if (input.evidenceIds?.length) await r.linkEvidence(row.id, input.evidenceIds);

        await recordVersion(tx as Tx, publication, row as never, {
          entityType: kindToEntityType(input.kind),
          entityId: row.id,
          actor,
          changeSummary: `${input.kind} created`,
          changeSource: "human_edit",
          requestId,
        });

        return row;
      });
    },

    /** Owner-authorized automation. This path is intentionally explicit: it
     * writes transparent `autoPublishedAt` provenance instead of impersonating
     * a human reviewer. */
    async autoPublish(input: CreatePublication, actor: Actor, requestId?: string): Promise<Publication> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const publishedAt = new Date();
        const row = await r.insert({
          kind: input.kind,
          section: input.section ?? "israel_update",
          publicId: await uniquePublicId(r, input.title),
          title: input.title,
          summary: input.summary ?? null,
          body: input.body,
          language: input.language,
          eventId: input.eventId ?? null,
          primaryTopicId: input.primaryTopicId ?? null,
          scenarioLikelihood: input.scenarioLikelihood ?? null,
          scenarioIndicators: input.scenarioIndicators ?? null,
          status: "published",
          publishedAt,
          autoPublishedAt: publishedAt,
          createdBy: null,
          approvedBy: null,
        });
        if (input.itemIds?.length) await r.linkItems(row.id, input.itemIds);
        if (input.narrativeIds?.length) await r.linkNarratives(row.id, input.narrativeIds);
        if (input.evidenceIds?.length) await r.linkEvidence(row.id, input.evidenceIds);
        await recordVersion(tx as Tx, publication, row as never, {
          entityType: kindToEntityType(input.kind),
          entityId: row.id,
          actor,
          changeSummary: `${input.kind} automatically published`,
          changeSource: "workflow",
          requestId,
        });
        return row;
      });
    },

    /** Publishes one completed scheduled edition atomically: failures cannot
     * leave a half-edition visible to readers. */
    async autoPublishMany(inputs: CreatePublication[], actor: Actor, requestId?: string): Promise<Publication[]> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const publishedAt = new Date();
        const rows: Publication[] = [];
        for (const input of inputs) {
          const row = await r.insert({
            kind: input.kind,
            section: input.section ?? "israel_update",
            publicId: await uniquePublicId(r, input.title),
            title: input.title,
            summary: input.summary ?? null,
            body: input.body,
            language: input.language,
            eventId: input.eventId ?? null,
            primaryTopicId: input.primaryTopicId ?? null,
            scenarioLikelihood: input.scenarioLikelihood ?? null,
            scenarioIndicators: input.scenarioIndicators ?? null,
            status: "published",
            publishedAt,
            autoPublishedAt: publishedAt,
            createdBy: null,
            approvedBy: null,
          });
          if (input.itemIds?.length) await r.linkItems(row.id, input.itemIds);
          if (input.narrativeIds?.length) await r.linkNarratives(row.id, input.narrativeIds);
          if (input.evidenceIds?.length) await r.linkEvidence(row.id, input.evidenceIds);
          await recordVersion(tx as Tx, publication, row as never, {
            entityType: kindToEntityType(input.kind),
            entityId: row.id,
            actor,
            changeSummary: `${input.kind} automatically published`,
            changeSource: "workflow",
            requestId,
          });
          rows.push(row);
        }
        return rows;
      });
    },

    async listPublic(filters: ListPublicPublications): Promise<PublicPublication[]> {
      const rows = await repo(db).list({
        kind: filters.kind,
        section: filters.section,
        status: "published",
        eventId: undefined,
        cursor: filters.cursor,
        limit: filters.limit,
      });
      const byDate = filters.date
        ? rows.filter((row) => row.publishedAt?.toISOString().slice(0, 10) === filters.date)
        : rows;
      return byDate.map(toPublicPublication);
    },

    async getPublic(publicId: string): Promise<PublicPublication> {
      const row = await repo(db).byPublicId(publicId);
      if (!row || (row.status !== "published" && row.status !== "updated")) throw notFound("Publication");
      return toPublicPublication(row);
    },

    async getPublicDetail(publicId: string): Promise<PublicPublicationDetail> {
      const row = await repo(db).byPublicId(publicId);
      if (!row || (row.status !== "published" && row.status !== "updated")) throw notFound("Publication");
      return { ...toPublicPublication(row), ...(await repo(db).publicReferences(row.id)) };
    },

    async featured(): Promise<PublicPublication[]> {
      const d = db as unknown as {
        select: () => {
          from: (t: unknown) => {
            orderBy: (o: unknown) => Promise<Array<{ slot: number; publicationId: string }>>;
          };
        };
      };
      const features = await d.select().from(homepageFeature).orderBy(homepageFeature.slot);
      const live = await repo(db).list({ status: "published", limit: 100 });
      const ordered = features
        .map((feature) => live.find((row) => row.id === feature.publicationId))
        .filter((row): row is Publication => Boolean(row));
      return (ordered.length ? ordered : live.slice(0, 3)).map(toPublicPublication);
    },

    async update(
      id: string,
      input: UpdatePublication,
      actor: Actor,
      requestId?: string,
    ): Promise<Publication> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const before = await r.byId(id);
        if (!before) throw notFound("Publication");

        const { changeSummary, ...fields } = input;
        const after = await r.update(id, {
          ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
          updatedAt: new Date(),
        });

        await recordVersion(tx as Tx, publication, after as never, {
          entityType: kindToEntityType(before.kind),
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
     * Moves a publication through its lifecycle.
     *
     * `approved` is where the second human is recorded, and `published` is
     * where the timestamp lands — the same two writes `itemService` makes,
     * because the publish gate on the table reads exactly those columns.
     */
    async transition(
      id: string,
      input: TransitionPublication,
      actor: Actor,
      requestId?: string,
    ): Promise<Publication> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const before = await r.byId(id);
        if (!before) throw notFound("Publication");
        if (before.status === input.to) return before;

        if (!canTransitionPublication(before.status, input.to)) {
          throw new ApiError(
            "PRECONDITION_FAILED",
            `A ${before.kind} in "${before.status}" cannot move to "${input.to}". ` +
              `It may move to: ${LEGAL_PUBLICATION_TRANSITIONS[before.status].join(", ") || "nowhere"}.`,
          );
        }

        const extra: Record<string, unknown> = {};
        if (input.to === "approved") {
          if (!actor.userId) {
            throw new ApiError(
              "FORBIDDEN",
              "Approving a publication requires a known reviewer identity, not just a label.",
            );
          }
          const reviewer = await findReviewer(tx, actor.userId);
          if (!reviewer) throw new ApiError("VALIDATION_ERROR", "Unknown reviewer identity.");
          assertHumanReviewer(reviewer, before.createdBy);
          extra.approvedBy = actor.userId;
        }
        if (input.to === "published" && !before.publishedAt) {
          extra.publishedAt = new Date();
        }

        const after = await r.update(id, { status: input.to, updatedAt: new Date(), ...extra });

        await recordVersion(tx as Tx, publication, after as never, {
          entityType: kindToEntityType(before.kind),
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

function toPublicPublication(row: Publication): PublicPublication {
  if (!row.publishedAt) throw new ApiError("NOT_FOUND", "Publication is not public.");
  return {
    publicId: row.publicId,
    kind: row.kind,
    section: row.section,
    title: row.title,
    summary: row.summary,
    body: row.body,
    language: row.language,
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    autoPublishedAt: row.autoPublishedAt?.toISOString() ?? null,
  };
}

/** `entity_type` predates the merged `publication` table and still names the
 *  four surfaces separately, which is right — a version row should say what
 *  kind of thing it is a version of. */
function kindToEntityType(kind: Publication["kind"]) {
  return kind as "news_update" | "brief" | "geopolitical_analysis" | "scenario";
}

async function uniquePublicId(r: ReturnType<typeof repo>, title: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "publication";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    if (!(await r.byPublicId(candidate))) return candidate;
  }
  throw new ApiError("CONFLICT", "Could not allocate a public id for this publication");
}

export type PublicationService = ReturnType<typeof publicationService>;
