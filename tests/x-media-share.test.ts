import { describe, expect, it, vi } from "vitest";
import { firstArchiveSourceMedia } from "@/lib/content/archive-share";
import type { ArchiveMedia, ArchiveVersion } from "@/lib/content/archive";
import type { XArchiveMediaPostInput } from "@/server/contracts/x-media-share";
import type { PublicXWriteAccess } from "@/server/core/auth/public-x";
import type { ResolvedArchiveMedia } from "@/server/modules/x-media-share/archive";
import { createXMediaShareService } from "@/server/modules/x-media-share/service";

const ASSET = "https://m70ph8nwojvanarn.public.blob.vercel-storage.com/hamas-massacre/originals/videos/aa/source.mp4";
const IMAGE_ASSET = "https://m70ph8nwojvanarn.public.blob.vercel-storage.com/october7/originals/images/bb/source.jpg";
const X_UPLOAD = "https://api.x.com/2/media/upload";
const X_INIT = `${X_UPLOAD}/initialize`;
const X_METADATA = "https://api.x.com/2/media/metadata";
const X_POSTS = "https://api.x.com/2/tweets";

const input: XArchiveMediaPostInput = {
  pkg: "hamas-massacre",
  recordId: "record-one",
  mediaId: "vid-aaaaaaaaaaaaaaaa",
  locale: "en",
  assetUrl: ASSET,
};

const access: PublicXWriteAccess = {
  profile: { id: "1", username: "reader" },
  accessToken: "user-context-access-token",
};

function resolved(overrides: Partial<ResolvedArchiveMedia> = {}): ResolvedArchiveMedia {
  return {
    pkg: "hamas-massacre",
    recordId: "record-one",
    mediaId: "vid-aaaaaaaaaaaaaaaa",
    medium: "video",
    mimeType: "video/mp4",
    fileSize: 1024,
    assetUrl: ASSET,
    title: "Documented record",
    caption: "Source caption",
    sensitive: true,
    ...overrides,
  };
}

function serviceWith({
  media = resolved(),
  writeAccess = access,
  fetchImpl,
}: {
  media?: ResolvedArchiveMedia | null;
  writeAccess?: PublicXWriteAccess | null;
  fetchImpl: typeof fetch;
}) {
  const resolveMedia = vi.fn(async () => media);
  const getWriteAccess = vi.fn(async () => writeAccess);
  return {
    resolveMedia,
    getWriteAccess,
    post: createXMediaShareService({
      resolveMedia,
      getWriteAccess,
      fetchImpl,
      sleep: async () => undefined,
    }),
  };
}

function urlOf(inputValue: RequestInfo | URL): string {
  return inputValue instanceof Request ? inputValue.url : String(inputValue);
}

function jsonBody(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
}

