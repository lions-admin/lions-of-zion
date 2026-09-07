import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

/* The registry reaches module singletons for its read paths, and those reach
   Neon Auth, which a node-environment test cannot load. */
vi.mock("@/server/core/auth/actor", () => ({
  authenticateAdmin: vi.fn(), registerActor: vi.fn(), requireActor: vi.fn(),
}));

import { generatedEditorialImageUploadSchema, isReadOnlyOpsTool, mcpToolSpecs } from "@/server/modules/chatgpt-mcp/tools";
import { OPS_TOOLS, CONFIRMED_OPS_TOOLS } from "@/server/contracts/admin-console";
import type { ChatgptAutomationService } from "@/server/modules/chatgpt-automation";

/**
 * The tool surface a ChatGPT conversation discovers.
 *
 * The properties worth pinning are not "does it have N tools" but: is every
 * schema something a client can actually read, is every read marked as one,
 * and does the connector describe what it will really do rather than what its
 * name says.
 */

const calls: Array<{ method: string; args: unknown[] }> = [];
const stub = {
  invoke: (...args: unknown[]) => {
    calls.push({ method: "invoke", args });
    return Promise.resolve({ tool: args[0], ranAs: null, substitutionNote: null, summary: "done", result: {} });
  },
  editorialContext: () => Promise.resolve({ editionDate: "2026-09-07", publications: [], canonicalStories: [], warnings: [] }),
  opsView: (view: unknown) => Promise.resolve({ view }),
  findPublication: (id: unknown) => Promise.resolve(id === "known" ? { title: "A story", hub: "News & Analysis", status: "published" } : null),
  homepage: () => Promise.resolve({ edition: { editionDate: "2026-09-07", revision: 3 }, placements: [] }),
  editorialRuns: () => Promise.resolve([]),
  editorialRun: () => Promise.resolve(null),
  recordGeneratedMediaUpload: vi.fn(async () => undefined),
} as unknown as ChatgptAutomationService;

const upload = vi.fn(async (input) => ({
  media: { inputUrl: "https://store.public.blob.vercel-storage.com/publications/media/hash.png" },
  upload: {
    url: "https://store.public.blob.vercel-storage.com/publications/media/hash.png",
    contentHash: "a".repeat(64), contentType: "image/png", byteSize: 24,
    width: 1200, height: 800, storedAt: "2026-09-07T10:00:00.000Z",
    fileId: input.file.file_id, origin: "chatgpt-generated-file" as const,
    runId: input.runId, operationKey: input.operationKey,
  },
})) as never;
const specs = mcpToolSpecs(stub, upload);
const byName = new Map(specs.map(spec => [spec.name, spec]));

