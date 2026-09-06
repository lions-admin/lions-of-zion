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
import { writeAudit } from "@/server/core/audit";
import { assertHumanReviewer, findReviewer } from "@/server/modules/assessments";
import { homepageFeature, publication } from "@/server/db/schema";
import { repo } from "./repo";
import {
  canTransitionPublication,
  isAnalysisBasis,
  LEGAL_PUBLICATION_TRANSITIONS,
  narrativeWatchTitle,
} from "@/server/contracts/publication";
import type {
  CreatePublication,
  ListPublicPublications,
  ListPublications,
  NarrativeWatchDetails,
  PublicPublicationDetail,
  PublicPublication,
  TransitionPublication,
  UpdatePublication,
} from "@/server/contracts/publication";
import type { Actor } from "@/server/core/audit";
import type { Publication } from "@/server/db/schema";
import { emit, TOPICS } from "@/server/core/outbox";

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

type AutomationProvenance = {
  briefingRunId: string;
  machineAuthor: string;
  candidateKeys: string[];
  /** Present only for an explicit same-day regeneration. It lets a successful
   * replacement retire the old public edition atomically. */
  supersedeLocalDate?: string;
};

/** Provenance for machine-created drafts while public release is paused. */
type DraftProvenance = Pick<AutomationProvenance, "briefingRunId" | "machineAuthor">;

type GeneratedDraftProvenance = DraftProvenance & Pick<AutomationProvenance, "candidateKeys">;