describe("native X archive media posting", () => {
  it("posts the original image as X media without putting an archive or storage URL in the post", async () => {
    const imageBytes = new Uint8Array([1, 2, 3, 4]);
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(request);
      calls.push({ url, init });
      if (url === IMAGE_ASSET) return new Response(imageBytes, { status: 200 });
      if (url === X_UPLOAD) return Response.json({ data: { id: "111" } });
      if (url === X_POSTS) return Response.json({ data: { id: "222" } });
      throw new Error(`unexpected fetch ${url}`);
    }) as unknown as typeof fetch;

    const image = resolved({
      pkg: "october7",
      mediaId: "img-bbbbbbbbbbbbbbbb",
      medium: "image",
      mimeType: "image/jpeg",
      fileSize: imageBytes.byteLength,
      assetUrl: IMAGE_ASSET,
      sensitive: false,
      caption: "A source caption",
    });
    const { post } = serviceWith({ media: image, fetchImpl });
    const result = await post({
      ...input,
      pkg: "october7",
      mediaId: image.mediaId,
      assetUrl: IMAGE_ASSET,
    }, "session");

    expect(result.body).toEqual({ status: "posted", postUrl: "https://x.com/reader/status/222" });
    const upload = calls.find((call) => call.url === X_UPLOAD)?.init?.body;
    expect(upload).toBeInstanceOf(FormData);
    expect((upload as FormData).get("media_category")).toBe("tweet_image");
    expect(((upload as FormData).get("media") as Blob).size).toBe(imageBytes.byteLength);

    const postCall = calls.find((call) => call.url === X_POSTS);
    expect(postCall).toBeTruthy();
    expect(jsonBody(postCall?.init)).toEqual({
      text: "A source caption",
      media: { media_ids: ["111"] },
    });
    expect(String(postCall?.init?.body)).not.toContain("lionsofzion.io");
    expect(String(postCall?.init?.body)).not.toContain("blob.vercel-storage.com");
    expect(JSON.stringify(result.body)).not.toContain("blob.vercel-storage.com");
  });

  it("uploads a video with initialize/append/finalize, marks graphic violence, then creates a native video post", async () => {
    const bytes = new Uint8Array(1024).fill(7);
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(request);
      calls.push({ url, init });
      if (url === ASSET) {
        return new Response(bytes, { status: 200, headers: { "content-length": String(bytes.byteLength) } });
      }
      if (url === X_INIT) return Response.json({ data: { id: "333" } });
      if (url === `${X_UPLOAD}/333/append`) return new Response(null, { status: 204 });
      if (url === `${X_UPLOAD}/333/finalize`) {
        return Response.json({ data: { id: "333", processing_info: { state: "succeeded" } } });
      }
      if (url === X_METADATA) return new Response(null, { status: 204 });
      if (url === X_POSTS) return Response.json({ data: { id: "444" } });
      throw new Error(`unexpected fetch ${url}`);
    }) as unknown as typeof fetch;

    const { post } = serviceWith({ media: resolved({ fileSize: bytes.byteLength }), fetchImpl });
    const result = await post(input, "session");

    expect(result.body).toEqual({ status: "posted", postUrl: "https://x.com/reader/status/444" });
    expect(calls.map((call) => call.url)).toEqual([
      ASSET,
      X_INIT,
      `${X_UPLOAD}/333/append`,
      `${X_UPLOAD}/333/finalize`,
      X_METADATA,
      X_POSTS,
    ]);
    expect(jsonBody(calls.find((call) => call.url === X_INIT)?.init)).toMatchObject({
      media_category: "tweet_video",
      media_type: "video/mp4",
      total_bytes: bytes.byteLength,
    });
    expect(jsonBody(calls.find((call) => call.url === X_METADATA)?.init)).toEqual({
      id: "333",
      metadata: {
        sensitive_media_warning: {
          adult_content: false,
          graphic_violence: true,
          other: false,
        },
      },
    });
    expect(jsonBody(calls.find((call) => call.url === X_POSTS)?.init)).toEqual({
      text: "Source caption",
      media: { media_ids: ["333"] },
    });
  });

  it("keeps text-only records out of the media upload path", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const { post } = serviceWith({ media: null, fetchImpl });
    expect((await post(input, "session")).body).toEqual({ status: "media_unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not resolve or fetch archive media before the user has authorized X write access", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const { post, resolveMedia } = serviceWith({ writeAccess: null, fetchImpl });
    expect((await post(input, undefined)).body).toEqual({ status: "unauthorized" });
    expect(resolveMedia).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns an honest unavailable state when the trusted original cannot be fetched", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch;
    const { post } = serviceWith({ fetchImpl });
    expect((await post(input, "session")).body).toEqual({ status: "media_unavailable" });
  });

  it("reports a failed X upload and does not attempt to create a post", async () => {
    const imageBytes = new Uint8Array([1, 2, 3]);
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (request: RequestInfo | URL) => {
      const url = urlOf(request);
      calls.push(url);
      if (url === IMAGE_ASSET) return new Response(imageBytes, { status: 200 });
      if (url === X_UPLOAD) return new Response(null, { status: 503 });
      throw new Error(`unexpected fetch ${url}`);
    }) as unknown as typeof fetch;
    const image = resolved({
      pkg: "october7",
      mediaId: "img-bbbbbbbbbbbbbbbb",
      medium: "image",
      mimeType: "image/jpeg",
      fileSize: imageBytes.byteLength,
      assetUrl: IMAGE_ASSET,
      sensitive: false,
    });
    const { post } = serviceWith({ media: image, fetchImpl });

    expect((await post({ ...input, pkg: "october7", mediaId: image.mediaId, assetUrl: IMAGE_ASSET }, "session")).body)
      .toEqual({ status: "upload_failed" });
    expect(calls).not.toContain(X_POSTS);
  });

  it("reports a failed X post separately after media upload succeeds", async () => {
    const imageBytes = new Uint8Array([1, 2, 3]);
    const fetchImpl = vi.fn(async (request: RequestInfo | URL) => {
      const url = urlOf(request);
      if (url === IMAGE_ASSET) return new Response(imageBytes, { status: 200 });
      if (url === X_UPLOAD) return Response.json({ data: { id: "555" } });
      if (url === X_POSTS) return new Response(null, { status: 503 });
      throw new Error(`unexpected fetch ${url}`);
    }) as unknown as typeof fetch;
    const image = resolved({
      pkg: "october7",
      mediaId: "img-bbbbbbbbbbbbbbbb",
      medium: "image",
      mimeType: "image/jpeg",
      fileSize: imageBytes.byteLength,
      assetUrl: IMAGE_ASSET,
      sensitive: false,
    });
    const { post } = serviceWith({ media: image, fetchImpl });

    expect((await post({ ...input, pkg: "october7", mediaId: image.mediaId, assetUrl: IMAGE_ASSET }, "session")).body)
      .toEqual({ status: "post_failed" });
  });
});

