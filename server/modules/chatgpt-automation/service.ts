import "server-only";

/**
 * The scheduled ChatGPT editor's read/control adapter.
 *
 * A thin, typed layer over services that already exist. It owns no business
 * logic: every read is an `adminConsole()` or `publications()` call, and every
 * action is dispatched through the ops registry's own tool definition, using
 * that definition's zod schema and its `run`. Two implementations of "what
 * `resolve_alert` does" is the outcome this file exists to prevent.
 *
 * What it deliberately does **not** do is call a model. The ops console's
 * `turn()` asks a model to choose tools; here ChatGPT is the model and has
 * already chosen. So this consumes `OPS_TOOL_DEFINITIONS` directly and never
 * touches `generateWithTools` — no gateway, no cost, no transcript.
 *
 * Both the HTTP routes and any future MCP adapter go through this object, so
 * the capability surface is defined once.
 */

import type { Database } from "@/server/db/client";
import { writeAudit } from "@/server/core/audit";
import { setIdentity } from "@/server/core/versioning";
import { ApiError } from "@/server/http/responses";
import { adminConsole } from "@/server/modules/admin-console";
import { editorialUpdateService } from "@/server/modules/editorial-update/service";
import { homepageService } from "@/server/modules/homepage/service";
import { publicationService } from "@/server/modules/publications/service";
/* The registry and its context type directly, not the module index: the
   index also binds the AI gateway and the deep-health probe, which this
   adapter never uses and a test should not have to stand up. */
import { opsTool } from "@/server/modules/ops-agent/tools";
import type { OpsToolContext } from "@/server/modules/ops-agent/context";
import { israelEditionDate } from "@/server/contracts/homepage";
import { publicationHref, routePublication } from "@/lib/publication-routing";
import {
  CHATGPT_ACTOR_LABEL,
  CHATGPT_SUBSTITUTED_TOOLS,
  type ChatgptActionResult,
  type ChatgptContextExtra,
  type ChatgptEditorialContext,
  type ChatgptOpsView,
  type ChatgptPublicationSummary,
} from "@/server/contracts/chatgpt-automation";
import type { OpsTool } from "@/server/contracts/admin-console";
import type { Actor } from "@/server/core/audit";
import type { PublicationSection } from "@/server/contracts/enums";

const ACTOR: Actor = { label: CHATGPT_ACTOR_LABEL, userId: null };

/** The error class only — the message can echo the caller's own input back. */
function errorClass(cause: unknown): string {
  return cause instanceof ApiError ? cause.code : cause instanceof Error ? cause.name : "UnknownError";
}

/**
 * One audit row per call, reads included.
 *
 * The action prefix is `chatgpt.tool.` rather than the console's `ops.tool.`,
 * so the three ways this system changes — a human at the console, this
 * automation, and an editorial package — are three greps rather than one
 * ambiguous label. Written in its own transaction after the fact, like the
 * console's own audit flush, so a failed action is still recorded.
 */
async function record(
  database: Database,
  input: { tool: OpsTool; ranAs: OpsTool; args: unknown; requestId?: string; ok: boolean; detail: unknown },
): Promise<void> {
  const definition = opsTool(input.ranAs);
  await database.transaction(async tx => {
    await setIdentity(tx as never, ACTOR.label);
    await writeAudit(tx as never, {
      actor: ACTOR,
      action: `chatgpt.tool.${input.tool}${input.ok ? "" : ".failed"}`,
      entityType: definition?.entityType ?? "system",
      entityId: definition?.entityId(input.args as Record<string, unknown>) ?? null,
      before: input.args,
      after: input.detail,
      requestId: input.requestId ?? null,
    });
  });
}

