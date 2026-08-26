import "server-only";

/**
 * Raw bytes, stored once per fetch rather than once per derived row.
 *
 * Always `access: "public"` — never `"private"`. That is not a shortcut, it
 * is the other half of the CHECK on `evidence`: restricted and secret material
 * is refused a `blob_url` at all, which is what makes an unguessable-but-public
 * URL an acceptable place to put everything that remains. Signed, private
 * blob access is a real Vercel Blob feature and is deliberately unused here —
 * introducing it would be the moment classification stops being enforced by
 * "no link exists" and starts depending on someone configuring access
 * correctly forever.
 */

import { put } from "@vercel/blob";
import { blobToken } from "./config";

export type StoredBlob = { url: string; contentType: string };

export async function storeRawBytes(
  pathname: string,
  data: string,
  contentType: string,
): Promise<StoredBlob> {
  const blob = await put(pathname, data, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType,
    token: blobToken(),
  });
  return { url: blob.url, contentType: blob.contentType };
}
