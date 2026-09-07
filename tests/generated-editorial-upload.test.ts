import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const { storeEditorialImage } = vi.hoisted(() => ({
  storeEditorialImage: vi.fn(async (pathname: string, _body: ArrayBuffer, contentType: string) => ({
    url: `https://loz-test.public.blob.vercel-storage.com/${pathname}`,
    contentType,
  })),
}));

vi.mock("@/server/core/blob", () => ({ storeEditorialImage }));
vi.mock("@/server/core/safe-fetch", () => ({
  assertSafePublicUrl: vi.fn(async (value: string) => new URL(value)),
  enforceOutboundSourceRateLimit: vi.fn(async () => undefined),
}));
vi.mock("@/server/core/auth/actor", () => ({
  authenticateAdmin: vi.fn(), registerActor: vi.fn(), requireActor: vi.fn(),
}));

import { wholeSiteUpdateV2PackageSchema } from "@/server/contracts/whole-site-update";
import { mcpToolSpecs } from "@/server/modules/chatgpt-mcp/tools";
import type { ChatgptAutomationService } from "@/server/modules/chatgpt-automation";

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

const automation = {
  recordGeneratedMediaUpload: vi.fn(async () => undefined),
} as unknown as ChatgptAutomationService;

describe("ChatGPT generated editorial image upload", () => {
  it("takes a ChatGPT file attachment through the MCP tool and returns v2 package media", async () => {
    const bytes = pngHeader(1200, 800);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: { "content-type": "image/png", "content-length": String(bytes.byteLength) },
    })));
    storeEditorialImage.mockClear();

    const tool = mcpToolSpecs(automation).find(spec => spec.name === "upload_generated_editorial_image")!;
    const outcome = await tool.run({
      file: {
        download_url: "https://files.openai.example/generated.png",
        file_id: "file_generated_123",
        mime_type: "image/png",
        file_name: "generated.png",
      },
      runId: "editorial-2026-09-07",
      operationKey: "story-one",
      alt: "Abstract blue and gold editorial illustration about information networks",
      confirmsNoFabricatedEvidence: true,
    }, "request-1");

    const data = outcome.data as {
      media: Record<string, unknown>;
      upload: { contentHash: string; width: number; height: number; origin: string; runId: string; operationKey: string };
    };
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(storeEditorialImage).toHaveBeenCalledWith(
      `publications/media/${hash}.png`,
      expect.any(ArrayBuffer),
      "image/png",
    );
    expect(data.upload).toMatchObject({
      contentHash: hash, width: 1200, height: 800,
      origin: "chatgpt-generated-file", runId: "editorial-2026-09-07", operationKey: "story-one",
    });
    expect(data.media).toMatchObject({
      inputUrl: `https://loz-test.public.blob.vercel-storage.com/publications/media/${hash}.png`,
      generated: true,
      role: "editorial-illustration",
      credit: "Lions of Zion",
      disclosure: "Editorial illustration — not documentary evidence",
      sensitivity: "safe",
      rights: { status: "cleared", basis: "Generated in-house", surfaces: ["article", "homepage"] },
    });

    expect(wholeSiteUpdateV2PackageSchema.safeParse({
      contractVersion: "whole-site-update-v2",
      runId: "editorial-2026-09-07",
      composer: "ChatGPT",
      createdAt: "2026-09-07T10:00:00.000Z",
      creates: [{
        key: "story-one",
        publication: {
          kind: "news_update", section: "news", title: "A sourced story",
          body: "A complete and sufficiently sourced editorial record.", language: "en",
        },
        media: data.media,
      }],
      updates: [], homepage: {}, siteRecommendations: [], research: [], vetoes: [],
    }).success).toBe(true);
  });

  it("rejects a declared MIME type that does not match the downloaded bytes", async () => {
    const bytes = pngHeader(10, 10);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bytes.buffer as ArrayBuffer, {
      status: 200, headers: { "content-type": "image/png" },
    })));
    const tool = mcpToolSpecs(automation).find(spec => spec.name === "upload_generated_editorial_image")!;
    await expect(tool.run({
      file: { download_url: "https://files.openai.example/generated", file_id: "file-2", mime_type: "image/jpeg" },
      runId: "run", operationKey: "story", alt: "Editorial illustration",
      confirmsNoFabricatedEvidence: true,
    }, "request-2")).rejects.toThrow(/declared.*image\/jpeg.*downloaded.*image\/png/i);
  });

  it("enforces the existing ten-megabyte ceiling before buffering declared oversized files", async () => {
    storeEditorialImage.mockClear();
    const fetchMock = vi.fn(async () => new Response(null, {
      status: 200,
      headers: { "content-type": "image/png", "content-length": String(10 * 1024 * 1024 + 1) },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const tool = mcpToolSpecs(automation).find(spec => spec.name === "upload_generated_editorial_image")!;
    await expect(tool.run({
      file: { download_url: "https://files.openai.example/oversized", file_id: "file-3", mime_type: "image/png" },
      runId: "run", operationKey: "story", alt: "Editorial illustration",
      confirmsNoFabricatedEvidence: true,
    }, "request-3")).rejects.toThrow(/over the 10485760-byte ceiling/);
    expect(storeEditorialImage).not.toHaveBeenCalled();
  });
});
