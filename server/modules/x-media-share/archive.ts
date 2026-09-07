import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { XArchiveMediaPostInput } from "@/server/contracts/x-media-share";

const ROOT = path.join(process.cwd(), "content-packages");
const PRODUCTION_ARCHIVE_HOST = "m70ph8nwojvanarn.public.blob.vercel-storage.com";

type ArchiveBlock = {
  type: string;
  media_id?: string;
  caption?: string;
};

type ArchiveVersion = {
  title: string;
  content_blocks?: ArchiveBlock[];
};

type ArchiveRecord = {
  canonical_story_id: string;
  default_language: string;
  versions: Record<string, ArchiveVersion>;
};

type ArchiveMedia = {
  media_id: string;
  type: string;
  mime_type?: string | null;
  file_size?: number | null;
  package_path: string | null;
  caption?: string | null;
  validation_status?: string;
};

export type ResolvedArchiveMedia = {
  pkg: XArchiveMediaPostInput["pkg"];
  recordId: string;
  mediaId: string;
  medium: "video" | "image";
  mimeType: string;
  fileSize: number | null;
  assetUrl: string;
  title: string;
  caption: string | null;
  sensitive: boolean;
};

const registryCache = new Map<string, Promise<Map<string, ArchiveMedia>>>();

export async function resolveArchiveMedia(
  input: XArchiveMediaPostInput,
): Promise<ResolvedArchiveMedia | null> {
  if (!safeRecordId(input.recordId)) return null;

  const record = await readRecord(input.pkg, input.recordId);
  if (!record || record.canonical_story_id !== input.recordId) return null;

  const version =
    (input.locale ? record.versions[input.locale] : undefined) ??
    record.versions[record.default_language] ??
    Object.values(record.versions)[0];
  if (!version) return null;

  const block = (version.content_blocks ?? []).find(
    (candidate) =>
      candidate.media_id === input.mediaId &&
      (candidate.type === "video" || candidate.type === "image"),
  );
  if (!block) return null;

  const registry = await mediaRegistry(input.pkg);
  const item = registry.get(input.mediaId);
  if (!item?.package_path || (item.type !== "video" && item.type !== "image")) return null;
  if (item.validation_status && item.validation_status !== "ok") return null;

  const expectedPath = `/${input.pkg}/${item.package_path.replace(/^assets\//, "")}`;
  if (!isTrustedArchiveAsset(input.assetUrl, expectedPath)) return null;

  const medium = item.type;
  const mimeType = item.mime_type ?? (medium === "video" ? "video/mp4" : "image/jpeg");
  if (medium === "video" && !mimeType.startsWith("video/")) return null;
  if (medium === "image" && !mimeType.startsWith("image/")) return null;
  const fileSize = Number.isSafeInteger(item.file_size) && Number(item.file_size) > 0
    ? Number(item.file_size)
    : null;

  return {
    pkg: input.pkg,
    recordId: input.recordId,
    mediaId: input.mediaId,
    medium,
    mimeType,
    fileSize,
    assetUrl: input.assetUrl,
    title: version.title.trim() || input.recordId,
    caption: block.caption?.trim() || item.caption?.trim() || null,
    sensitive: input.pkg === "hamas-massacre" || medium === "video",
  };
}

async function readRecord(pkg: XArchiveMediaPostInput["pkg"], id: string): Promise<ArchiveRecord | null> {
  try {
    const raw = await readFile(path.join(ROOT, pkg, "records", `${id}.json`), "utf8");
    return JSON.parse(raw) as ArchiveRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function mediaRegistry(pkg: XArchiveMediaPostInput["pkg"]): Promise<Map<string, ArchiveMedia>> {
  const key = `${pkg}/media`;
  let hit = registryCache.get(key);
  if (!hit) {
    hit = readFile(path.join(ROOT, pkg, "media.json"), "utf8").then((raw) => {
      const items = JSON.parse(raw) as ArchiveMedia[];
      return new Map(items.map((item) => [item.media_id, item]));
    });
    registryCache.set(key, hit);
  }
  return hit;
}

function safeRecordId(value: string): boolean {
  return /^[a-z0-9À-ɏ-]+$/.test(value);
}

function isTrustedArchiveAsset(value: string, expectedPath: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === PRODUCTION_ARCHIVE_HOST &&
      url.pathname === expectedPath &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
