import "server-only";

/**
 * The tool registry — the complete list of things the assistant can do.
 *
 * There is no other surface. The model cannot query the database, read an
 * environment variable, or call an HTTP route; it can call these thirty
 * functions and read what they return. That is deliberate and it is why the
 * console can be handed real authority: the blast radius is a list you can
 * read in one sitting.
 *
 * Three properties every entry carries, and why:
 *
 *   - **`requiresConfirmation`** is not advice to the model. A tool marked
 *     with it is registered with an `execute` that records a pending
 *     confirmation and returns without doing anything; the operation only
 *     happens on a later turn, against a signed token. A model that decides
 *     to publish something cannot publish it.
 *   - **`consequence`** is written for the operator, not the model. It goes
 *     into the confirmation dialog verbatim, so it says what changes and who
 *     will see it — "readers may already have seen it" is the kind of sentence
 *     that belongs here.
 *   - **`entityType` / `entityId`** are what the audit row is filed under, so
 *     "who archived this publication" is answerable from `audit_log` alone.
 *     Operations that touch no single record file under `system`.
 *
 * `summarise` exists because the full result of `get_pipeline` is several
 * kilobytes of JSON that the operator does not need echoed into the
 * transcript; the model gets the whole thing, the transcript gets a line.
 */

import { z } from "zod";
import {
  CONFIRMED_OPS_TOOLS,
  OPS_TOOLS,
  listAuditSchema,
  retryJobSchema,
  resolveAlertSchema,
  rollbackPublicationSchema,
  setSourceActiveSchema,
  type OpsTool,
} from "@/server/contracts/admin-console";
import {
  listPublicationsSchema,
  transitionPublicationSchema,
  updatePublicationSchema,
} from "@/server/contracts/publication";
import type { EntityType } from "@/server/contracts/enums";
import type { Actor } from "@/server/core/audit";
import type { OpsToolContext } from "./context";

export type OpsToolDefinition = {
  name: OpsTool;
  /** What the operator reads, in Hebrew. Nothing but a person reads this. */
  label: string;
  /** What the model reads when deciding whether to call this. English: it is
   *  prompt text, and the tool loop was built and tested against it. */
  description: string;
  input: z.ZodType<Record<string, unknown>>;
  requiresConfirmation: boolean;
  /** Plain words for the operator's dialog. */
  consequence: (args: Record<string, unknown>) => string;
  target: (args: Record<string, unknown>) => string;
  entityType: EntityType;
  entityId: (args: Record<string, unknown>) => string | null;
  run: (ctx: OpsToolContext, args: Record<string, unknown>, actor: Actor, requestId?: string) => Promise<unknown>;
  summarise: (result: unknown) => string;
};

const CONFIRMED = new Set<string>(CONFIRMED_OPS_TOOLS);

const none = z.object({}).strict();
const byId = z.object({ id: z.uuid() }).strict();
const str = (value: unknown, key: string): string => String((value as Record<string, unknown>)[key]);

/** A read tool's summary: how much came back, not what. */
const counted = (label: string) => (result: unknown): string => {
  if (Array.isArray(result)) return `${result.length} ${label}`;
  if (result && typeof result === "object") {
    const entries = Object.entries(result as Record<string, unknown>)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => `${(v as unknown[]).length} ${k}`);
    return entries.length ? `${label}: ${entries.join(", ")}` : label;
  }
  return label;
};

function define(
  name: OpsTool,
  spec: Omit<OpsToolDefinition, "name" | "requiresConfirmation"> & { requiresConfirmation?: never },
): OpsToolDefinition {
  return { name, requiresConfirmation: CONFIRMED.has(name), ...spec };
}

