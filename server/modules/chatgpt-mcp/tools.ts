import "server-only";

/**
 * The MCP tool surface, generated from the definitions that already exist.
 *
 * Two rules shape this file.
 *
 * **Nothing is restated.** Every operational tool comes from
 * `OPS_TOOL_DEFINITIONS` — its name, its description, its zod input and its
 * `run` — and every call goes through `chatgptAutomationService.invoke`, which
 * owns the capability policy, the `delete → archive` substitution and the
 * `chatgpt.tool.*` audit row. A second description of what `resolve_alert`
 * does is how the console and the connector come to mean different things by
 * one name.
 *
 * **Every tool works without a widget.** Phase 2 attaches UI to some of these;
 * a plain MCP client must still get a usable answer, so each tool returns
 * `structuredContent` the model can reason over plus a short text summary.
 *
 * A handful of tools are defined here rather than adapted, because the ops
 * registry has no equivalent: the console is operated by someone who already
 * has a publication's internal uuid on screen, and a model working from the
 * open web never does.
 */

import { z } from "zod";
import { OPS_TOOL_DEFINITIONS, type OpsToolDefinition } from "@/server/modules/ops-agent/tools";
import { CHATGPT_CONTEXT_EXTRAS, CHATGPT_OPS_VIEWS } from "@/server/contracts/chatgpt-automation";
import type { ChatgptAutomationService } from "@/server/modules/chatgpt-automation";
import {
  uploadGeneratedEditorialImage,
  type GeneratedEditorialImageInput,
  type GeneratedEditorialImageResult,
} from "@/server/modules/media";

/** What a registered tool needs, independent of the MCP server object. */
export type McpToolSpec = {
  name: string;
  description: string;
  inputSchema: z.ZodType<Record<string, unknown>>;
  annotations: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  /** Host-specific transport metadata advertised by `tools/list`. */
  _meta?: Record<string, unknown>;
  run: (args: Record<string, unknown>, requestId: string) => Promise<{ summary: string; data: unknown }>;
};

export type GeneratedEditorialImageUploader = (
  input: GeneratedEditorialImageInput,
) => Promise<GeneratedEditorialImageResult>;

/** The exact snake-case file object ChatGPT injects for `openai/fileParams`. */
export const generatedEditorialImageUploadSchema = z.object({
  file: z.object({
    download_url: z.string().url(),
    file_id: z.string().trim().min(1).max(500),
    mime_type: z.string().trim().min(1).max(200).optional(),
    file_name: z.string().trim().min(1).max(500).optional(),
  }).strict(),
  runId: z.string().trim().min(1).max(200),
  operationKey: z.string().trim().min(1).max(200),
  alt: z.string().trim().min(1).max(500),
  caption: z.string().trim().min(1).max(500).nullable().optional(),
  focalPoint: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }).strict().default({ x: 50, y: 50 }),
  sensitivity: z.enum(["safe", "sensitive"]).default("safe"),
  sensitivityReason: z.string().trim().min(1).max(500).optional(),
  includeHomepage: z.boolean().default(true),
  confirmsNoFabricatedEvidence: z.literal(true).describe(
    "Confirms the illustration contains no fabricated quotation, document, logo, identifiable person, battlefield evidence, or represented real event.",
  ),
}).strict().superRefine((input, ctx) => {
  if (input.sensitivity === "sensitive" && !input.sensitivityReason) {
    ctx.addIssue({
      code: "custom",
      path: ["sensitivityReason"],
      message: "A sensitive illustration requires an editorial sensitivity reason.",
    });
  }
  if (input.sensitivity === "sensitive" && input.includeHomepage) {
    ctx.addIssue({
      code: "custom",
      path: ["includeHomepage"],
      message: "Only a safe illustration may be cleared for the homepage.",
    });
  }
});

/**
 * The reads, by name.
 *
 * This matters more than it looks: a tool without `readOnlyHint` is treated by
 * ChatGPT as a write and asks the user to approve every single call, which
 * would make an editorial overview unusable. Derived from the registry's own
 * naming rather than a hand-kept list, with `search_audit` named explicitly
 * because it is the one read that does not begin with `get_`.
 */
export const isReadOnlyOpsTool = (name: string): boolean =>
  name.startsWith("get_") || name.startsWith("list_") || name === "search_audit";

