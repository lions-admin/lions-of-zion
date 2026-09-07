import "server-only";

import type {
  XArchiveMediaPostInput,
  XArchiveMediaPostResponse,
} from "@/server/contracts/x-media-share";
import type { PublicXWriteAccess } from "@/server/core/auth/public-x";
import type { ResolvedArchiveMedia } from "./archive";

const X_MEDIA_UPLOAD = "https://api.x.com/2/media/upload";
const X_MEDIA_INITIALIZE = `${X_MEDIA_UPLOAD}/initialize`;
const X_MEDIA_METADATA = "https://api.x.com/2/media/metadata";
const X_POSTS = "https://api.x.com/2/tweets";
const VIDEO_CHUNK_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PROCESSING_CHECKS = 24;

export type XMediaShareResult = {
  body: XArchiveMediaPostResponse;
  sessionCookie?: string;
};

export type XMediaShareDependencies = {
  resolveMedia(input: XArchiveMediaPostInput): Promise<ResolvedArchiveMedia | null>;
  getWriteAccess(cookie: string | undefined): Promise<PublicXWriteAccess | null>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export function createXMediaShareService(dependencies: XMediaShareDependencies) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const sleep = dependencies.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  return async function postArchiveMediaToX(
    input: XArchiveMediaPostInput,
    sessionCookie: string | undefined,
  ): Promise<XMediaShareResult> {
    const access = await dependencies.getWriteAccess(sessionCookie);
    if (!access) return { body: { status: "unauthorized" } };

    const media = await dependencies.resolveMedia(input);
    if (!media) return withSession({ status: "media_unavailable" }, access);

    const source = await fetchImpl(media.assetUrl, { cache: "no-store", redirect: "error" }).catch(() => null);
    if (!source?.ok || !source.body) return withSession({ status: "media_unavailable" }, access);

    let mediaId: string | null;
    try {
      mediaId =
        media.medium === "video"
          ? await uploadVideo(fetchImpl, sleep, access.accessToken, media, source)
          : await uploadImage(fetchImpl, access.accessToken, media, source);
    } catch {
      return withSession({ status: "upload_failed" }, access);
    }
    if (!mediaId) return withSession({ status: "upload_failed" }, access);

    if (media.sensitive) {
      try {
        const marked = await markGraphicMedia(fetchImpl, access.accessToken, mediaId);
        if (!marked) return withSession({ status: "upload_failed" }, access);
      } catch {
        return withSession({ status: "upload_failed" }, access);
      }
    }

    try {
      const postId = await createPost(fetchImpl, access.accessToken, mediaId, postText(media));
      if (!postId) return withSession({ status: "post_failed" }, access);
      return withSession(
        { status: "posted", postUrl: `https://x.com/${access.profile.username}/status/${postId}` },
        access,
      );
    } catch {
      return withSession({ status: "post_failed" }, access);
    }
  };
}

function withSession(
  body: XArchiveMediaPostResponse,
  access: PublicXWriteAccess,
): XMediaShareResult {
  return { body, sessionCookie: access.sessionCookie };
}

async function uploadImage(
  fetchImpl: typeof fetch,
  token: string,
  media: ResolvedArchiveMedia,
  source: Response,
): Promise<string | null> {
  const bytes = new Uint8Array(await source.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return null;
  if (media.fileSize && bytes.byteLength !== media.fileSize) return null;

  const form = new FormData();
  form.set("media", new Blob([Uint8Array.from(bytes)], { type: media.mimeType }), mediaFilename(media));
  form.set("media_category", "tweet_image");
  form.set("media_type", media.mimeType);
  form.set("shared", "false");

  const response = await fetchImpl(X_MEDIA_UPLOAD, {
    method: "POST",
    cache: "no-store",
    headers: bearer(token),
    body: form,
  });
  if (!response.ok) return null;
  return mediaIdFrom(await response.json().catch(() => null));
}

async function uploadVideo(
  fetchImpl: typeof fetch,
  sleep: (ms: number) => Promise<void>,
  token: string,
  media: ResolvedArchiveMedia,
  source: Response,
): Promise<string | null> {
  const headerLength = Number(source.headers.get("content-length"));
  const knownLength = media.fileSize ?? (Number.isSafeInteger(headerLength) && headerLength > 0 ? headerLength : null);
  if (!knownLength || knownLength > MAX_VIDEO_BYTES) return null;
  if (Number.isSafeInteger(headerLength) && headerLength > 0 && headerLength !== knownLength) return null;

  const initResponse = await fetchImpl(X_MEDIA_INITIALIZE, {
    method: "POST",
    cache: "no-store",
    headers: { ...bearer(token), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      media_category: "tweet_video",
      media_type: media.mimeType,
      total_bytes: knownLength,
      shared: false,
    }),
  });
  if (!initResponse.ok) return null;
  const mediaId = mediaIdFrom(await initResponse.json().catch(() => null));
  if (!mediaId) return null;

  let segment = 0;
  let uploaded = 0;
  const ok = await readChunks(source.body!, VIDEO_CHUNK_BYTES, async (chunk) => {
    if (segment > 999) return false;
    const form = new FormData();
    form.set(
      "media",
      new Blob([Uint8Array.from(chunk)], { type: media.mimeType }),
      `segment-${segment}.mp4`,
    );
    form.set("segment_index", String(segment));
    const response = await fetchImpl(`${X_MEDIA_UPLOAD}/${mediaId}/append`, {
      method: "POST",
      cache: "no-store",
      headers: bearer(token),
      body: form,
    });
    if (!response.ok) return false;
    uploaded += chunk.byteLength;
    segment += 1;
    return true;
  });
  if (!ok || uploaded !== knownLength) return null;

  const finalize = await fetchImpl(`${X_MEDIA_UPLOAD}/${mediaId}/finalize`, {
    method: "POST",
    cache: "no-store",
    headers: { ...bearer(token), Accept: "application/json" },
  });
  if (!finalize.ok) return null;
  let processingPayload: unknown = await finalize.json().catch(() => null);
  const initialState = processingState(processingPayload);
  if (initialState === "failed") return null;
  if (!initialState || initialState === "succeeded") return mediaId;

  for (let attempt = 0; attempt < MAX_PROCESSING_CHECKS; attempt += 1) {
    const delay = Math.min(Math.max(processingDelay(processingPayload), 1), 5) * 1000;
    await sleep(delay);
    const status = await fetchImpl(`${X_MEDIA_UPLOAD}?media_id=${encodeURIComponent(mediaId)}`, {
      method: "GET",
      cache: "no-store",
      headers: { ...bearer(token), Accept: "application/json" },
    });
    if (!status.ok) return null;
    processingPayload = await status.json().catch(() => null);
    const state = processingState(processingPayload);
    if (state === "succeeded" || !state) return mediaId;
    if (state === "failed") return null;
  }
  return null;
}

