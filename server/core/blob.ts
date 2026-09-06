import "server-only";

/**
 * Bytes, stored once per fetch rather than once per derived row.
 *
 * Two prefixes, two access levels, for two different jobs. Source captures
 * (`briefing/raw/`) are private operational records: public article
 * projections expose direct publisher URLs and permitted excerpts, never that
 * object URL. Editorial images (`publications/media/`) are the opposite — see
 * `storeEditorialImage` below for why one of them has to be public and what
 * keeps that narrow.
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

/**
 * An editorial image, stored where a reader's browser can actually load it.
 *
 * This is the one thing in this file that is deliberately **public**, and the
 * asymmetry is the point. A raw capture above is an operational record of what
 * a publisher served us — evidence, not something we redistribute — so it stays
 * private and a reader is sent to the publisher's own URL instead. A hero image
 * has the opposite job: `next/image` fetches it from the browser on every
 * article view, so a private object would simply not render. What makes that
 * safe is that nothing reaches this function unvetted — `server/modules/media`
 * fetches the bytes, refuses anything that is not one of five image types,
 * caps the size, parses real pixel dimensions out of the header, and records
 * the rights the composer declared. The prefix guard mirrors `storeRawBytes`
 * so a caller cannot quietly publish into `briefing/raw/`, or anywhere else.
 *
 * `allowOverwrite: true` where the raw path refuses it: the pathname here is
 * derived from the sha256 of the bytes, so an overwrite can only ever replace
 * an object with byte-identical content. That turns a retried briefing run
 * into a no-op instead of a `BlobAlreadyExistsError` that would cost the
 * publication its picture.
 */
export async function storeEditorialImage(
  pathname: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<StoredBlob> {
  if (!pathname.startsWith("publications/media/")) {
    throw new Error("Editorial images must use the isolated publications/media prefix.");
  }
  const blob = await put(pathname, data, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    ...briefingBlobOptions(),
  });
  return { url: blob.url, contentType: blob.contentType };
}