describe("the MCP tool surface", () => {
  it("exposes every operational tool individually, not behind one generic runner", () => {
    for (const tool of OPS_TOOLS) expect(byName.has(tool)).toBe(true);
    /* The point of discoverability: a model should learn what exists from
       `tools/list`, not from documentation about a `run_action(tool, args)`. */
    expect(byName.has("run_action")).toBe(false);
    expect(specs.length).toBe(OPS_TOOLS.length + 7);
  });

  it("gives every tool a JSON schema a client can actually read", () => {
    for (const spec of specs) {
      const json = z.toJSONSchema(spec.inputSchema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
      expect(json.type).toBe("object");
      expect(spec.description.length).toBeGreaterThan(20);
    }
  });

  /* Three tool schemas carry a `z.coerce` or a `.transform()`. Converted on the
     output side they would ask the model for an already-parsed value — the
     reason the ops console passes `io: "input"`, restated here as a test
     because the MCP path converts through a different code path. */
  it("advertises the input side of a schema that transforms", () => {
    const list = byName.get("list_publications")!;
    const json = z.toJSONSchema(list.inputSchema, { io: "input", unrepresentable: "any" }) as {
      properties?: Record<string, { type?: string | string[] }>;
    };
    expect(json.properties?.briefingOnly).toBeDefined();
    /* The parsed side is a boolean; the input side must still admit the
       string form the query contract accepts. */
    expect(JSON.stringify(json.properties?.briefingOnly)).toContain("string");
  });

  /* A tool without `readOnlyHint` is treated as a write and prompts the user
     on every call. Getting this wrong on the reads would make an editorial
     overview unusable, and getting it wrong on the writes would hide them. */
  it("marks the reads read-only and the writes not", () => {
    for (const name of ["get_overview", "get_editorial_context", "get_homepage", "search_audit", "list_publications"]) {
      expect(byName.get(name)!.annotations.readOnlyHint).toBe(true);
    }
    for (const name of ["update_publication", "publish_publication", "set_homepage_placement", "resolve_alert"]) {
      expect(byName.get(name)!.annotations.readOnlyHint).toBe(false);
    }
    expect(isReadOnlyOpsTool("search_audit")).toBe(true);
    expect(isReadOnlyOpsTool("archive_publication")).toBe(false);
  });

  it("marks the genuinely destructive writes, and does not cry wolf about the one that archives", () => {
    for (const name of CONFIRMED_OPS_TOOLS) {
      if (name === "delete_publication") continue;
      expect(byName.get(name)!.annotations.destructiveHint).toBe(true);
    }
    /* Through this connector it archives, which is reversible. Claiming a
       destructiveness it does not have would train the operator to dismiss
       the warnings that are real. */
    expect(byName.get("delete_publication")!.annotations.destructiveHint).toBe(false);
  });

  it("tells the model plainly that deletion is performed as an archive", () => {
    const description = byName.get("delete_publication")!.description;
    expect(description).toMatch(/does NOT delete/i);
    expect(description).toMatch(/archive/i);
    expect(description).toMatch(/reversible/i);
  });

  it("routes every operational tool through the automation service, never around it", async () => {
    calls.length = 0;
    await byName.get("get_overview")!.run({}, "request-1");
    await byName.get("archive_publication")!.run({ id: "11111111-1111-4111-8111-111111111111" }, "request-2");
    expect(calls.map(call => call.args[0])).toEqual(["get_overview", "archive_publication"]);
    /* The request id reaches the audit row, which is what ties an MCP call to
       the log line that records the transport. */
    expect(calls[0]!.args[2]).toBe("request-1");
  });

  it("answers a duplicate check with an explicit miss, never a bare empty result", async () => {
    const found = await byName.get("find_publication")!.run({ identifier: "known" }, "r");
    expect(found.summary).toContain("A story");
    const missing = await byName.get("find_publication")!.run({ identifier: "nothing" }, "r");
    expect(missing.data).toBeNull();
    /* "It does not exist yet" is the answer a composer needs; an empty object
       reads as permission to create a duplicate. */
    expect(missing.summary).toMatch(/does not exist/i);
  });

  it("returns a usable answer with no widget, which is the fallback the app rests on", async () => {
    const result = await byName.get("get_editorial_context")!.run({}, "r");
    expect(typeof result.summary).toBe("string");
    expect(result.summary).toContain("2026-09-07");
    expect(result.data).toBeTruthy();
  });

  it("advertises ChatGPT's supported file parameter and returns package media", async () => {
    const spec = byName.get("upload_generated_editorial_image")!;
    const audit = vi.mocked(stub.recordGeneratedMediaUpload);
    audit.mockClear();
    expect(spec._meta).toEqual({ "openai/fileParams": ["file"] });
    expect(spec.annotations).toMatchObject({
      readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true,
    });

    const json = z.toJSONSchema(generatedEditorialImageUploadSchema, { io: "input" }) as unknown as {
      properties: { file: { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean } };
    };
    expect(Object.keys(json.properties.file.properties)).toEqual([
      "download_url", "file_id", "mime_type", "file_name",
    ]);
    expect(json.properties.file.required).toEqual(["download_url", "file_id"]);
    expect(json.properties.file.additionalProperties).toBe(false);

    const result = await spec.run({
      file: { download_url: "https://files.example.test/generated.png", file_id: "file-1", mime_type: "image/png" },
      runId: "run-1", operationKey: "story-1", alt: "Original editorial illustration for the story",
      confirmsNoFabricatedEvidence: true,
    }, "request-upload");
    expect(result.data).toMatchObject({ media: { inputUrl: expect.stringContaining("publications/media/") } });
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({
      runId: "run-1", operationKey: "story-1", sensitivity: "safe", includeHomepage: true,
    }));
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", operationKey: "story-1", fileId: "file-1" }),
      expect.objectContaining({ contentHash: "a".repeat(64) }),
      "request-upload",
      true,
    );
    expect(JSON.stringify(audit.mock.calls[0]?.[0])).not.toContain("download_url");
  });
});