/**
 * Tools that change what the public sees or cannot be undone.
 *
 * `delete_publication` is deliberately absent: through this identity it runs
 * the archive, which is reversible. Its description says so, and claiming
 * destructiveness it does not have would train the operator to dismiss the
 * warnings that are real.
 */
const DESTRUCTIVE = new Set([
  "publish_publication", "unpublish_publication", "archive_publication",
  "rollback_publication", "set_source_active",
]);

/** The registry's Hebrew label is for an operator's screen; MCP wants a title. */
function titleOf(definition: OpsToolDefinition): string {
  return definition.name.replace(/_/g, " ").replace(/^\w/, character => character.toUpperCase());
}

function describeOpsTool(definition: OpsToolDefinition): string {
  if (definition.name === "delete_publication") {
    return `${definition.description} Through this connector it does NOT delete: the request is` +
      " performed as an archive, which is reversible, and the result says so. Physical deletion" +
      " is unreachable from this identity.";
  }
  return definition.description;
}

/** One MCP tool per operational tool, adapted rather than rewritten. */
function opsTools(automation: ChatgptAutomationService): McpToolSpec[] {
  return OPS_TOOL_DEFINITIONS.map(definition => {
    const readOnly = isReadOnlyOpsTool(definition.name);
    return {
      name: definition.name,
      description: describeOpsTool(definition),
      inputSchema: definition.input,
      annotations: {
        title: titleOf(definition),
        readOnlyHint: readOnly,
        destructiveHint: DESTRUCTIVE.has(definition.name),
        idempotentHint: readOnly,
        /* Every one of these reads or writes this system's own database. None
           reaches the open internet — except `verify_source`, which fetches
           the feed it is verifying. */
        openWorldHint: definition.name === "verify_source",
      },
      run: async (args, requestId) => {
        const outcome = await automation.invoke(definition.name, args, requestId);
        return {
          summary: outcome.ranAs
            ? `${outcome.summary} (${outcome.substitutionNote})`
            : outcome.summary,
          data: outcome,
        };
      },
    } satisfies McpToolSpec;
  });
}

