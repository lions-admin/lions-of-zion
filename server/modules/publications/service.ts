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
import { publication } from "@/server/db/schema";
import type { EditorialOperation } from "@/server/contracts/editorial-update";
import type { EditorialMediaDraft } from "@/server/modules/media/repo";
import { mediaRepo, toEditorialMedia } from "@/server/modules/media/repo";
import { isArticleSafeMedia, isHomepageSafeMedia, type EditorialMedia } from "@/server/contracts/editorial-media";
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
import type { PublicationSection } from "@/server/contracts/enums";
import { emit, TOPICS } from "@/server/core/outbox";
import { publicationHomepageSection } from "@/lib/publication-routing";

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

const HOMEPAGE_PLACEMENT_AREAS = ["news", "fakeResistance", "people"] as const;
const HOMEPAGE_PLACEMENT_POSITIONS = ["lead", "secondary"] as const;
type HomepagePlacementArea = typeof HOMEPAGE_PLACEMENT_AREAS[number];
type HomepagePlacementPosition = typeof HOMEPAGE_PLACEMENT_POSITIONS[number];
function isHomepagePlacementArea(area: string): area is HomepagePlacementArea {
  return (HOMEPAGE_PLACEMENT_AREAS as readonly string[]).includes(area);
}
function belongsToHomepageArea(section: PublicationSection, area: HomepagePlacementArea): boolean {
  return publicationHomepageSection(section) === area;
}


