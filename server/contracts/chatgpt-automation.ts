/**
 * The wire shapes of the scheduled ChatGPT editor's read/control interface.
 *
 * Zod only, like every contract here, so this file loads from a route, from a
 * test with no database, and from a future MCP adapter alike.
 *
 * What this interface is *for* is narrow and worth stating: a scheduled run
 * reads the site's editorial and operational state, decides what to create,
 * update or veto, and then delivers that decision as a package through GitHub.
 * Publishing does not happen here. The one write path that matters editorially
 * is still `chatgpt-editorial-updates` → GitHub Action → editorial ingest, and
 * this interface exists so the run can make an informed decision before taking
 * it — not so it can take a shortcut around it.
 */

import { z } from "zod";
import { OPS_TOOLS, type OpsTool } from "./admin-console";

/**
 * The automation's identity, everywhere. It is the `app.identity` the database
 * role carries, the actor label on every audit row, and the string a human
 * greps for to answer "what did the scheduled editor do".
 *
 * Deliberately distinct from `service:editorial-updates` (which delivers a
 * package GitHub already validated) and from the human admin. Three actor
 * classes, three labels, and `audit_log` can tell them apart.
 */
export const CHATGPT_ACTOR_LABEL = "service:chatgpt-editorial" as const;

/**
 * Tools this identity may invoke — all of them, by owner ruling (2026-09-07).
 *
 * The registry is imported rather than restated, so a tool added to the ops
 * console is available here and a tool removed from it cannot linger as a name
 * this file still believes in.
 */
export const CHATGPT_AUTOMATION_TOOLS = OPS_TOOLS;

/**
 * The one substitution, and the reason for it.
 *
 * Of the six tools the ops console guards behind a confirmation, five are
 * reversible: publish, unpublish and archive are status transitions, a rollback
 * writes a new version and keeps the history, and a source can be switched back
 * on. `delete_publication` is the exception — `publications.remove` drops the
 * row and there is no undelete.
 *
 * An unattended run has nobody to ask, so the choice was between withholding
 * the capability and making it survivable. The owner chose the latter: the tool
 * remains callable and does the recoverable half of what it says, archiving the
 * record and reporting plainly that it did so. `publications.remove` is not
 * reachable from this identity at all.
 */
export const CHATGPT_SUBSTITUTED_TOOLS = {
  delete_publication: "archive_publication",
} as const satisfies Partial<Record<OpsTool, OpsTool>>;

/**
 * The read-only operational views, by name.
 *
 * An allowlist rather than a passthrough to `adminConsole()`: that object also
 * carries `drainOutbox`, `runMaintenanceTick` and the quarantine handlers, and
 * a route that resolved a path segment against it by method name would expose
 * whichever of those someone added next.
 */
export const CHATGPT_OPS_VIEWS = [
  "overview", "pipeline", "editorial", "sources", "narratives",
  "incidents", "settings", "security", "system-internals",
] as const;
export const chatgptOpsViewSchema = z.enum(CHATGPT_OPS_VIEWS);
export type ChatgptOpsView = z.infer<typeof chatgptOpsViewSchema>;

export const chatgptActionRequestSchema = z.object({
  tool: z.enum(OPS_TOOLS),
  args: z.record(z.string(), z.unknown()).default({}),
}).strict();
export type ChatgptActionRequest = z.infer<typeof chatgptActionRequestSchema>;

export const chatgptActionResultSchema = z.object({
  tool: z.enum(OPS_TOOLS),
  /** Set when the tool ran as something else, with the reason. */
  ranAs: z.enum(OPS_TOOLS).nullable().default(null),
  substitutionNote: z.string().nullable().default(null),
  summary: z.string(),
  result: z.unknown(),
});
export type ChatgptActionResult = z.infer<typeof chatgptActionResultSchema>;

/** Which of the expensive console reads to fold into the context bundle.
 *  Everything here fans out to six or more queries, so none is a default. */
export const CHATGPT_CONTEXT_EXTRAS = ["incidents", "pipeline", "sources", "costs"] as const;
export type ChatgptContextExtra = (typeof CHATGPT_CONTEXT_EXTRAS)[number];

export const chatgptContextQuerySchema = z.object({
  include: z.string().trim().optional().transform(value => {
    if (!value) return [] as ChatgptContextExtra[];
    const wanted = new Set(value.split(",").map(entry => entry.trim()));
    return CHATGPT_CONTEXT_EXTRAS.filter(extra => wanted.has(extra));
  }),
  /** Live records to return. Bounded so one call stays one call. */
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export type ChatgptContextQuery = z.infer<typeof chatgptContextQuerySchema>;

/** One live record, as the editor needs to see it to avoid duplicating a story. */
export const chatgptPublicationSummarySchema = z.object({
  publicId: z.string(),
  canonicalStoryId: z.string().nullable(),
  section: z.string(),
  hub: z.string(),
  kind: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  status: z.string(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  url: z.string(),
  hasMedia: z.boolean(),
  sourceCount: z.number().int().nonnegative(),
  homepagePlacement: z.object({ area: z.string(), position: z.string() }).nullable(),
});
export type ChatgptPublicationSummary = z.infer<typeof chatgptPublicationSummarySchema>;

export const chatgptEditorialContextSchema = z.object({
  editionDate: z.string(),
  generatedAt: z.string(),
  homepage: z.object({
    editionDate: z.string(),
    revision: z.number().int(),
    generatedAt: z.string(),
    placements: z.array(z.object({
      area: z.string(), position: z.string(), publicId: z.string().nullable(), title: z.string().nullable(),
    })),
  }).nullable(),
  publications: z.array(chatgptPublicationSummarySchema),
  /** Developing stories, newest first — the duplicate check in one place. */
  canonicalStories: z.array(z.object({
    canonicalStoryId: z.string(),
    publicId: z.string(),
    title: z.string(),
    section: z.string(),
    updatedAt: z.string().nullable(),
  })),
  runs: z.array(z.object({
    runKey: z.string(), status: z.string(), stage: z.string(),
    createdAt: z.string(), finishedAt: z.string().nullable(),
    created: z.number().int().nonnegative(), updated: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  })),
  /** Computed, not stored: what a human would notice at a glance. */
  warnings: z.array(z.string()),
  extras: z.record(z.string(), z.unknown()),
});
export type ChatgptEditorialContext = z.infer<typeof chatgptEditorialContextSchema>;