export function publicationService(db: unknown) {
  const run = db as unknown as Runner;

  return {
    async get(id: string): Promise<Publication> {
      const row = await repo(db).byId(id);
      if (!row) throw notFound("Publication");
      return row;
    },

    list: (filters: ListPublications) => repo(db).list(filters),
    traceability: (id: string) => repo(db).adminTraceability(id),

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
          editorialTopic: input.editorialTopic ?? null,
          primaryActor: input.primaryActor ?? null,
          arena: input.arena ?? null,
          featuredIsraelStory: input.featuredIsraelStory ?? false,
          narrativeWatchDetails: input.narrativeWatchDetails ?? null,
          scenarioLikelihood: input.scenarioLikelihood ?? null,
          scenarioIndicators: input.scenarioIndicators ?? null,
          createdBy: actor.userId ?? null,
        });

        if (input.itemIds?.length) await r.linkItems(row.id, input.itemIds);
        if (input.narrativeIds?.length) await r.linkNarratives(row.id, input.narrativeIds);
        if (input.evidenceIds?.length) await r.linkEvidence(row.id, input.evidenceIds);
        if (input.passages?.length) await r.linkPassages(row.id, input.passages);

        await recordVersion(tx as Tx, publication, row as never, {
          entityType: kindToEntityType(input.kind),
          entityId: row.id,
          actor,
          changeSummary: `${input.kind} created`,
          changeSource: "human_edit",
          requestId,
        });
        await emit(tx as never, TOPICS.publicationCacheInvalidate, { publicId: row.publicId });

        return row;
      });
    },

    /** Creates a complete generated edition as private drafts in one
     * transaction. This is the safe processing mode while automatic release
     * is paused or before production acceptance has passed. */
    async createMany(
      inputs: CreatePublication[],
      actor: Actor,
      requestId?: string,
      provenance?: GeneratedDraftProvenance,
    ): Promise<Publication[]> {
      if (provenance && provenance.candidateKeys.length !== inputs.length) {
        throw new ApiError("VALIDATION_ERROR", "Every generated draft requires one stable candidate key.");
      }
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const rows: Publication[] = [];
        for (const [inputIndex, input] of inputs.entries()) {
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
            editorialTopic: input.editorialTopic ?? null,
            primaryActor: input.primaryActor ?? null,
            arena: input.arena ?? null,
            featuredIsraelStory: input.featuredIsraelStory ?? false,
            narrativeWatchDetails: input.narrativeWatchDetails ?? null,
            scenarioLikelihood: input.scenarioLikelihood ?? null,
            scenarioIndicators: input.scenarioIndicators ?? null,
            briefingRunId: provenance?.briefingRunId ?? null,
            briefingCandidateKey: provenance?.candidateKeys[inputIndex] ?? null,
            machineAuthor: provenance?.machineAuthor ?? null,
            status: "draft",
            createdBy: actor.userId ?? null,
          });
          if (input.itemIds?.length) await r.linkItems(row.id, input.itemIds);
          if (input.narrativeIds?.length) await r.linkNarratives(row.id, input.narrativeIds);
          if (input.evidenceIds?.length) await r.linkEvidence(row.id, input.evidenceIds);
          if (input.passages?.length) await r.linkPassages(row.id, input.passages);
          await recordVersion(tx as Tx, publication, row as never, {
            entityType: kindToEntityType(input.kind),
            entityId: row.id,
            actor,
            changeSummary: `${input.kind} generated as draft`,
            changeSource: "workflow",
            requestId,
          });
          rows.push(row);
        }
        if (rows.length > 1 && inputs[0]?.section === "daily_brief") {
          await r.linkRelated(rows[0]!.id, rows.slice(1).map((row) => row.id));
        }
        return rows;
      });
    },

    /** Promote an already materialised generated draft edition.
     *
     * This covers the narrow interval in which collection was allowed while
     * automatic release was paused. It promotes the original rows (and their
     * evidence, claim and narrative links), rather than re-running drafting or
     * creating a second edition. Exact title, summary, body, kind and section
     * matching deliberately fails closed if a draft was edited or ambiguous.
     */
    async resumeGeneratedDrafts(
      inputs: CreatePublication[],
      provenance: AutomationProvenance,
      actor: Actor,
      requestId?: string,
    ): Promise<Publication[]> {
      if (provenance.candidateKeys.length !== inputs.length) {
        throw new ApiError("VALIDATION_ERROR", "Every resumed publication requires one stable candidate key.");
      }
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const generated = await r.generatedDrafts(provenance.briefingRunId);
        if (!generated.length) {
          const existing = await r.automaticCandidates(provenance.briefingRunId, provenance.candidateKeys);
          if (existing.length === inputs.length
            && existing.every((row) => row.status === "published" && row.autoPublishedAt !== null)) {
            const byCandidate = new Map(existing.map((row) => [row.briefingCandidateKey, row]));
            return provenance.candidateKeys.map((candidateKey) => byCandidate.get(candidateKey)!);
          }
        }
        if (generated.length !== inputs.length) {
          throw new ApiError("CONFLICT", "The paused edition is incomplete and requires manual recovery.");
        }
        const matched = inputs.map((input) => {
          const rows = generated.filter((row) => row.kind === input.kind
            && row.section === (input.section ?? "israel_update")
            && row.title === input.title
            && (row.summary ?? null) === (input.summary ?? null)
            && row.body === input.body);
          if (rows.length !== 1) {
            throw new ApiError("CONFLICT", "The paused edition no longer exactly matches its approved draft artifact.");
          }
          return rows[0]!;
        });
        if (new Set(matched.map((row) => row.id)).size !== inputs.length) {
          throw new ApiError("CONFLICT", "The paused edition contains duplicate draft matches.");
        }
        const publishedAt = new Date();
        const rows: Publication[] = [];
        for (const [index, draft] of matched.entries()) {
          const row = await r.update(draft.id, {
            status: "published",
            publishedAt,
            autoPublishedAt: publishedAt,
            briefingCandidateKey: provenance.candidateKeys[index]!,
            machineAuthor: provenance.machineAuthor,
            approvedBy: null,
            updatedAt: publishedAt,
          });
          await recordVersion(tx as Tx, publication, row as never, {
            entityType: kindToEntityType(row.kind),
            entityId: row.id,
            actor,
            changeSummary: `${row.kind} automatically published from a paused generated draft`,
            changeSource: "workflow",
            requestId,
            before: draft,
          });
          rows.push(row);
        }
        await emit(tx as never, TOPICS.publicationCacheInvalidate, { publicIds: rows.map((row) => row.publicId) });
        return rows;
      });
    },

    /** Owner-authorized automation. This path is intentionally explicit: it
     * writes transparent `autoPublishedAt` provenance instead of impersonating
     * a human reviewer. */
    async autoPublish(
      input: CreatePublication,
      provenance: AutomationProvenance,
      actor: Actor,
      requestId?: string,
    ): Promise<Publication> {
      if (provenance.candidateKeys.length !== 1) {
        throw new ApiError("VALIDATION_ERROR", "Automatic publication requires one stable candidate key.");
      }
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const candidateKey = provenance.candidateKeys[0]!;
        const existing = await r.automaticCandidates(provenance.briefingRunId, [candidateKey]);
        if (existing.length === 1) {
          const row = existing[0]!;
          if (row.status === "published" && row.autoPublishedAt !== null) return row;
          throw new ApiError("CONFLICT", "A generated draft already exists for this candidate and requires paused-edition recovery.");
        }
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
          editorialTopic: input.editorialTopic ?? null,
          primaryActor: input.primaryActor ?? null,
          arena: input.arena ?? null,
          featuredIsraelStory: input.featuredIsraelStory ?? false,
          narrativeWatchDetails: input.narrativeWatchDetails ?? null,
          scenarioLikelihood: input.scenarioLikelihood ?? null,
          scenarioIndicators: input.scenarioIndicators ?? null,
          status: "published",
          publishedAt,
          autoPublishedAt: publishedAt,
          briefingRunId: provenance.briefingRunId,
          briefingCandidateKey: candidateKey,
          machineAuthor: provenance.machineAuthor,
          createdBy: null,
          approvedBy: null,
        });
        if (input.itemIds?.length) await r.linkItems(row.id, input.itemIds);
        if (input.narrativeIds?.length) await r.linkNarratives(row.id, input.narrativeIds);
        if (input.evidenceIds?.length) await r.linkEvidence(row.id, input.evidenceIds);
        if (input.passages?.length) await r.linkPassages(row.id, input.passages);
        await recordVersion(tx as Tx, publication, row as never, {
          entityType: kindToEntityType(input.kind),
          entityId: row.id,
          actor,
          changeSummary: `${input.kind} automatically published`,
          changeSource: "workflow",
          requestId,
        });
        await emit(tx as never, TOPICS.publicationCacheInvalidate, { publicId: row.publicId });
        return row;
      });
    },

    /** Publishes one completed scheduled edition atomically: failures cannot
     * leave a half-edition visible to readers. */
    async autoPublishMany(
      inputs: CreatePublication[],
      provenance: AutomationProvenance,
      actor: Actor,
      requestId?: string,
    ): Promise<Publication[]> {
      if (provenance.candidateKeys.length !== inputs.length) {
        throw new ApiError("VALIDATION_ERROR", "Every automatic publication requires one stable candidate key.");
      }
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const archiveSuperseded = async (rows: Publication[]) => {
          if (!provenance.supersedeLocalDate) return;
          const oldIds = await r.automaticPublicationIdsForDate(
            provenance.supersedeLocalDate,
            provenance.briefingRunId,
          );
          for (const id of oldIds) {
            const before = await r.byId(id);
            if (!before) continue;
            const after = await r.update(id, { status: "archived", updatedAt: new Date() });
            await recordVersion(tx as Tx, publication, after as never, {
              entityType: kindToEntityType(before.kind), entityId: id, actor,
              changeSummary: "Superseded by a forced regeneration of this daily edition",
              changeSource: "workflow", requestId, before,
            });
            rows.push(after);
          }
        };
        const existing = await r.automaticCandidates(provenance.briefingRunId, provenance.candidateKeys);
        if (existing.length) {
          if (existing.length !== inputs.length) {
            throw new ApiError("CONFLICT", "An incomplete automatic edition already exists and requires operator recovery.");
          }
          const byCandidate = new Map(existing.map((row) => [row.briefingCandidateKey, row]));
          const ordered = provenance.candidateKeys.map((candidateKey) => byCandidate.get(candidateKey)!);
          if (ordered.every((row) => row.status === "published" && row.autoPublishedAt !== null)) {
            return ordered;
          }

          /* A run can reach the publish stage after automatic publishing was
           * re-enabled. In that case the exact generated drafts already own
           * the candidate keys. Promote them instead of treating draft rows as
           * a completed automatic publication or inserting a duplicate edition. */
          if (!ordered.every((row) => row.status === "draft" && row.autoPublishedAt === null)) {
            throw new ApiError("CONFLICT", "The automatic edition has an unsupported mixed publication state.");
          }
          for (const [index, input] of inputs.entries()) {
            const draft = ordered[index]!;
            if (draft.kind !== input.kind
              || draft.section !== (input.section ?? "israel_update")
              || draft.title !== input.title
              || (draft.summary ?? null) !== (input.summary ?? null)
              || draft.body !== input.body) {
              throw new ApiError("CONFLICT", "The stored generated drafts no longer match the approved edition.");
            }
          }
          const publishedAt = new Date();
          const rows: Publication[] = [];
          for (const [index, draft] of ordered.entries()) {
            const row = await r.update(draft.id, {
              status: "published",
              publishedAt,
              autoPublishedAt: publishedAt,
              approvedBy: null,
              updatedAt: publishedAt,
            });
            await recordVersion(tx as Tx, publication, row as never, {
              entityType: kindToEntityType(row.kind),
              entityId: row.id,
              actor,
              changeSummary: `${row.kind} automatically published from a generated draft`,
              changeSource: "workflow",
              requestId,
              before: draft,
            });
            rows.push(row);
          }
          if (rows.length > 1 && inputs[0]?.section === "daily_brief") {
            await r.linkRelated(rows[0]!.id, rows.slice(1).map((row) => row.id));
          }
          const published = [...rows];
          await archiveSuperseded(rows);
          await emit(tx as never, TOPICS.publicationCacheInvalidate, { publicIds: rows.map((row) => row.publicId) });
          return published;
        }
        const publishedAt = new Date();
        const rows: Publication[] = [];
        for (const [inputIndex, input] of inputs.entries()) {
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
            editorialTopic: input.editorialTopic ?? null,
            primaryActor: input.primaryActor ?? null,
            arena: input.arena ?? null,
            featuredIsraelStory: input.featuredIsraelStory ?? false,
            narrativeWatchDetails: input.narrativeWatchDetails ?? null,
            scenarioLikelihood: input.scenarioLikelihood ?? null,
            scenarioIndicators: input.scenarioIndicators ?? null,
            status: "published",
            publishedAt,
            autoPublishedAt: publishedAt,
            briefingRunId: provenance.briefingRunId,
            briefingCandidateKey: provenance.candidateKeys[inputIndex]!,
            machineAuthor: provenance.machineAuthor,
            createdBy: null,
            approvedBy: null,
          });
          if (input.itemIds?.length) await r.linkItems(row.id, input.itemIds);
          if (input.narrativeIds?.length) await r.linkNarratives(row.id, input.narrativeIds);
          if (input.evidenceIds?.length) await r.linkEvidence(row.id, input.evidenceIds);
          if (input.passages?.length) await r.linkPassages(row.id, input.passages);
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
        if (rows.length > 1 && inputs[0]?.section === "daily_brief") {
          await r.linkRelated(rows[0]!.id, rows.slice(1).map((row) => row.id));
        }
        const published = [...rows];
        await archiveSuperseded(rows);
        await emit(tx as never, TOPICS.publicationCacheInvalidate, { publicIds: rows.map((row) => row.publicId) });
        return published;
      });
    },

    async listPublic(filters: ListPublicPublications): Promise<PublicPublication[]> {
      const rows = await repo(db).listPublic(filters);
      return rows.map(toPublicPublication);
    },

    /** The Daily Brief hub and homepage rails must not inherit historic site
     * reference pages from the shared publication table. */
    async listBriefingPublic(filters: ListPublicPublications): Promise<PublicPublication[]> {
      const rows = await repo(db).listPublic(filters, true);
      return rows.map(toPublicPublication);
    },

    async getPublic(publicId: string): Promise<PublicPublication> {
      const row = await repo(db).byPublicId(publicId);
      if (!row || (row.status !== "published" && row.status !== "updated")) throw notFound("Publication");
      return toPublicPublication(row);
    },

    async getBriefingPublic(publicId: string): Promise<PublicPublication> {
      const row = await repo(db).byPublicId(publicId);
      if (!row || !row.briefingRunId || (row.status !== "published" && row.status !== "updated")) {
        throw notFound("Briefing publication");
      }
      return toPublicPublication(row);
    },

    async getPublicDetail(publicId: string): Promise<PublicPublicationDetail> {
      const row = await repo(db).byPublicId(publicId);
      if (!row || (row.status !== "published" && row.status !== "updated")) throw notFound("Publication");
      return { ...toPublicPublication(row), ...(await repo(db).publicReferences(row.id)) };
    },

    async getBriefingPublicDetail(publicId: string): Promise<PublicPublicationDetail> {
      const row = await repo(db).byPublicId(publicId);
      if (!row || !row.briefingRunId || (row.status !== "published" && row.status !== "updated")) {
        throw notFound("Briefing publication");
      }
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
      const live = (await repo(db).listPublic({ limit: 100 }, true)).filter((row) =>
        row.section === "israel_update" || row.section === "narrative_watch",
      );
      const ordered = features
        .map((feature) => live.find((row) => row.id === feature.publicationId))
        .filter((row): row is Publication => Boolean(row));
      return (ordered.length ? ordered : live.slice(0, 3)).map(toPublicPublication);
    },

    /** Explicit pins, resolved directly rather than inside a latest-100 window. */
    async publicHomepagePins(): Promise<Array<{ slot: number; publication: PublicPublication }>> {
      const pins = await repo(db).homepageFeatures();
      const result: Array<{ slot: number; publication: PublicPublication }> = [];
      for (const pin of pins.sort((a,b)=>a.slot-b.slot)) {
        const row = await repo(db).byId(pin.publicationId);
        if (row && row.briefingRunId && (row.status === "published" || row.status === "updated")
          && ["israel_update", "narrative_watch"].includes(row.section)) {
          result.push({slot:pin.slot, publication:toPublicPublication(row)});
        }
      }
      return result;
    },

    async homepageFeatures(): Promise<Array<{ slot: number; publicationId: string }>> {
      return repo(db).homepageFeatures();
    },

    async setHomepageFeature(slot: number, publicationId: string | null, actor: Actor): Promise<void> {
      if (!Number.isInteger(slot) || slot < 1 || slot > 3) throw new ApiError("VALIDATION_ERROR", "Homepage slot must be 1, 2, or 3.");
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        if (publicationId) {
          const row = await r.byId(publicationId);
          const eligible = row
            && (row.status === "published" || row.status === "updated")
            && row.briefingRunId !== null
            && ["israel_update", "narrative_watch"].includes(row.section);
          if (!eligible) throw new ApiError("VALIDATION_ERROR", "Only a live news publication can occupy a homepage slot.");
        }
        await r.setHomepageFeature(slot, publicationId);
        await emit(tx as never, TOPICS.publicationCacheInvalidate, { homepageSlot: slot, publicationId });
      });
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
        const nextSection = fields.section ?? before.section;
        /* `evidenceBasis` is derived from whether the record cites anything, so
         * it survives every edit rather than being resubmitted. The update
         * contract omits it precisely so a client cannot send one; carry the
         * stored value forward here, defaulting to the strict reading, so an
         * edit can never turn an unsourced analysis into a documented report. */
        const storedBasis = isAnalysisBasis(before.narrativeWatchDetails as { evidenceBasis?: string } | null)
          ? "analysis" as const
          : "sourced" as const;
        const nextNarrativeDetails = fields.narrativeWatchDetails === undefined
          ? before.narrativeWatchDetails
          : fields.narrativeWatchDetails === null
            ? null
            : { ...fields.narrativeWatchDetails, evidenceBasis: storedBasis };
        if ((nextSection === "narrative_watch") !== Boolean(nextNarrativeDetails)) {
          throw new ApiError("VALIDATION_ERROR", "Narrative Watch publications require structured monitoring details, and other sections may not carry them.");
        }
        const after = await r.update(id, {
          ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)),
          ...(fields.narrativeWatchDetails === undefined ? {} : { narrativeWatchDetails: nextNarrativeDetails }),
          updatedAt: new Date(),
        });

        await recordVersion(tx as Tx, publication, after as never, {
          entityType: kindToEntityType(before.kind),
          entityId: id,
          actor,
          changeSummary: changeSummary?.trim() || "Updated publication",
          changeSource: "human_edit",
          requestId,
          before,
        });
        await emit(tx as never, TOPICS.publicationCacheInvalidate, { publicId: after.publicId });

        return after;
      });
    },

    /** Hard deletion is intentionally limited to drafts and already archived
     * records. A live publication must first be archived, while its evidence,
     * versions and audit history remain retained for accountability. */
    async remove(id: string, actor: Actor, requestId?: string): Promise<void> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const before = await r.byId(id);
        if (!before) throw notFound("Publication");
        if (before.status !== "draft" && before.status !== "archived") {
          throw new ApiError("PRECONDITION_FAILED", "Only drafts and archived publications may be permanently deleted. Archive a live publication first.");
        }
        await r.remove(id);
        await writeAudit(tx as never, {
          actor,
          action: "publication.deleted",
          entityType: kindToEntityType(before.kind),
          entityId: id,
          before,
          requestId,
        });
        await emit(tx as never, TOPICS.publicationCacheInvalidate, { publicId: before.publicId });
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
        await emit(tx as never, TOPICS.publicationCacheInvalidate, { publicId: after.publicId });

        return after;
      });
    },
  };
}