export const OPS_TOOL_DEFINITIONS: OpsToolDefinition[] = [
  /* ── Reads ──────────────────────────────────────────────────────────── */
  define("get_overview", {
    label: "תמונת מצב",
    description:
      "The console's front screen: whether the system is active and why not, the last and next run, "
      + "what was collected, processed, drafted and published in the last 24 hours, open alerts, and "
      + "stuck or quarantined work. Call this first when asked how things are.",
    input: none,
    consequence: () => "Reads the current system state. Changes nothing.",
    target: () => "System overview",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.console.overview(),
    summarise: (result) => {
      const r = result as { systemActive?: boolean; counts24h?: Record<string, number> };
      return `system ${r.systemActive ? "active" : "not fully active"}; published ${r.counts24h?.published ?? 0} in 24h`;
    },
  }),
  define("get_pipeline", {
    label: "מצב תהליך העיבוד",
    description:
      "Every pipeline stage (collect, enrich, cluster, triage, draft, quality, publish) with pending, "
      + "running, stuck and quarantined counts, average duration and last error; the jobs needing "
      + "attention; recent jobs; and the recent editions. Use this to answer why processing has stopped.",
    input: none,
    consequence: () => "Reads pipeline state. Changes nothing.",
    target: () => "Pipeline",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.console.pipeline(),
    summarise: counted("pipeline"),
  }),
  define("get_sources", {
    label: "בריאות המקורות",
    description:
      "Every configured source with its kind, family, active state, verification state, last successful "
      + "fetch, and a week of attempts, successes, items seen, new and duplicate. Use this to find a "
      + "source that has stopped returning material.",
    input: none,
    consequence: () => "Reads source health. Changes nothing.",
    target: () => "Sources",
    entityType: "source",
    entityId: () => null,
    run: (ctx) => ctx.console.sources(),
    summarise: (result) => {
      const r = result as { totals?: { active?: number; disabled?: number; failing?: number } };
      return `${r.totals?.active ?? 0} active, ${r.totals?.disabled ?? 0} disabled, ${r.totals?.failing ?? 0} failing`;
    },
  }),
  define("get_editorial", {
    label: "תור העריכה",
    description:
      "The editorial desk: counts by status and the newest publications in each lane — drafts, in review, "
      + "ready to publish, published, archived — with section, evidence count and homepage slot.",
    input: none,
    consequence: () => "Reads the editorial queue. Changes nothing.",
    target: () => "Editorial desk",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.console.editorial(),
    summarise: (result) => {
      const r = result as { counts?: Record<string, number> };
      const c = r.counts ?? {};
      return `${c.draft ?? 0} drafts, ${c.under_review ?? 0} in review, ${c.approved ?? 0} ready, ${c.published ?? 0} published`;
    },
  }),
  define("get_narratives", {
    label: "מגמות נרטיבים",
    description:
      "Tracked narratives with their trend over the last seven days against the seven before it — new, "
      + "rising, stable or declining — evidence state, and the publications linked to each.",
    input: none,
    consequence: () => "Reads narrative monitoring. Changes nothing.",
    target: () => "Narratives",
    entityType: "narrative",
    entityId: () => null,
    run: (ctx) => ctx.console.narratives(),
    summarise: (result) => {
      const r = result as { counts?: Record<string, number> };
      return `${r.counts?.new ?? 0} new, ${r.counts?.rising ?? 0} rising, ${r.counts?.declining ?? 0} declining`;
    },
  }),
  define("get_users", {
    label: "משתמשים והרשאות",
    description:
      "Staff accounts with their capability grants and last recorded action, the number of registered "
      + "public readers, and recent administrator actions.",
    input: none,
    consequence: () => "Reads accounts and permissions. Changes nothing.",
    target: () => "Users and permissions",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.console.users(),
    summarise: (result) => {
      const r = result as { staff?: unknown[]; registeredPublicUsers?: number };
      return `${r.staff?.length ?? 0} staff, ${r.registeredPublicUsers ?? 0} registered readers`;
    },
  }),
  define("get_costs", {
    label: "עלויות מול תקציב",
    description:
      "Model spend against the configured budgets: today, 24 hours, month to date and 30 days, broken "
      + "down by model, by surface (briefing, chat, operations console, embedding) and by kind, plus "
      + "daily and monthly series and search usage. Warnings list any budget past its threshold.",
    input: none,
    consequence: () => "Reads spend and budgets. Changes nothing.",
    target: () => "Costs and usage",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.console.costs(),
    summarise: (result) => {
      const r = result as { spend?: { monthToDateUsd?: number }; warnings?: unknown[] };
      return `$${(r.spend?.monthToDateUsd ?? 0).toFixed(4)} month to date; ${r.warnings?.length ?? 0} warnings`;
    },
  }),
  define("get_incidents", {
    label: "תקלות ומשימות תקועות",
    description:
      "Open alerts, alerts resolved in the last week, stuck and quarantined jobs, failed runs, the "
      + "quality quarantine, and undelivered outbox messages. This is the recovery screen.",
    input: none,
    consequence: () => "Reads incidents. Changes nothing.",
    target: () => "Incidents",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.console.incidents(),
    summarise: (result) => {
      const r = result as { openAlerts?: unknown[]; stuckJobs?: unknown[] };
      return `${r.openAlerts?.length ?? 0} open alerts, ${r.stuckJobs?.length ?? 0} stuck jobs`;
    },
  }),
  define("get_security", {
    label: "מצב אבטחה וחיבורים",
    description:
      "Which secrets and integrations are configured — booleans and one-way fingerprints only, never a "
      + "value — plus recent security events and capability changes. This tool cannot read a secret; "
      + "no tool can.",
    input: none,
    consequence: () => "Reads security posture. Changes nothing. Never returns a secret value.",
    target: () => "Security and connections",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.console.security(ctx.request),
    summarise: (result) => {
      const r = result as { secrets?: Array<{ configured?: boolean }> };
      const missing = (r.secrets ?? []).filter((s) => !s.configured).length;
      return missing ? `${missing} secrets not configured` : "all named secrets configured";
    },
  }),
  define("get_settings", {
    label: "הגדרות המערכת",
    description:
      "Cron schedules, model profiles, budgets, publication sections and search groups, with where each "
      + "value is set. Read-only: settings are changed in configuration and environment, not from here.",
    input: none,
    consequence: () => "Reads configuration. Changes nothing.",
    target: () => "Settings",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.console.settings(),
    summarise: () => "settings",
  }),
  define("search_audit", {
    label: "חיפוש ביומן הביקורת",
    description:
      "The audit log, newest first, filtered by entity type, entity id, actor or an action prefix such "
      + "as 'publication.' or 'ops.'. Use it to answer who did what and when. Page with `before`.",
    input: listAuditSchema,
    consequence: () => "Reads the audit log. Changes nothing.",
    target: () => "Audit log",
    entityType: "system",
    entityId: () => null,
    run: (ctx, args) => ctx.console.audit(listAuditSchema.parse(args)),
    summarise: (result) => `${(result as { entries?: unknown[] }).entries?.length ?? 0} audit entries`,
  }),
  define("get_publication", {
    label: "קריאת כתבה",
    description: "One publication in full — title, summary, body, section, status and monitoring details.",
    input: byId,
    consequence: () => "Reads one publication. Changes nothing.",
    target: (args) => `Publication ${str(args, "id")}`,
    entityType: "brief",
    entityId: (args) => str(args, "id"),
    run: (ctx, args) => ctx.publications.get(str(args, "id")),
    summarise: (result) => {
      const r = result as { title?: string; status?: string };
      return `${r.status ?? "?"}: ${(r.title ?? "").slice(0, 80)}`;
    },
  }),
  define("list_publications", {
    label: "רשימת כתבות",
    description:
      "Publications filtered by kind, section or status. Pass `briefingOnly: true` to exclude the static "
      + "site pages that share the table.",
    input: listPublicationsSchema,
    consequence: () => "Reads publications. Changes nothing.",
    target: () => "Publications",
    entityType: "brief",
    entityId: () => null,
    run: (ctx, args) => ctx.publications.list(listPublicationsSchema.parse(args)),
    summarise: counted("publications"),
  }),

  /* ── Reversible operations ──────────────────────────────────────────── */
  define("run_processing", {
    label: "הרצת עיבוד עכשיו",
    description:
      "Queues today's editorial processing now instead of waiting for the schedule, and re-dispatches "
      + "jobs that were waiting. Safe to call twice: work already completed today is not repeated.",
    input: none,
    consequence: () => "Queues today's processing. Completed work is not repeated.",
    target: () => "Today's pipeline",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.briefing.runProcessing({ force: true }),
    summarise: (result) => `status ${(result as { status?: string }).status ?? "queued"}`,
  }),
  define("resume_publication", {
    label: "חידוש פרסום אוטומטי",
    description:
      "Turns automatic publication back on: approved editions reach the public site on their own again, "
      + "with no further prompt before each one.",
    input: none,
    consequence: () => "Approved editions publish themselves to the public site again.",
    target: () => "Automatic publication",
    entityType: "system",
    entityId: () => null,
    run: (ctx, _args, actor) => ctx.briefing.setAutomaticPublicationPaused(false, actor),
    summarise: () => "automatic publication active",
  }),
  define("retry_job", {
    label: "הרצת משימה מחדש",
    description:
      "Puts a stuck, quarantined or attempt-exhausted job back on the ready queue. Pass "
      + "`resetAttempts: true` for a job that has used all its attempts.",
    input: byId.extend(retryJobSchema.shape),
    consequence: () => "Returns the job to the queue; it will run again and may spend budget.",
    target: (args) => `Job ${str(args, "id")}`,
    entityType: "system",
    entityId: (args) => str(args, "id"),
    run: (ctx, args, actor, requestId) =>
      ctx.console.retryJob(str(args, "id"), retryJobSchema.parse(args), actor, requestId),
    summarise: (result) => {
      const r = result as { previousState?: string; state?: string; dispatched?: boolean };
      return `${r.previousState} → ${r.state}${r.dispatched ? ", dispatched" : ""}`;
    },
  }),
  define("resolve_alert", {
    label: "סימון התראה כטופלה",
    description:
      "Marks an operational alert resolved once its cause is dealt with. Resolving an alert whose cause "
      + "persists only hides it until it fires again.",
    input: byId.extend(resolveAlertSchema.shape),
    consequence: () => "Marks the alert resolved. It reopens if the condition recurs.",
    target: (args) => `Alert ${str(args, "id")}`,
    entityType: "system",
    entityId: (args) => str(args, "id"),
    run: (ctx, args, actor, requestId) =>
      ctx.console.resolveAlert(str(args, "id"), resolveAlertSchema.parse(args), actor, requestId),
    summarise: (result) => `resolved: ${(result as { kind?: string }).kind ?? "alert"}`,
  }),
  define("verify_source", {
    label: "אימות מקור והפעלתו",
    description:
      "Fetches a source live. A feed that returns valid material is enabled; one that does not stays "
      + "disabled with the error recorded. This is the only way a disabled feed comes back.",
    input: byId,
    consequence: () => "Fetches the source now and enables it only if it returns a valid feed.",
    target: (args) => `Source ${str(args, "id")}`,
    entityType: "source",
    entityId: (args) => str(args, "id"),
    run: (ctx, args, actor) => ctx.sources.verify(str(args, "id"), actor),
    summarise: (result) => {
      const r = result as { fetch?: { status?: string; itemsSeen?: number } };
      return `${r.fetch?.status ?? "?"}, ${r.fetch?.itemsSeen ?? 0} items`;
    },
  }),
  define("sync_source_catalog", {
    label: "סנכרון קטלוג המקורות",
    description:
      "Reconciles registered sources with the reviewed catalog. It never enables anything: a changed "
      + "endpoint is returned to pending verification and must pass a live fetch first.",
    input: none,
    consequence: () => "Adds and updates source records. Every changed source is left disabled pending verification.",
    target: () => "Source catalog",
    entityType: "source",
    entityId: () => null,
    run: (ctx, _args, actor) => ctx.sources.syncCatalog(actor),
    summarise: (result) => {
      const r = result as { created?: number; updated?: number };
      return `${r.created ?? 0} added, ${r.updated ?? 0} updated`;
    },
  }),
  define("update_publication", {
    label: "עריכת כתבה",
    description:
      "Edits a publication's title, summary, body, section or monitoring details. `changeSummary` is "
      + "required and is recorded on the version. Editing a published article changes what readers see.",
    input: byId.extend(updatePublicationSchema.shape),
    consequence: (args) =>
      `Saves a new version of the publication. ${String(args.changeSummary ?? "")}`.trim(),
    target: (args) => `Publication ${str(args, "id")}`,
    entityType: "brief",
    entityId: (args) => str(args, "id"),
    run: (ctx, args, actor, requestId) =>
      ctx.publications.update(str(args, "id"), updatePublicationSchema.parse(args), actor, requestId),
    summarise: (result) => `updated: ${((result as { title?: string }).title ?? "").slice(0, 80)}`,
  }),
  define("set_homepage_feature", {
    label: "שיבוץ בעמוד הבית",
    description:
      "Places a publication in one of the three homepage slots, or clears a slot with a null id. The "
      + "publication must already be published.",
    input: z.object({ slot: z.number().int().min(1).max(3), publicationId: z.uuid().nullable() }).strict(),
    consequence: (args) =>
      args.publicationId
        ? `Slot ${String(args.slot)} on the public homepage shows this publication.`
        : `Slot ${String(args.slot)} on the public homepage is cleared.`,
    target: (args) => `Homepage slot ${String(args.slot)}`,
    entityType: "brief",
    entityId: (args) => (args.publicationId ? String(args.publicationId) : null),
    run: (ctx, args, actor) =>
      ctx.publications.setHomepageFeature(
        Number(args.slot),
        args.publicationId === null ? null : String(args.publicationId),
        actor,
      ),
    summarise: () => "homepage slot set",
  }),
  define("run_health_check", {
    label: "בדיקת תקינות עמוקה",
    description: "Probes the database, blob storage, the queue and the model gateway, and reports latency.",
    input: none,
    consequence: () => "Runs a live probe of each dependency. Changes nothing.",
    target: () => "Deep health check",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.health(ctx.request),
    summarise: (result) => `status ${(result as { status?: string }).status ?? "?"}`,
  }),

  /* ── Irreversible operations — never executed without a confirmation ── */
  define("pause_publication", {
    label: "השהיית פרסום אוטומטי",
    description:
      "Stops approved editions from reaching the public site. Collection and processing continue, so "
      + "nothing is lost, but nothing new is published until this is resumed.",
    input: none,
    consequence: () =>
      "Approved editions stop reaching the public site until publication is resumed. Collection and "
      + "processing continue, so nothing is lost — but nothing new is published either.",
    target: () => "Automatic publication",
    entityType: "system",
    entityId: () => null,
    run: (ctx, _args, actor) => ctx.briefing.setAutomaticPublicationPaused(true, actor),
    summarise: () => "automatic publication paused",
  }),
  define("force_rerun", {
    label: "הרצה מחדש של מהדורת היום",
    description:
      "Regenerates today's edition from the start, spending model budget again. Output that passes the "
      + "quality gates publishes automatically and replaces what readers see now.",
    input: none,
    consequence: () =>
      "Today's edition is regenerated from the start and model budget is spent again. New output that "
      + "passes the quality gates publishes automatically and replaces what readers see now.",
    target: () => "Today's edition",
    entityType: "system",
    entityId: () => null,
    run: (ctx) => ctx.briefing.runProcessing({ force: true, regenerateCompleted: true }),
    summarise: (result) => `status ${(result as { status?: string }).status ?? "queued"}`,
  }),
  define("publish_publication", {
    label: "פרסום כתבה",
    description:
      "Moves an approved publication to published. It becomes readable on the public site and available "
      + "to search engines immediately.",
    input: byId,
    consequence: () =>
      "The publication becomes readable on public pages and available to search engines immediately. "
      + "Taking it down again means archiving it, which readers may already have seen.",
    target: (args) => `Publication ${str(args, "id")}`,
    entityType: "brief",
    entityId: (args) => str(args, "id"),
    run: (ctx, args, actor, requestId) =>
      ctx.publications.transition(str(args, "id"), transitionPublicationSchema.parse({ to: "published" }), actor, requestId),
    summarise: (result) => `published: ${((result as { title?: string }).title ?? "").slice(0, 80)}`,
  }),
  define("unpublish_publication", {
    label: "הסרת כתבה מהאתר",
    description:
      "Takes a published article off the public site by archiving it — the only legal way out of "
      + "published. Readers who already saw it have already seen it.",
    input: byId,
    consequence: () =>
      "The article is archived and disappears from public pages. Anyone who already read it, or a search "
      + "engine that already indexed it, may still hold a copy.",
    target: (args) => `Publication ${str(args, "id")}`,
    entityType: "brief",
    entityId: (args) => str(args, "id"),
    run: (ctx, args, actor, requestId) =>
      ctx.publications.transition(str(args, "id"), transitionPublicationSchema.parse({ to: "archived" }), actor, requestId),
    summarise: () => "archived",
  }),
  define("archive_publication", {
    label: "ארכוב כתבה",
    description: "Archives a publication in any status. An archived record can be returned to draft later.",
    input: byId,
    consequence: () => "The publication is archived and leaves the public site if it was on it.",
    target: (args) => `Publication ${str(args, "id")}`,
    entityType: "brief",
    entityId: (args) => str(args, "id"),
    run: (ctx, args, actor, requestId) =>
      ctx.publications.transition(str(args, "id"), transitionPublicationSchema.parse({ to: "archived" }), actor, requestId),
    summarise: () => "archived",
  }),
  define("delete_publication", {
    label: "מחיקת כתבה לצמיתות",
    description:
      "Permanently deletes a draft or archived publication. There is no undelete. Anything published "
      + "must be archived instead.",
    input: byId,
    consequence: () =>
      "The publication and its record are permanently deleted. This cannot be undone, and its version "
      + "history goes with it.",
    target: (args) => `Publication ${str(args, "id")}`,
    entityType: "brief",
    entityId: (args) => str(args, "id"),
    run: async (ctx, args, actor, requestId) => {
      await ctx.publications.remove(str(args, "id"), actor, requestId);
      return { deleted: str(args, "id") };
    },
    summarise: () => "deleted",
  }),
  define("rollback_publication", {
    label: "החזרת כתבה לגרסה קודמת",
    description:
      "Restores a publication to an earlier version. The restore is itself a new version, so nothing is "
      + "lost — but if the publication is live, readers see the older text immediately.",
    input: byId.extend(rollbackPublicationSchema.shape),
    consequence: () =>
      "The publication's content is replaced with the chosen earlier version, as a new version on top. "
      + "If it is published, readers see the older text immediately.",
    target: (args) => `Publication ${str(args, "id")}`,
    entityType: "brief",
    entityId: (args) => str(args, "id"),
    run: (ctx, args, actor, requestId) =>
      ctx.console.rollbackPublication(str(args, "id"), rollbackPublicationSchema.parse(args), actor, requestId),
    summarise: (result) => `rolled back to version ${(result as { versionNumber?: number }).versionNumber ?? "?"}`,
  }),
  define("set_source_active", {
    label: "הפעלה או השבתה של מקור",
    description:
      "Switches a source on or off with a stated reason. A feed-backed source cannot be switched on "
      + "until a live verification fetch has succeeded — use verify_source for that.",
    input: byId.extend(setSourceActiveSchema.shape),
    consequence: (args) =>
      args.active
        ? "The source is collected again on its normal cadence."
        : "The source stops being collected. Nothing already gathered is lost.",
    target: (args) => `Source ${str(args, "id")}`,
    entityType: "source",
    entityId: (args) => str(args, "id"),
    run: (ctx, args, actor, requestId) =>
      ctx.console.setSourceActive(str(args, "id"), setSourceActiveSchema.parse(args), actor, requestId),
    summarise: (result) => `active: ${String((result as { active?: boolean }).active)}`,
  }),
];

/**
 * The registry is complete and correctly flagged, checked at module load.
 *
 * A tool added to `OPS_TOOLS` but not defined here would simply never be
 * offered — a silent hole rather than an error — and a tool whose
 * confirmation flag drifted from `CONFIRMED_OPS_TOOLS` would execute
 * something irreversible without asking. Both are worth a startup crash.
 */
const byName = new Map(OPS_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));
if (byName.size !== OPS_TOOL_DEFINITIONS.length) {
  throw new Error("The operations tool registry defines a tool twice.");
}
for (const name of OPS_TOOLS) {
  const tool = byName.get(name);
  if (!tool) throw new Error(`The operations tool registry is missing "${name}".`);
  if (tool.requiresConfirmation !== CONFIRMED.has(name)) {
    throw new Error(`Tool "${name}" carries the wrong confirmation flag.`);
  }
}
if (byName.size !== OPS_TOOLS.length) {
  throw new Error("The operations tool registry defines a tool that is not in OPS_TOOLS.");
}

export function opsTool(name: string): OpsToolDefinition | undefined {
  return byName.get(name as OpsTool);
}
