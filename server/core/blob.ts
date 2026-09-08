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

import { head, put } from "@vercel/blob";
import { briefingBlobOptions, editorialMediaBlobOptions } from "./config";

export type StoredBlob = { url: string; contentType: string };

/** The exact refusal `put()` raises for a pathname that is already taken. */
const BLOB_ALREADY_EXISTS = /This blob already exists/;

/**
 * A raw source capture, private, never overwritten — and idempotent anyway.
 *
 * The pathname is `briefing/raw/<sourceId>/<sha256 of the bytes>`, so two
 * writes to one path can only ever carry byte-identical content. The caller
 * (`ingestSource`) asks `source_fetch` whether these bytes were stored before
 * and skips the upload when a row says so. What that lookup cannot see is an
 * object that reached the store without its row: the upload happens before
 * the fetch transaction opens, deliberately, so a transaction that then
 * failed leaves the object behind and nothing pointing at it.
 *
 * Until 2026-09-08 that state was permanent. Israel Hayom served the same
 * bytes for six hours; every collection window re-derived the same path,
 * `put()` refused it with "This blob already exists", and twelve jobs burned
 * five attempts each into quarantine while the feed was healthy. When the
 * publisher changed a byte the path changed and the failure vanished, which
 * is exactly why nobody had caught it: it cleared itself before anyone read
 * the error.
 *
 * `allowOverwrite` stays `false` here — the capture store is an evidence
 * record and an overwrite is not something it should be able to do. The
 * refusal is instead the answer: an existing object at a content-addressed
 * path *is* the bytes we were about to store, so `head()` it and return it.
 * Any other failure still throws.
 */
export async function storeRawBytes(
  pathname: string,
  data: string,
  contentType: string,
): Promise<StoredBlob> {
  if (!pathname.startsWith("briefing/raw/")) {
    throw new Error("Briefing source captures must use the isolated briefing/raw prefix.");
  }
  const options = briefingBlobOptions();
  try {
    const blob = await put(pathname, data, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType,
      ...options,
    });
    return { url: blob.url, contentType: blob.contentType };
  } catch (cause) {
    if (!(cause instanceof Error) || !BLOB_ALREADY_EXISTS.test(cause.message)) throw cause;
    const existing = await head(pathname, options);
    return { url: existing.url, contentType: existing.contentType };
  }
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
 *
 * **The binding is `editorialMediaBlobOptions()`, never the briefing one.** A
 * Blob store's access mode is fixed at the store, not chosen per object, so
 * `access: "public"` against the private capture store is refused outright —
 * `Vercel Blob: Cannot use public access on a private store`. Both functions
 * here read `briefingBlobOptions()` until 2026-09-07, and in Production that
 * threw on every editorial image after the run had already updated its
 * publications and advanced the homepage: run
 * `chatgpt-daily-2026-09-07-1758-k7m4` left the Lebanon News Lead with no
 * hero. Do not "fix" a recurrence by relaxing the briefing store — private is
 * what makes the capture an evidence record rather than a republication.
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
    ...editorialMediaBlobOptions(),
  });
  return { url: blob.url, contentType: blob.contentType };
}