function toPublicPublication(row: Publication): PublicPublication {
  if (!row.publishedAt) throw new ApiError("NOT_FOUND", "Publication is not public.");
  const narrativeWatchDetails = publicNarrativeWatchDetails(row.narrativeWatchDetails);
  const title = row.section === "narrative_watch"
    ? narrativeWatchTitle(row.title, narrativeWatchDetails?.evidenceBasis ?? "sourced").slice(0, 300)
    : row.title;
  return {
    publicId: row.publicId,
    kind: row.kind,
    section: row.section,
    title,
    summary: row.summary,
    body: row.body,
    language: row.language,
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    autoPublishedAt: row.autoPublishedAt?.toISOString() ?? null,
    editorialTopic: row.editorialTopic,
    primaryActor: row.primaryActor,
    arena: row.arena,
    featuredIsraelStory: row.featuredIsraelStory,
    narrativeWatchDetails,
  };
}

/**
 * The one place the stored jsonb becomes a public value.
 *
 * This used to be a bare cast, which meant `evidenceBasisSchema`'s
 * `.default("sourced")` never ran on the read path: nothing parses here. Rows
 * written before the field existed — every row migration `0038` backfilled —
 * carry no `evidenceBasis` key at all, so the cast handed callers `undefined`
 * while their types promised a string, and every downstream surface that marks
 * an unsourced record would have silently mislabelled it.
 *
 * Normalised to the strict side on purpose: only a literal `"analysis"` is
 * analysis. An absent, misspelt or unrecognised value reads as `"sourced"`,
 * which is the reading that requires citations rather than the one that
 * excuses their absence.
 */
function publicNarrativeWatchDetails(details: unknown): PublicPublication["narrativeWatchDetails"] {
  if (!details || typeof details !== "object") return null;
  const stored = details as NarrativeWatchDetails;
  return { ...stored, evidenceBasis: isAnalysisBasis(stored) ? "analysis" : "sourced" };
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