export function publicationService(db: unknown) {
  const run = db as unknown as Runner;

  return {
    /** Invoked inside the editorial operation transaction; no network calls.
     * `media` is optional — matching the rule the external-briefing path
     * already lives by (`docs`/commit "Let a publication lose its picture
     * without losing the page"): an illustration is enrichment, never the
     * record, so a publication with no rights-cleared image still publishes
     * with no picture rather than blocking the whole run. */
    async applyEditorial(operation: EditorialOperation, provenance: { runId: string; machineAuthor: string },
      media: EditorialMediaDraft | null, actor: Actor, requestId?: string): Promise<Publication> {
      return run.transaction(async tx => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const store = mediaRepo(tx);
        let assetId: string | null = null;
        if (media) {
          const asset = await store.insertMedia(media);
          const projected = toEditorialMedia(asset);
          if (!projected || !isArticleSafeMedia(projected)) {
            throw new ApiError('VALIDATION_ERROR', 'The publication requires a cleared article image.');
          }
          assetId = asset.id;
        }
        let row: Publication;
        let before: Publication | undefined;
        const now = new Date();
        if (operation.action === 'create') {
          const input = operation.publication;
          row = await r.insert({
            kind: input.kind, section: input.section ?? 'news',
            publicId: await uniquePublicId(r, input.title), title: input.title,
            canonicalStoryId: input.canonicalStoryId ?? null,
            summary: input.summary ?? null, body: input.body, language: input.language,
            eventId: input.eventId ?? null, primaryTopicId: input.primaryTopicId ?? null,
            editorialTopic: input.editorialTopic ?? null, topicTags: input.topicTags ?? [], primaryActor: input.primaryActor ?? null,
            arena: input.arena ?? null, featuredIsraelStory: input.featuredIsraelStory ?? false,
            narrativeWatchDetails: input.narrativeWatchDetails ? {
              ...input.narrativeWatchDetails, evidenceBasis: input.evidenceIds?.length ? 'sourced' : 'analysis',
            } : null,
            scenarioLikelihood: input.scenarioLikelihood ?? null, scenarioIndicators: input.scenarioIndicators ?? null,
            status: 'published', publishedAt: now, autoPublishedAt: now,
            editorialRunId: provenance.runId, editorialOperationKey: operation.key,
            machineAuthor: provenance.machineAuthor, createdBy: null, approvedBy: null,
          });
          if (input.itemIds?.length) await r.linkItems(row.id, input.itemIds);
          if (input.narrativeIds?.length) await r.linkNarratives(row.id, input.narrativeIds);
          if (input.evidenceIds?.length) await r.linkEvidence(row.id, input.evidenceIds);
          if (input.passages?.length) await r.linkPassages(row.id, input.passages);
        } else {
          const byId = operation.publicationId ? await r.byId(operation.publicationId) : undefined;
          const byPublicId = operation.target?.publicId ? await r.byPublicId(operation.target.publicId) : undefined;
          const byCanonicalStoryId = operation.target?.canonicalStoryId
            ? await r.byCanonicalStoryId(operation.target.canonicalStoryId)
            : undefined;
          const targetCount = Number(Boolean(operation.publicationId)) + Number(Boolean(operation.target?.publicId))
            + Number(Boolean(operation.target?.canonicalStoryId));
          const candidates = [byId, byPublicId, byCanonicalStoryId].filter((row): row is Publication => Boolean(row));
          if (!candidates.length) throw notFound('Publication');
          if (candidates.length !== targetCount || new Set(candidates.map(row => row.id)).size !== 1) {
            throw new ApiError('CONFLICT', 'The supplied publication identifiers resolve to different publications.');
          }
          await r.lock(candidates[0]!.id);
          before = await r.byId(candidates[0]!.id);
          if (!before) throw notFound('Publication');
          if (!['published', 'updated'].includes(before.status)) {
            throw new ApiError('CONFLICT', 'Developing-story updates require a live canonical publication.');
          }
          const fields = Object.fromEntries(Object.entries(operation.publication).filter(([key]) => key !== 'changeSummary')) as Omit<UpdatePublication, 'changeSummary'>;
          const section = fields.section ?? before.section;
          const details = fields.narrativeWatchDetails === undefined ? before.narrativeWatchDetails
            : fields.narrativeWatchDetails === null ? null : { ...fields.narrativeWatchDetails,
              evidenceBasis: isAnalysisBasis(before.narrativeWatchDetails as { evidenceBasis?: string } | null) ? 'analysis' : 'sourced' };
          if ((section === 'narrative_watch') !== Boolean(details)) {
            throw new ApiError('VALIDATION_ERROR', 'Narrative Watch details must match the publication section.');
          }
          row = await r.update(before.id, {
            ...fields,
            narrativeWatchDetails: details,
            status: 'updated',
            updatedAt: now,
            editorialRunId: provenance.runId,
            editorialOperationKey: operation.key,
            machineAuthor: provenance.machineAuthor,
          });
          /* Only replace the existing picture when this update actually
             brought a new one — an update with no media keeps whatever the
             publication already had rather than stripping it. */
          if (assetId) await store.detach(row.id);
        }
        if (assetId) await store.attachToPublication(row.id, assetId);
        const versionSnapshot = operation.action === 'update'
          ? { ...row, editorialUpdateRunId: provenance.runId, editorialOperationKey: operation.key }
          : row;
        await recordVersion(tx as Tx, publication, versionSnapshot as never, {
          entityType: kindToEntityType(row.kind), entityId: row.id, actor, before,
          changeSummary: operation.action === 'update' ? operation.publication.changeSummary : 'Published by the whole-site editorial run',
          changeSource: 'workflow', requestId,
        });
        await emit(tx as never, TOPICS.publicationCacheInvalidate, { publicId: row.publicId });
        return row;
      });
    },

    async get(id: string): Promise<Publication> {
      const row = await repo(db).byId(id);
      if (!row) throw notFound("Publication");
      return row;
    },

    async resolveEditorialTarget(target: { publicId?: string; canonicalStoryId?: string }): Promise<Publication> {
      const [byPublicId, byCanonicalStoryId] = await Promise.all([
        target.publicId ? repo(db).byPublicId(target.publicId) : undefined,
        target.canonicalStoryId ? repo(db).byCanonicalStoryId(target.canonicalStoryId) : undefined,
      ]);
      const rows = [byPublicId, byCanonicalStoryId].filter((row): row is Publication => Boolean(row));
      if (!rows.length) throw notFound("Publication");
      const targetCount = Number(Boolean(target.publicId)) + Number(Boolean(target.canonicalStoryId));
      if (rows.length !== targetCount || new Set(rows.map(row => row.id)).size !== 1) {
        throw new ApiError("CONFLICT", "The supplied publication identifiers resolve to different publications.");
      }
      return rows[0]!;
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
          canonicalStoryId: input.canonicalStoryId ?? null,
          title: input.title,
          summary: input.summary ?? null,
          body: input.body,
          language: input.language,
          eventId: input.eventId ?? null,
          primaryTopicId: input.primaryTopicId ?? null,
          editorialTopic: input.editorialTopic ?? null,
          topicTags: input.topicTags ?? [],
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
            canonicalStoryId: input.canonicalStoryId ?? null,
            title: input.title,
            summary: input.summary ?? null,
            body: input.body,
            language: input.language,
            eventId: input.eventId ?? null,
            primaryTopicId: input.primaryTopicId ?? null,
            editorialTopic: input.editorialTopic ?? null,
            topicTags: input.topicTags ?? [],
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
          canonicalStoryId: input.canonicalStoryId ?? null,
          title: input.title,
          summary: input.summary ?? null,
          body: input.body,
          language: input.language,
          eventId: input.eventId ?? null,
          primaryTopicId: input.primaryTopicId ?? null,
          editorialTopic: input.editorialTopic ?? null,
          topicTags: input.topicTags ?? [],
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
          for (const draft of ordered) {
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
            canonicalStoryId: input.canonicalStoryId ?? null,
            title: input.title,
            summary: input.summary ?? null,
            body: input.body,
            language: input.language,
            eventId: input.eventId ?? null,
            primaryTopicId: input.primaryTopicId ?? null,
            editorialTopic: input.editorialTopic ?? null,
            topicTags: input.topicTags ?? [],
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
      return withHeroMedia(db, await repo(db).listPublic(filters));
    },

    /** The Daily Brief hub and homepage rails must not inherit historic site
     * reference pages from the shared publication table. */
    async listBriefingPublic(filters: ListPublicPublications): Promise<PublicPublication[]> {
      return withHeroMedia(db, await repo(db).listPublic(filters, true));
    },

    async getPublic(publicId: string): Promise<PublicPublication> {
      const row = await repo(db).byPublicId(publicId);
      if (!row || (row.status !== "published" && row.status !== "updated")) throw notFound("Publication");
      return toPublicPublication(row, await mediaRepo(db).heroMedia(row.id));
    },

    async getBriefingPublic(publicId: string): Promise<PublicPublication> {
      const row = await repo(db).byPublicId(publicId);
      if (!row || (!row.briefingRunId && !row.editorialRunId) || (row.status !== "published" && row.status !== "updated")) {
        throw notFound("Briefing publication");
      }
      return toPublicPublication(row, await mediaRepo(db).heroMedia(row.id));
    },

    async getPublicDetail(publicId: string): Promise<PublicPublicationDetail> {
      const row = await repo(db).byPublicId(publicId);
      if (!row || (row.status !== "published" && row.status !== "updated")) throw notFound("Publication");
      const [media, references] = await Promise.all([mediaRepo(db).heroMedia(row.id), repo(db).publicReferences(row.id)]);
      return { ...toPublicPublication(row, media), ...references };
    },

    async getBriefingPublicDetail(publicId: string): Promise<PublicPublicationDetail> {
      const row = await repo(db).byPublicId(publicId);
      if (!row || (!row.briefingRunId && !row.editorialRunId) || (row.status !== "published" && row.status !== "updated")) {
        throw notFound("Briefing publication");
      }
      const [media, references] = await Promise.all([mediaRepo(db).heroMedia(row.id), repo(db).publicReferences(row.id)]);
      return { ...toPublicPublication(row, media), ...references };
    },

    async featured(): Promise<PublicPublication[]> {
      const placements = await repo(db).homepagePlacements();
      const live = (await repo(db).listPublic({ limit: 100 }, true)).filter((row) =>
        isHomepagePlacementArea(publicationHomepageSection(row.section)),
      );
      const order = (value: { area: string; position: string }) =>
        HOMEPAGE_PLACEMENT_AREAS.indexOf(value.area as HomepagePlacementArea) * 2
        + HOMEPAGE_PLACEMENT_POSITIONS.indexOf(value.position as HomepagePlacementPosition);
      const ordered = placements.sort((a, b) => order(a) - order(b))
        .map((placement) => live.find((row) => row.id === placement.publicationId))
        .filter((row): row is Publication => Boolean(row));
      return withHeroMedia(db, ordered.length ? ordered : live.slice(0, 3));
    },

    /** Explicit placements are resolved outside the automatic latest-100 window. */
    async publicHomepagePins(): Promise<Array<{ area: HomepagePlacementArea; position: HomepagePlacementPosition; publication: PublicPublication }>> {
      const placements = await repo(db).homepagePlacements();
      const rows: Array<{ area: HomepagePlacementArea; position: HomepagePlacementPosition; row: Publication }> = [];
      for (const placement of placements) {
        if (!isHomepagePlacementArea(placement.area) || !(HOMEPAGE_PLACEMENT_POSITIONS as readonly string[]).includes(placement.position)) continue;
        const row = await repo(db).byId(placement.publicationId);
        if (row && (row.briefingRunId || row.editorialRunId) && (row.status === "published" || row.status === "updated")
          && belongsToHomepageArea(row.section, placement.area)) {
          rows.push({ area: placement.area, position: placement.position as HomepagePlacementPosition, row });
        }
      }
      const media = await mediaRepo(db).heroMediaByPublicationIds(rows.map((pin) => pin.row.id));
      return rows.map((pin) => ({ area: pin.area, position: pin.position, publication: toPublicPublication(pin.row, media.get(pin.row.id) ?? null) }));
    },

    async homepagePlacements(): Promise<Array<{ area: HomepagePlacementArea; position: HomepagePlacementPosition; publicationId: string }>> {
      const placements = await repo(db).homepagePlacements();
      return placements.filter((placement): placement is { area: HomepagePlacementArea; position: HomepagePlacementPosition; publicationId: string } =>
        isHomepagePlacementArea(placement.area) && (HOMEPAGE_PLACEMENT_POSITIONS as readonly string[]).includes(placement.position),
      ).map(placement => ({ ...placement, position: placement.position as HomepagePlacementPosition }));
    },

    async setHomepagePlacement(area: HomepagePlacementArea, position: HomepagePlacementPosition, publicationId: string | null, actor: Actor): Promise<void> {
      if (!isHomepagePlacementArea(area) || !(HOMEPAGE_PLACEMENT_POSITIONS as readonly string[]).includes(position)) {
        throw new ApiError("VALIDATION_ERROR", "Homepage placement must name a supported area and position.");
      }
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        if (publicationId) {
          const row = await r.byId(publicationId);
          const eligible = row
            && (row.status === "published" || row.status === "updated")
            && (row.briefingRunId !== null || row.editorialRunId !== null)
            && belongsToHomepageArea(row.section, area);
          if (!eligible) throw new ApiError("VALIDATION_ERROR", "Only a live editorial publication from the matching homepage area can occupy this placement.");
          /* The homepage composer admits only records whose hero is cleared
           * for the homepage surface (`homepageInputs` → `isHomepageSafeMedia`),
           * and `selectHomepage` falls through to its automatic pick when a
           * placement names a record it never admitted. Storing such a
           * placement therefore did nothing, silently: three runs on
           * 2026-09-07 reported `failed=0` while every slot they had asked
           * for kept its automatic occupant, because none of the records
           * carried a picture. Refusing here turns that into a reported
           * reason the composer can act on — attach a homepage-cleared
           * image — rather than a success that did not happen. */
          const hero = (await mediaRepo(tx).heroMediaByPublicationIds([publicationId])).get(publicationId);
          if (!hero || !isHomepageSafeMedia(hero)) {
            throw new ApiError(
              "VALIDATION_ERROR",
              "A homepage placement needs a hero image cleared for the homepage surface; this publication has none, so the slot would keep its automatic pick and the placement would do nothing. Attach a cleared image (rights.surfaces including \"homepage\") and place it again.",
            );
          }
        }
        await r.setHomepagePlacement(area, position, publicationId);
        await emit(tx as never, TOPICS.publicationCacheInvalidate, { homepagePlacement: { area, position }, publicationId });
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

/**
 * Every list projection resolves its hero images in one query.
 *
 * A per-row read here would be N+1 on the news hub and on the homepage's own
 * resolution pass, and the reason it goes through a single helper rather than
 * being inlined per read path is that the list and the detail must agree: a
 * card that leads with a picture the article page then drops is the failure
 * this shape exists to prevent.
 */
async function withHeroMedia(db: unknown, rows: Publication[]): Promise<PublicPublication[]> {
  const media = await mediaRepo(db).heroMediaByPublicationIds(rows.map((row) => row.id));
  return rows.map((row) => toPublicPublication(row, media.get(row.id) ?? null));
}

/**
 * `media` is a required argument, never defaulted: a caller that forgets it
 * would silently serve an image-less projection, which reads as "this record
 * has no picture" rather than as the bug it is.
 *
 * The surface filter is the *article* bar. `app_public`'s RLS policy has
 * already hidden anything not cleared — that is the boundary a future read
 * path cannot forget — and this is the second, surface-level pass. It is
 * deliberately not the homepage bar: the homepage applies
 * `isHomepageSafeMedia` to this same value, and filtering to the stricter
 * standard here would strip a picture the article page is entitled to show.
 */
function toPublicPublication(row: Publication, media: EditorialMedia | null): PublicPublication {
  if (!row.publishedAt) throw new ApiError("NOT_FOUND", "Publication is not public.");
  const narrativeWatchDetails = publicNarrativeWatchDetails(row.narrativeWatchDetails);
  const title = row.section === "narrative_watch"
    ? narrativeWatchTitle(row.title, narrativeWatchDetails?.evidenceBasis ?? "sourced").slice(0, 300)
    : row.title;
  return {
    publicId: row.publicId,
    canonicalStoryId: row.canonicalStoryId,
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
    topicTags: row.topicTags,
    primaryActor: row.primaryActor,
    arena: row.arena,
    featuredIsraelStory: row.featuredIsraelStory,
    narrativeWatchDetails,
    media: media && isArticleSafeMedia(media) ? media : null,
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