describe("source-media selection", () => {
  const version = (blocks: ArchiveVersion["content_blocks"]): ArchiveVersion => ({
    story_id: "record",
    locale: "en",
    direction: "ltr",
    status: "published",
    title: "Record",
    content_blocks: blocks,
    cover_status: "ok",
  });

  it("returns null for a text-only record, preserving the text-sharing fallback", () => {
    expect(firstArchiveSourceMedia("october7", version([
      { type: "paragraph", position: 0, text: "Testimony" },
    ]), new Map())).toBeNull();
  });

  it("selects the original content-block media and never substitutes a cover or video thumbnail", () => {
    const actual: ArchiveMedia = {
      media_id: "img-bbbbbbbbbbbbbbbb",
      type: "image",
      mime_type: "image/jpeg",
      width: 1280,
      height: 960,
      package_path: "assets/originals/images/bb/source.jpg",
      validation_status: "ok",
    };
    const thumbnail: ArchiveMedia = {
      media_id: "thb-cccccccccccccccc",
      type: "thumbnail",
      mime_type: "image/jpeg",
      width: 480,
      height: 360,
      package_path: "assets/originals/thumbnails/cc/poster.jpg",
      validation_status: "ok",
    };
    const media = new Map([[thumbnail.media_id, thumbnail], [actual.media_id, actual]]);
    const selected = firstArchiveSourceMedia("october7", version([
      { type: "image", position: 0, media_id: actual.media_id, thumbnail_media_id: thumbnail.media_id },
    ]), media);

    expect(selected).toMatchObject({ mediaId: actual.media_id, medium: "image" });
    expect(selected?.assetUrl).toContain("/october7/originals/images/bb/source.jpg");
    expect(selected?.assetUrl).not.toContain("thumbnail");
  });

  it("refuses a media block whose original file is unavailable", () => {
    const unavailable: ArchiveMedia = {
      media_id: "vid-aaaaaaaaaaaaaaaa",
      type: "video",
      mime_type: "video/mp4",
      package_path: null,
      validation_status: "external-reference",
    };
    expect(firstArchiveSourceMedia("october7", version([
      { type: "video", position: 0, media_id: unavailable.media_id },
    ]), new Map([[unavailable.media_id, unavailable]]))).toBeNull();
  });
});
