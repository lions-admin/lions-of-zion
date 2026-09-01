import "server-only";

/**
 * Narrative monitoring. Owns policy; owns no SQL.
 *
 * Two things here are worth reading before changing anything:
 *
 *   - **An observation cannot be recorded without evidence.** The column is
 *     NOT NULL, so this is really the database's rule; the service refuses
 *     first only to return a sentence instead of a constraint violation.
 *   - **The reading of the amplification figure lives in the contracts**
 *     (`readActivity`), not here and not in the client. One threshold, stated
 *     once, so no surface invents its own.
 */

import { ApiError, notFound } from "@/server/http/responses";
import { recordVersion, setIdentity } from "@/server/core/versioning";
import { writeAudit } from "@/server/core/audit";
import { actor, narrative } from "@/server/db/schema";
import { narrativeRepo } from "./repo";
import { readActivity } from "@/server/contracts/narrative";
import type {
  CreateActor,
  CreateNarrative,
  LinkNarrativeItem,
  ListActors,
  ListNarratives,
  MonitoringWindow,
  NarrativeActivity,
  RecordObservation,
  TransitionNarrative,
} from "@/server/contracts/narrative";
import type { Actor as ActorRow, Narrative, NarrativeObservation } from "@/server/db/schema";
import type { Actor } from "@/server/core/audit";

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

const num = (v: unknown): number => Number(v ?? 0);