/** What the ops registry has no equivalent for. */
function automationTools(
  automation: ChatgptAutomationService,
  uploadGeneratedImage: GeneratedEditorialImageUploader,
): McpToolSpec[] {
  const read = (title: string) => ({
    title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
  });

  return [
    {
      name: "get_editorial_context",
      description:
        "The whole editorial picture in one call, and the right place to start: today's" +
        " Israel-local edition date, the homepage as it currently stands with its placements," +
        " the live publications with their section, hub, identity, status, media state and" +
        " source count, the developing stories keyed by canonical story id, the recent" +
        " editorial runs, and computed warnings. Ask for `include` only when you need the" +
        " expensive operational reads: each one costs six or more queries.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).default(40)
          .describe("How many live publications to return."),
        include: z.array(z.enum(CHATGPT_CONTEXT_EXTRAS)).default([])
          .describe("Optional expensive operational reads to fold in."),
      }).strict(),
      annotations: read("Editorial context"),
      run: async args => {
        const data = await automation.editorialContext({
          limit: (args.limit as number | undefined) ?? 40,
          include: (args.include as never[] | undefined) ?? [],
        });
        return {
          summary:
            `Edition ${data.editionDate}: ${data.publications.length} live records,` +
            ` ${data.canonicalStories.length} developing stories,` +
            ` ${data.warnings.length} warnings.`,
          data,
        };
      },
    },
    {
      name: "find_publication",
      description:
        "Resolve one publication by its public id (the last segment of its URL) or by its" +
        " canonical story id. Use this before creating a record to check whether the story" +
        " already exists — a miss is reported explicitly, so an empty answer never has to be" +
        " read as permission to duplicate.",
      inputSchema: z.object({
        identifier: z.string().trim().min(1).max(200)
          .describe("A publicId or a canonicalStoryId."),
      }).strict(),
      annotations: read("Find publication"),
      run: async args => {
        const identifier = args.identifier as string;
        const found = await automation.findPublication(identifier);
        return {
          summary: found
            ? `${found.title} — ${found.hub}, ${found.status}.`
            : `No publication matches "${identifier}". It does not exist yet.`,
          data: found,
        };
      },
    },
    {
      name: "get_homepage",
      description:
        "The homepage as it currently stands: the edition date and revision, and each of the" +
        " six placements with the record occupying it. A slot with no explicit placement is" +
        " on automatic selection and is simply absent here.",
      inputSchema: z.object({}).strict(),
      annotations: read("Homepage"),
      run: async () => {
        const data = await automation.homepage();
        return {
          summary: data.edition
            ? `Edition ${data.edition.editionDate}, revision ${data.edition.revision}, ${data.placements.length} placements.`
            : `No homepage edition composed; ${data.placements.length} placements stored.`,
          data,
        };
      },
    },
    {
      name: "get_editorial_runs",
      description: "The recent durable editorial runs, newest first, with their status and stage.",
      inputSchema: z.object({}).strict(),
      annotations: read("Editorial runs"),
      run: async () => {
        const data = await automation.editorialRuns();
        return { summary: `${data.length} recent runs.`, data };
      },
    },
    {
      name: "get_editorial_run",
      description:
        "One editorial run in full: what it published, what it changed on the homepage, its" +
        " research ledger and its editorial vetoes, and separately its technical failures." +
        " A veto is a decision and an error is a fault; they are reported apart. For a" +
        " whole-site-update-v1 run the research and veto fields are null rather than empty," +
        " because that contract could not represent an editorial refusal at all.",
      inputSchema: z.object({
        runKey: z.string().trim().min(1).max(200).describe("The run identifier."),
      }).strict(),
      annotations: read("Editorial run"),
      run: async args => {
        const runKey = args.runKey as string;
        const data = await automation.editorialRun(runKey);
        return {
          summary: data ? `Run ${data.runKey}: ${data.status} at ${data.stage}.` : `No run named "${runKey}".`,
          data,
        };
      },
    },
    {
      name: "get_ops_view",
      description:
        "One read-only operational view by name. `incidents` is the widest and slowest;" +
        " `overview` and `system-internals` are the cheapest.",
      inputSchema: z.object({ view: z.enum(CHATGPT_OPS_VIEWS) }).strict(),
      annotations: read("Operational view"),
      run: async args => {
        const view = args.view as (typeof CHATGPT_OPS_VIEWS)[number];
        return { summary: `Operational view: ${view}.`, data: await automation.opsView(view) };
      },
    },
    {
      name: "upload_generated_editorial_image",
      description:
        "Store a ChatGPT-generated image attachment as a validated, content-addressed" +
        " Lions of Zion editorial illustration. The tool fixes the role, disclosure," +
        " credit and cleared in-house rights on the server, then returns a media object" +
        " that can be copied directly into a whole-site-update-v2 operation. It never" +
        " treats the illustration as evidence or documentary photography, and requires" +
        " confirmation that it fabricates no quotation, document, logo, identifiable" +
        " person, battlefield evidence or represented real event.",
      inputSchema: generatedEditorialImageUploadSchema,
      annotations: {
        title: "Upload generated editorial image",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: { "openai/fileParams": ["file"] },
      run: async (args, requestId) => {
        const parsed = generatedEditorialImageUploadSchema.parse(args);
        const auditInput = {
          runId: parsed.runId,
          operationKey: parsed.operationKey,
          fileId: parsed.file.file_id,
          ...(parsed.file.file_name ? { fileName: parsed.file.file_name } : {}),
          ...(parsed.file.mime_type ? { mimeType: parsed.file.mime_type } : {}),
        };
        try {
          const data = await uploadGeneratedImage(parsed);
          await automation.recordGeneratedMediaUpload(auditInput, {
            contentHash: data.upload.contentHash,
            url: data.upload.url,
            contentType: data.upload.contentType,
            byteSize: data.upload.byteSize,
            width: data.upload.width,
            height: data.upload.height,
            storedAt: data.upload.storedAt,
          }, requestId, true);
          return {
            summary:
              `Stored ${data.upload.width}×${data.upload.height} ${data.upload.contentType}` +
              ` illustration for ${data.upload.operationKey}. Copy data.media into the` +
              " matching whole-site-update-v2 operation.",
            data,
          };
        } catch (cause) {
          await automation.recordGeneratedMediaUpload(auditInput, {
            errorClass: cause instanceof Error ? cause.name : "UnknownError",
          }, requestId, false).catch(() => undefined);
          throw cause;
        }
      },
    },
  ];
}

export function mcpToolSpecs(
  automation: ChatgptAutomationService,
  uploadGeneratedImage: GeneratedEditorialImageUploader = uploadGeneratedEditorialImage,
): McpToolSpec[] {
  return [...automationTools(automation, uploadGeneratedImage), ...opsTools(automation)];
}
