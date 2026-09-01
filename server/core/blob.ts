import "server-only";

/**
 * Raw bytes, stored once per fetch rather than once per derived row.
 *
 * Source captures are private operational records. Public article projections
 * expose direct publisher URLs and permitted excerpts, never this object URL.
 */

import { put } from "@vercel/blob";
import { briefingBlobOptions } from "./config";

export type StoredBlob = { url: string; contentType: string };

export async function storeRawBytes(
  pathname: string,
  data: string,
  contentType: string,
): Promise<StoredBlob> {
  if (!pathname.startsWith("briefing/raw/")) {
    throw new Error("Briefing source captures must use the isolated briefing/raw prefix.");
  }
  const blob = await put(pathname, data, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType,
    ...briefingBlobOptions(),
  });
  return { url: blob.url, contentType: blob.contentType };
}