export function narrativeService(db: unknown) {
  const run = db as unknown as Runner;
  const repo = narrativeRepo(db);

  return {
    /* ── actors ─────────────────────────────────────────────────────────── */

    listActors: (filters: ListActors) => repo.listActors(filters),

    async createActor(input: CreateActor, who: Actor, requestId?: string): Promise<ActorRow> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, who.label);
        const r = narrativeRepo(tx);
        const row = await r.insertActor({
          publicId: input.slug,
          kind: input.kind,
          name: input.name,
          aliases: input.aliases,
          country: input.country ?? null,
          platformHandles: input.platformHandles ?? null,
          description: input.description ?? null,
          dataClass: input.dataClass,
        });
        await recordVersion(tx as Tx, actor, row as never, {
          entityType: "actor",
          entityId: row.id,
          actor: who,
          changeSummary: `Actor registered (${input.kind})`,
          changeSource: "human_edit",
          requestId,
        });
        return row;
      });
    },

    /* ── narratives ─────────────────────────────────────────────────────── */

    listNarratives: (filters: ListNarratives) => repo.listNarratives(filters),

    async getNarrative(id: string): Promise<Narrative> {
      const row = await repo.narrativeById(id);
      if (!row) throw notFound("Narrative");
      return row;
    },

    /** A narrative plus what composes it and who has been pushing it. */
    async narrativeDetail(id: string, hours = 24 * 30) {
      const row = await repo.narrativeById(id);
      if (!row) throw notFound("Narrative");
      const since = new Date(Date.now() - hours * 3_600_000);
      return {
        narrative: row,
        items: await repo.itemsFor(id),
        actors: await repo.actorsFor(id, since),
      };
    },

    async createNarrative(input: CreateNarrative, who: Actor, requestId?: string): Promise<Narrative> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, who.label);
        const r = narrativeRepo(tx);
        const row = await r.insertNarrative({
          publicId: input.slug,
          title: input.title,
          summary: input.summary ?? null,
          language: input.language,
          primaryTopicId: input.primaryTopicId ?? null,
          eventId: input.eventId ?? null,
        });
        await recordVersion(tx as Tx, narrative, row as never, {
          entityType: "narrative",
          entityId: row.id,
          actor: who,
          changeSummary: "Narrative opened",
          changeSource: "human_edit",
          requestId,
        });
        return row;
      });
    },

    /** Opens an evidence-backed monitoring record from the scheduled brief.
     * It is a reusable grouping key, never a verdict about the narrative. */
    async autoCreateNarrative(input: CreateNarrative, who: Actor, requestId?: string): Promise<Narrative> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, who.label);
        const r = narrativeRepo(tx);
        const existing = await r.narrativeByTitle(input.title);
        if (existing) {
          const updated = await r.updateNarrative(existing.id, {
            summary: input.summary ?? existing.summary,
            status: existing.status === "retired" ? "emerging" : existing.status,
            updatedAt: new Date(),
          });
          await recordVersion(tx as Tx, narrative, updated as never, {
            entityType: "narrative", entityId: updated.id, actor: who,
            changeSummary: "Automatically refreshed recurring briefing narrative",
            changeSource: "workflow", requestId, before: existing,
          });
          return updated;
        }
        const row = await r.insertNarrative({
          publicId: input.slug,
          title: input.title,
          summary: input.summary ?? null,
          language: input.language,
          primaryTopicId: input.primaryTopicId ?? null,
          eventId: input.eventId ?? null,
        });
        await recordVersion(tx as Tx, narrative, row as never, {
          entityType: "narrative",
          entityId: row.id,
          actor: who,
          changeSummary: "Automatically opened briefing narrative",
          changeSource: "workflow",
          requestId,
        });
        return row;
      });
    },

    async transition(
      id: string,
      input: TransitionNarrative,
      who: Actor,
      requestId?: string,
    ): Promise<Narrative> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, who.label);
        const r = narrativeRepo(tx);
        const before = await r.narrativeById(id);
        if (!before) throw notFound("Narrative");
        if (before.status === input.to) return before;

        const after = await r.updateNarrative(id, { status: input.to, updatedAt: new Date() });
        await recordVersion(tx as Tx, narrative, after as never, {
          entityType: "narrative",
          entityId: id,
          actor: who,
          changeSummary: `Status ${before.status} → ${input.to}`,
          changeSource: "human_edit",
          requestId,
          before,
        });
        return after;
      });
    },

    async linkItem(id: string, input: LinkNarrativeItem, who: Actor): Promise<void> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, who.label);
        const r = narrativeRepo(tx);
        if (!(await r.narrativeById(id))) throw notFound("Narrative");
        await r.linkItem({
          narrativeId: id,
          itemId: input.itemId,
          rationale: input.rationale,
          addedBy: who.userId ?? null,
        });
        await writeAudit(tx as never, {
          actor: who,
          action: "narrative_item.linked",
          entityType: "narrative",
          entityId: id,
          after: { itemId: input.itemId },
        });
      });
    },

    /* ── observations ───────────────────────────────────────────────────── */

    /**
     * Records one sighting.
     *
     * The evidence is not optional and never will be. Everything downstream —
     * the family count, the amplification reading, any future alert — is only
     * as trustworthy as the fact that each row points at something someone
     * can go and look at.
     */
    async observe(
      id: string,
      input: RecordObservation,
      who: Actor,
    ): Promise<NarrativeObservation> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, who.label);
        const r = narrativeRepo(tx);
        if (!(await r.narrativeById(id))) throw notFound("Narrative");

        if (input.actorId && !(await r.actorById(input.actorId))) {
          throw new ApiError("VALIDATION_ERROR", "That actor does not exist.");
        }

        return r.insertObservation({
          narrativeId: id,
          actorId: input.actorId ?? null,
          evidenceId: input.evidenceId,
          observedAt: input.observedAt ? new Date(input.observedAt) : new Date(),
          platform: input.platform ?? null,
          reportedReach: input.reportedReach ?? null,
          note: input.note ?? null,
        });
      });
    },

    /* ── the monitoring answer ──────────────────────────────────────────── */

    /**
     * What is circulating now, and whether it is travelling or being pushed.
     *
     * This is the endpoint Phase 9 is measured by. The counting rule — that
     * independence is measured in source families, not accounts — lives in
     * `narrative_activity()`, and the reading of the resulting ratio lives in
     * `readActivity()`. Neither is restated here.
     */
    async now(window: MonitoringWindow): Promise<{
      since: string;
      windowHours: number;
      narratives: NarrativeActivity[];
    }> {
      const since = new Date(Date.now() - window.hours * 3_600_000);
      const rows = await repo.activity(since, window.limit);

      return {
        since: since.toISOString(),
        windowHours: window.hours,
        narratives: rows.map((r) => {
          const distinctActors = num(r.distinct_actors);
          const distinctFamilies = num(r.distinct_families);
          return {
            narrativeId: String(r.narrative_id),
            publicId: String(r.public_id),
            title: String(r.title),
            status: r.status as NarrativeActivity["status"],
            observations: num(r.observations),
            distinctActors,
            distinctFamilies,
            amplification: r.amplification === null ? null : Number(r.amplification),
            reportedReach: num(r.reported_reach),
            linkedItems: num(r.linked_items),
            itemsFoundProblematic: num(r.items_found_problematic),
            lastSeen: new Date(r.last_seen as string).toISOString(),
            reading: readActivity(distinctActors, distinctFamilies),
          };
        }),
      };
    },
  };
}

export type NarrativeService = ReturnType<typeof narrativeService>;