export function chatgptAutomationService(database: Database, context: OpsToolContext) {
  return {
    /**
     * Audit the one MCP-native write that is not an ops-registry action.
     * The temporary download URL is intentionally absent from the input: it
     * may carry a signed bearer and has no durable value after the upload.
     */
    async recordGeneratedMediaUpload(
      input: { runId: string; operationKey: string; fileId: string; fileName?: string; mimeType?: string },
      detail: unknown,
      requestId: string,
      ok: boolean,
    ): Promise<void> {
      await database.transaction(async tx => {
        await setIdentity(tx as never, ACTOR.label);
        await writeAudit(tx as never, {
          actor: ACTOR,
          action: `chatgpt.tool.upload_generated_editorial_image${ok ? "" : ".failed"}`,
          entityType: "system",
          entityId: null,
          before: input,
          after: detail,
          requestId,
        });
      });
    },

    /**
     * Run one tool as the automation.
     *
     * `delete_publication` is the single substitution: it runs the archive tool
     * instead, and says so in the result rather than pretending. Everything
     * else runs its own definition. The audit row records the tool that was
     * asked for; the result records what actually ran.
     */
    async invoke(tool: OpsTool, args: Record<string, unknown>, requestId?: string): Promise<ChatgptActionResult> {
      const substitute = (CHATGPT_SUBSTITUTED_TOOLS as Partial<Record<OpsTool, OpsTool>>)[tool];
      const ranAs = substitute ?? tool;
      const definition = opsTool(ranAs);
      if (!definition) throw new ApiError("VALIDATION_ERROR", `No such operation: "${tool}".`);

      const parsed = definition.input.safeParse(args);
      if (!parsed.success) {
        throw new ApiError("VALIDATION_ERROR", `Invalid arguments for "${tool}".`,
          parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })));
      }

      try {
        const result = await definition.run(context, parsed.data as Record<string, unknown>, ACTOR, requestId);
        const outcome: ChatgptActionResult = {
          tool,
          ranAs: substitute ? ranAs : null,
          substitutionNote: substitute
            ? "Archived rather than deleted. Archival is reversible and deletion is not, so an unattended run performs the recoverable half and reports it."
            : null,
          summary: definition.summarise(result),
          result,
        };
        await record(database, { tool, ranAs, args: parsed.data, requestId, ok: true, detail: { summary: outcome.summary } });
        return outcome;
      } catch (cause) {
        await record(database, { tool, ranAs, args: parsed.data, requestId, ok: false, detail: { error: errorClass(cause) } });
        throw cause;
      }
    },

    /**
     * One record, by whichever identifier the caller holds.
     *
     * The ops registry's `get_publication` takes an internal uuid, which a
     * model working from the open web never has — it knows a `publicId` from a
     * URL, or a `canonicalStoryId` from a previous run. Both resolve here, and
     * a miss is an explicit null rather than an empty result that would read
     * as "safe to create".
     */
    async findPublication(identifier: string) {
      const store = publicationService(database);
      /* Only a genuine miss becomes null. A swallowed infrastructure error
         would answer "this story does not exist" when the truth is "the
         database could not be asked" — and the caller's next move on that
         answer is to publish a duplicate. Caught live against a Preview
         database that was behind on migrations, which reported every lookup
         as a miss. */
      const resolve = async (target: { publicId?: string; canonicalStoryId?: string }) => {
        try {
          return await store.resolveEditorialTarget(target);
        } catch (cause) {
          if (cause instanceof ApiError && cause.code === "NOT_FOUND") return null;
          throw cause;
        }
      };
      const found = await resolve({ publicId: identifier })
        ?? await resolve({ canonicalStoryId: identifier });
      if (!found) return null;
      const [summary] = await Promise.all([store.editorialSummaryByPublicIds([found.publicId])]);
      /* Absent for a record that is not live — that is a fact about the
         record, not a failure, so it is the one catch that stays broad-ish.
         An infrastructure error still propagates. */
      const detail = await store.getBriefingPublicDetail(found.publicId).catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.code === "NOT_FOUND") return null;
        throw cause;
      });
      return {
        publicId: found.publicId,
        canonicalStoryId: found.canonicalStoryId,
        section: found.section,
        hub: routePublication(found.section).hub,
        kind: found.kind,
        title: found.title,
        status: summary.get(found.publicId)?.status ?? found.status,
        url: publicationHref(found.publicId),
        publishedAt: found.publishedAt?.toISOString() ?? null,
        updatedAt: found.updatedAt?.toISOString() ?? null,
        /* The public detail carries the source stack, the hero and the
           correction history; it is absent for a record that is not live. */
        detail,
      };
    },

    /** The homepage as it currently stands: the edition and its placements. */
    async homepage() {
      const [edition, pins] = await Promise.all([
        homepageService(database).read().catch(() => null),
        publicationService(database).publicHomepagePins(),
      ]);
      return {
        edition: edition
          ? { editionDate: edition.editionDate, revision: edition.revision, generatedAt: edition.generatedAt }
          : null,
        placements: pins.map(pin => ({
          area: pin.area,
          position: pin.position,
          publicId: pin.publication.publicId,
          title: pin.publication.title,
          section: pin.publication.section,
          hasMedia: Boolean(pin.publication.media),
          publishedAt: pin.publication.publishedAt,
          url: publicationHref(pin.publication.publicId),
        })),
      };
    },

    /** Recent durable runs, newest first. */
    async editorialRuns() {
      const runs = await editorialUpdateService(database).listRecent();
      return runs.map(run => ({
        runKey: run.runKey, status: run.status, stage: run.stage,
        createdAt: run.createdAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      }));
    },

    /**
     * One run in full, with the v2 split the report was built to carry.
     *
     * `research` and `vetoes` exist only for a `whole-site-update-v2` package.
     * They are reported as null rather than as empty arrays for a v1 run,
     * because "this contract could not represent an editorial refusal" and
     * "the editor refused nothing" are different facts, and conflating them is
     * exactly the ambiguity v2 was added to remove.
     */
    async editorialRun(runKey: string) {
      const run = await editorialUpdateService(database).getByRunKey(runKey).catch(() => null);
      if (!run) return null;
      const report = (run.report ?? {}) as Record<string, unknown>;
      const isV2 = (run.request?.delivery?.contractVersion ?? null) === "whole-site-update-v2";
      return {
        runKey: run.runKey,
        status: run.status,
        stage: run.stage,
        contractVersion: run.request?.delivery?.contractVersion ?? null,
        createdAt: run.createdAt.toISOString(),
        startedAt: run.startedAt?.toISOString() ?? null,
        finishedAt: run.finishedAt?.toISOString() ?? null,
        publications: report.publications ?? null,
        byCategory: report.byCategory ?? null,
        urls: report.urls ?? [],
        homepage: report.homepage ?? null,
        media: report.media ?? null,
        mediaWarnings: report.mediaWarnings ?? [],
        siteRecommendations: report.siteRecommendations ?? [],
        /* Editorial decisions. */
        research: isV2 ? (report.research ?? []) : null,
        vetoes: isV2 ? (report.vetoes ?? []) : null,
        /* The editor's cover review. Null for v1 (unrepresentable) and null
           for a v2 run that omitted it (the manual says it should not). */
        homepageReview: isV2 ? (report.homepageReview ?? null) : null,
        /* Faults. Kept apart from the two above on purpose. */
        errors: report.errors ?? [],
        failure: run.failure ?? null,
        operations: run.operations.map(operation => ({
          key: operation.operationKey, status: operation.status, stage: operation.stage,
          result: operation.result ?? null, failure: operation.failure ?? null,
        })),
      };
    },

    /** One console read, by allowlisted name. Reads only — see the view list. */
    async opsView(view: ChatgptOpsView, request?: Request): Promise<unknown> {
      const console_ = adminConsole();
      switch (view) {
        case "overview": return console_.overview();
        case "pipeline": return console_.pipeline();
        case "editorial": return console_.editorial();
        case "sources": return console_.sources();
        case "narratives": return console_.narratives();
        case "incidents": return console_.incidents();
        case "settings": return console_.settings();
        case "security": return console_.security(request);
        case "system-internals": return console_.systemInternals();
      }
    },

    /**
     * Everything one scheduled run needs before it decides, in one call.
     *
     * Bounded on purpose. The console's `incidents()` fans out to eight queries
     * and `costs()` to six, so neither is in the default payload — a run that
     * wants them asks for them.
     */
    async editorialContext(
      options: { limit: number; include: ChatgptContextExtra[] },
      request?: Request,
    ): Promise<ChatgptEditorialContext> {
      const console_ = adminConsole();
      const store = publicationService(database);
      const [live, placements, edition, runs] = await Promise.all([
        store.listBriefingPublic({ limit: options.limit }),
        store.publicHomepagePins(),
        homepageService(database).read().catch(() => null),
        editorialUpdateService(database).listRecent().catch(() => []),
      ]);

      const summaryByPublicId = await store.editorialSummaryByPublicIds(live.map(row => row.publicId));
      const placementByPublicId = new Map(
        placements.map(pin => [pin.publication.publicId, { area: pin.area, position: pin.position }]),
      );

      const summaries: ChatgptPublicationSummary[] = live.map(publication => {
        const section = publication.section as PublicationSection;
        return {
          publicId: publication.publicId,
          canonicalStoryId: publication.canonicalStoryId ?? null,
          section,
          hub: routePublication(section).hub,
          kind: publication.kind,
          title: publication.title,
          summary: publication.summary ?? null,
          status: summaryByPublicId.get(publication.publicId)?.status ?? "published",
          publishedAt: publication.publishedAt ?? null,
          updatedAt: publication.updatedAt ?? null,
          url: publicationHref(publication.publicId),
          hasMedia: Boolean(publication.media),
          sourceCount: summaryByPublicId.get(publication.publicId)?.sourceCount ?? 0,
          homepagePlacement: placementByPublicId.get(publication.publicId) ?? null,
        };
      });

      /* One entry per developing story, newest first — the check a run makes
         before creating a record that already exists. */
      const canonicalStories = summaries
        .filter(entry => entry.canonicalStoryId)
        .reduce<ChatgptEditorialContext["canonicalStories"]>((acc, entry) => {
          if (acc.some(seen => seen.canonicalStoryId === entry.canonicalStoryId)) return acc;
          acc.push({
            canonicalStoryId: entry.canonicalStoryId!, publicId: entry.publicId,
            title: entry.title, section: entry.section, updatedAt: entry.updatedAt,
          });
          return acc;
        }, []);

      const editionDate = israelEditionDate();
      const warnings: string[] = [];
      if (!edition) warnings.push("No homepage edition has been composed; the homepage is falling back to automatic selection.");
      else if (edition.editionDate !== editionDate) warnings.push(`The homepage edition is ${edition.editionDate}, not today's ${editionDate}.`);
      if (!summaries.length) warnings.push("No live publication was returned; the desk reads as empty.");
      for (const area of ["news", "fakeResistance", "people"] as const) {
        if (!placements.some(pin => pin.area === area)) warnings.push(`The ${area} band has no explicit placement and is on automatic selection.`);
      }
      const withoutMedia = summaries.filter(entry => !entry.hasMedia).length;
      if (withoutMedia) warnings.push(`${withoutMedia} of the ${summaries.length} live records carry no hero image.`);

      const extras: Record<string, unknown> = {};
      for (const extra of options.include) {
        if (extra === "incidents") extras.incidents = await console_.incidents();
        if (extra === "pipeline") extras.pipeline = await console_.pipeline();
        if (extra === "sources") extras.sources = await console_.sources();
        if (extra === "costs") extras.costs = await console_.costs();
      }
      void request;

      return {
        editionDate,
        generatedAt: new Date().toISOString(),
        homepage: edition
          ? {
            editionDate: edition.editionDate, revision: edition.revision, generatedAt: edition.generatedAt,
            placements: placements.map(pin => ({
              area: pin.area, position: pin.position,
              publicId: pin.publication.publicId, title: pin.publication.title,
            })),
          }
          : null,
        publications: summaries,
        canonicalStories,
        runs: runs.map(run => {
          const report = (run.report ?? {}) as { publications?: { created?: number; updated?: number; failed?: number } };
          return {
            runKey: run.runKey, status: run.status, stage: run.stage,
            createdAt: run.createdAt.toISOString(), finishedAt: run.finishedAt?.toISOString() ?? null,
            created: report.publications?.created ?? 0,
            updated: report.publications?.updated ?? 0,
            failed: report.publications?.failed ?? 0,
          };
        }),
        warnings,
        extras,
      };
    },
  };
}

export type ChatgptAutomationService = ReturnType<typeof chatgptAutomationService>;
