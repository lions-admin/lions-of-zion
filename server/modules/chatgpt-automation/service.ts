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
import { editorialUpdate } from "@/server/modules/editorial-update";
import { homepageService } from "@/server/modules/homepage/service";
import { publications } from "@/server/modules/publications";
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
      const store = publications();
      const [live, placements, edition, runs] = await Promise.all([
        store.listBriefingPublic({ limit: options.limit }),
        store.publicHomepagePins(),
        homepageService(database).read().catch(() => null),
        editorialUpdate().listRecent().catch(() => []),
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