async function markGraphicMedia(fetchImpl: typeof fetch, token: string, mediaId: string): Promise<boolean> {
  const response = await fetchImpl(X_MEDIA_METADATA, {
    method: "POST",
    cache: "no-store",
    headers: { ...bearer(token), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      id: mediaId,
      metadata: {
        sensitive_media_warning: {
          adult_content: false,
          graphic_violence: true,
          other: false,
        },
      },
    }),
  });
  return response.ok;
}

async function createPost(
  fetchImpl: typeof fetch,
  token: string,
  mediaId: string,
  text: string,
): Promise<string | null> {
  const response = await fetchImpl(X_POSTS, {
    method: "POST",
    cache: "no-store",
    headers: { ...bearer(token), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ text, media: { media_ids: [mediaId] } }),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const id = payload && typeof payload === "object" ? (payload as { data?: { id?: unknown } }).data?.id : null;
  return typeof id === "string" && /^\d{1,19}$/.test(id) ? id : null;
}

async function readChunks(
  stream: ReadableStream<Uint8Array<ArrayBuffer>>,
  chunkSize: number,
  consume: (chunk: Uint8Array<ArrayBuffer>) => Promise<boolean>,
): Promise<boolean> {
  const reader = stream.getReader();
  let carry = new Uint8Array(0);
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const combined = new Uint8Array(carry.byteLength + value.byteLength);
      combined.set(carry, 0);
      combined.set(value, carry.byteLength);
      let offset = 0;
      while (combined.byteLength - offset >= chunkSize) {
        if (!(await consume(combined.slice(offset, offset + chunkSize)))) return false;
        offset += chunkSize;
      }
      carry = combined.slice(offset);
    }
    return carry.byteLength === 0 ? true : consume(carry);
  } finally {
    reader.releaseLock();
  }
}

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function mediaIdFrom(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const id = (data as { id?: unknown }).id;
  return typeof id === "string" && /^\d{1,19}$/.test(id) ? id : null;
}

function processingState(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const info = (data as { processing_info?: unknown }).processing_info;
  if (!info || typeof info !== "object") return null;
  const state = (info as { state?: unknown }).state;
  return typeof state === "string" ? state : null;
}

function processingDelay(value: unknown): number {
  if (!value || typeof value !== "object") return 1;
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") return 1;
  const info = (data as { processing_info?: unknown }).processing_info;
  if (!info || typeof info !== "object") return 1;
  const delay = Number((info as { check_after_secs?: unknown }).check_after_secs);
  return Number.isFinite(delay) && delay > 0 ? delay : 1;
}

function mediaFilename(media: ResolvedArchiveMedia): string {
  const subtype = media.mimeType.split("/")[1]?.replace(/[^a-z0-9]+/gi, "") || (media.medium === "video" ? "mp4" : "jpg");
  return `${media.mediaId}.${subtype}`;
}

function postText(media: ResolvedArchiveMedia): string {
  const raw = (media.caption || media.title || "October 7 archive record").replace(/\s+/g, " ").trim();
  return truncateForX(raw, 260) || "October 7 archive record";
}

function truncateForX(text: string, budget: number): string {
  let total = 0;
  let output = "";
  for (const char of text) {
    const code = char.codePointAt(0)!;
    const weight =
      (code >= 0x0000 && code <= 0x10ff) ||
      (code >= 0x2000 && code <= 0x200d) ||
      (code >= 0x2010 && code <= 0x201f) ||
      (code >= 0x2032 && code <= 0x2037)
        ? 1
        : 2;
    if (total + weight > budget) break;
    output += char;
    total += weight;
  }
  if (output.length === text.length) return output;
  return output.replace(/\s+\S*$/u, "").trimEnd() + "…";
}
