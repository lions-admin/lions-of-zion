import "server-only";

/**
 * Turning a URL an outside composer sent us into an asset this site owns.
 *
 * The whole of this file is the answer to one question: what has to be true
 * about a picture before a publication is allowed to wear it? A composer hands
 * over an `inputUrl` and a set of claims about the image — who took it, what
 * licence it rests on, what it does and does not show. None of that is
 * trusted. The bytes are fetched once, checked against what they claim to be,
 * measured, hashed, and copied into this project's own public Blob store; the
 * site then serves its own copy and never calls the origin again. A publisher
 * that reorganises its CDN, or swaps a file after we cited it, changes nothing
 * here.
 *
 * ## No database, on purpose
 *
 * `materializeExternalMedia` performs network and blob work and returns a
 * plain `EditorialMediaDraft`. It never opens a connection and never writes a
 * row, because it is called *before* the publish transaction — see the media
 * section of `server/modules/briefing/external-publish.ts`. Holding a
 * transaction open across N image downloads is how a 300-second function times
 * out with locks held.
 *
 * ## Dimensions without an image library
 *
 * `sharp` is a devDependency; it is not present at runtime, and adding an
 * image decoder to a serverless function to learn two integers would be a poor
 * trade. Width and height live in the first few dozen bytes of every format
 * this accepts, so `imageDimensions` reads them straight out of the header.
 * That also means we never decode attacker-supplied pixel data in-process.
 *
 * ## Rights are recorded, never improved
 *
 * Nothing below upgrades a rights status, invents a clearance date, or adds a
 * surface. A composer that could not establish a licence sends
 * `status: "unknown"`, and `"unknown"` is what gets stored — the asset and its
 * provenance are kept, and the RLS policy on `editorial_media` plus
 * `isHomepageSafeMedia`/`isArticleSafeMedia` keep it off every public surface
 * until a human clears it. Storing the picture is not the same as showing it.
 */

import { storeEditorialImage } from "@/server/core/blob";
import { integrityHash } from "@/server/core/hash";
import type { ExternalMedia } from "@/server/contracts/external-briefing";
import type { EditorialMediaDraft } from "./repo";

/** The five types the site is prepared to serve, and the extension each gets
 *  in the object store. Anything else — an SVG, a PDF, an HTML error page
 *  served with a 200 — is refused rather than stored and hoped about. SVG in
 *  particular is a script container, and it is absent here deliberately. */
const ACCEPTED_IMAGE_TYPES: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/** Ten megabytes. Well above any legitimate editorial photograph after a
 *  publisher's own compression, and well below what would embarrass the
 *  function's memory budget when several arrive in one run. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** One budget for the whole fetch, redirects included, rather than per hop —
 *  a chain of five slow redirects must not multiply into five timeouts. */
const FETCH_TIMEOUT_MS = 20_000;

/** Enough to follow a canonical-URL or CDN hop; few enough that a redirect
 *  loop ends as an error instead of as a request budget. */
const MAX_REDIRECTS = 5;

export type MaterializeContext = {
  /** The submitting run, recorded on the asset's provenance. */
  runId: string;
  /** `daily-brief`, `article-1`, … — which record asked for this picture. */
  candidateKey: string;
  /** The composing system's free-text label. Never an authorization claim. */
  composer: string;
};

/**
 * Fetch, validate, measure, store — and hand back a row-shaped draft.
 *
 * Throws a descriptive `Error` on any failure. It is the caller that decides
 * what a failure means: in the external briefing path a missing image is a
 * warning and the record publishes without one, because publishing is the
 * primary act and an illustration is not.
 */
export async function materializeExternalMedia(
  media: ExternalMedia,
  context: MaterializeContext,
): Promise<EditorialMediaDraft> {
  const fetched = await fetchImageBytes(media.inputUrl);
  const bytes = new Uint8Array(fetched.body);
  const { width, height } = imageDimensions(bytes, fetched.contentType);

  const contentHash = integrityHash(bytes);
  const extension = ACCEPTED_IMAGE_TYPES[fetched.contentType]!;
  /* Content-addressed, so the pathname is a pure function of the bytes. Two
     articles illustrated from one photograph are one object; a retried run
     overwrites its own object with identical content instead of accumulating
     `image-1.jpg`, `image-2.jpg`. This is the same key `insertMedia` dedupes
     rows on, which is what keeps blob and table in step. */
  /* Images already shipped from this application's immutable public asset
     directory do not need to be copied back into Blob. Production currently
     uses a private Blob store for evidence captures, which correctly rejects
     a public upload. Reusing an owned, deployed editorial asset by its local
     path keeps it browser-readable without weakening that store's access
     level or duplicating the same bytes. External URLs still take the normal
     content-addressed Blob path. */
  const ownedStaticPath = ownedStaticEditorialPath(media.inputUrl);
  const stored = ownedStaticPath
    ? { url: ownedStaticPath, contentType: fetched.contentType }
    : await storeEditorialImage(
      `publications/media/${contentHash}.${extension}`,
      fetched.body,
      fetched.contentType,
    );

  return {
    src: stored.url,
    width,
    height,
    alt: media.alt,
    caption: media.caption,
    credit: media.credit,
    /* Two different URLs, both kept. `sourceUrl` is the page a reader can be
       sent to for attribution; `originUrl` is the file we actually read, which
       is what makes the fetch reproducible and the rights claim checkable. */
    sourceUrl: media.sourceUrl,
    originUrl: media.inputUrl,
    /* A generated image is an editorial illustration and is never presented as
       documentation of the event. The contract already pins `role` and demands
       the disclosure line that says so; both travel through here unchanged,
       and the `editorial_media_generated_is_an_illustration` CHECK refuses the
       row if anything downstream ever tries to launder one into a documentary
       role. */
    disclosure: media.disclosure,
    role: media.role,
    focalPoint: media.focalPoint,
    sensitivity: media.sensitivity,
    rights: {
      status: media.rights.status,
      basis: media.rights.basis,
      reference: media.rights.reference,
      clearedAt: media.rights.clearedAt,
      surfaces: media.rights.surfaces,
    },
    contentHash,
    byteSize: bytes.byteLength,
    contentType: fetched.contentType,
    generated: media.generated,
    provenance: {
      composer: context.composer,
      runId: context.runId,
      candidateKey: context.candidateKey,
      fetchedAt: new Date().toISOString(),
      inputUrl: media.inputUrl,
      generated: media.generated,
    },
  };
}

/* ── Fetch ────────────────────────────────────────────────────────────────── */

type FetchedImage = { body: ArrayBuffer; contentType: string };

/**
 * One image, with the redirect chain followed by hand.
 *
 * `redirect: "manual"` rather than `"follow"` because `fetch` offers no way to
 * cap the number of hops, and an unbounded chain is both a request-budget
 * problem and a way to walk a fetch somewhere it was never pointed. Each hop
 * is re-checked for an http(s) scheme, so a `Location:` of `file://` or
 * `data:` ends the fetch rather than being followed.
 */
async function fetchImageBytes(inputUrl: string): Promise<FetchedImage> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let current = requireHttpUrl(inputUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal,
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`Image URL ${inputUrl} returned ${response.status} with no Location header.`);
      }
      current = requireHttpUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new Error(`Image URL ${inputUrl} returned HTTP ${response.status}.`);
    }

    /* `content-type` may carry parameters (`image/jpeg; charset=binary`), and
       casing is not guaranteed. The bare type is what gets compared, and an
       unlisted one is refused before a single byte is buffered. */
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (!ACCEPTED_IMAGE_TYPES[contentType]) {
      throw new Error(
        `Image URL ${inputUrl} served "${contentType || "no content type"}", which is not one of `
        + `${Object.keys(ACCEPTED_IMAGE_TYPES).join(", ")}.`,
      );
    }

    /* Checked twice: the advertised length refuses an oversized download
       before it starts, and the real length refuses a server that lied or sent
       no header at all. */
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
      throw new Error(`Image URL ${inputUrl} declares ${declared} bytes, over the ${MAX_IMAGE_BYTES}-byte ceiling.`);
    }

    const body = await response.arrayBuffer();
    if (body.byteLength === 0) throw new Error(`Image URL ${inputUrl} returned an empty body.`);
    if (body.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image URL ${inputUrl} returned ${body.byteLength} bytes, over the ${MAX_IMAGE_BYTES}-byte ceiling.`);
    }

    return { body, contentType };
  }

  throw new Error(`Image URL ${inputUrl} exceeded ${MAX_REDIRECTS} redirects.`);
}

function requireHttpUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Image URL ${value} is not an http(s) URL.`);
  }
  return url.toString();
}

function ownedStaticEditorialPath(value: string): string | null {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "lionsofzion.io") return null;
  return /^\/images\/homepage\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp|avif|gif)$/.test(url.pathname)
    ? url.pathname
    : null;
}

/* ── Header-only dimension parsing ───────────────────────────────────────────
 *
 * Every format below writes its pixel size into a fixed, documented position
 * near the front of the file, so none of this decodes image data. All of it is
 * bounds-checked: a truncated or hostile header throws rather than reading off
 * the end of the buffer, and a zero dimension throws rather than reaching the
 * `editorial_media_has_positive_dimensions` CHECK. */

type Dimensions = { width: number; height: number };

function imageDimensions(bytes: Uint8Array, contentType: string): Dimensions {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dimensions = contentType === "image/png" ? pngDimensions(bytes, view)
    : contentType === "image/jpeg" ? jpegDimensions(bytes, view)
    : contentType === "image/webp" ? webpDimensions(bytes, view)
    : contentType === "image/gif" ? gifDimensions(bytes, view)
    : avifDimensions(bytes, view);

  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error(`Could not read pixel dimensions from the ${contentType} header.`);
  }
  return dimensions;
}

/** PNG: 8-byte signature, then an IHDR chunk whose first two big-endian
 *  uint32s are width and height. Fixed offsets 16 and 20. */
function pngDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.byteLength < 24) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  if (readAscii(bytes, 12, 4) !== "IHDR") return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** JPEG: a chain of `FF <marker> <big-endian length>` segments. The size lives
 *  in whichever Start Of Frame marker the encoder used — SOF0 through SOF15,
 *  minus the four in that range that are not frame headers (DHT `C4`, JPG
 *  `C8`, DAC `CC`). Height precedes width, both uint16, after a one-byte
 *  sample precision. */
function jpegDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1]!;
    /* Padding fill bytes and the standalone markers carry no length field. */
    if (marker === 0xff) { offset += 1; continue; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { offset += 2; continue; }
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    const isFrameHeader = marker >= 0xc0 && marker <= 0xcf
      && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrameHeader) {
      return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
    }
    /* `DA` is Start Of Scan: entropy-coded data follows and no SOF can appear
       after it, so a file that gets here has no readable frame header. */
    if (marker === 0xda) return null;
    offset += 2 + length;
  }
  return null;
}

/** WebP: a RIFF container whose single chunk is `VP8 ` (lossy), `VP8L`
 *  (lossless) or `VP8X` (extended). The three store their size differently,
 *  and all three are in use by the CDNs a composer will link to. */
function webpDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.byteLength < 30) return null;
  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WEBP") return null;

  const chunk = readAscii(bytes, 12, 4);
  if (chunk === "VP8 ") {
    /* Lossy: a 3-byte frame tag, the 3-byte start code `9D 01 2A`, then two
       little-endian uint16s whose low 14 bits are the dimensions. */
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (chunk === "VP8L") {
    /* Lossless: signature byte `2F`, then 14 bits of width-1 and 14 bits of
       height-1 packed little-endian across the next four bytes. */
    if (bytes[20] !== 0x2f) return null;
    const packed = view.getUint32(21, true);
    return { width: (packed & 0x3fff) + 1, height: ((packed >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    /* Extended: canvas size as two 24-bit little-endian values of size-1. */
    const width = (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) + 1;
    const height = (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) + 1;
    return { width, height };
  }
  return null;
}

/** GIF: `GIF87a`/`GIF89a`, then the logical screen descriptor's two
 *  little-endian uint16s. */
function gifDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.byteLength < 10) return null;
  const signature = readAscii(bytes, 0, 6);
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

/**
 * AVIF: an ISOBMFF file whose size lives in an `ispe` (image spatial extents)
 * box, nested four levels deep under `meta → iprp → ipco`.
 *
 * Walking that tree properly would be a hundred lines for two integers, so
 * this scans the header region for the `ispe` FourCC instead. The scan is
 * bounded to the first 64 KB and only runs after the `ftyp` box has confirmed
 * an AVIF brand, so the worst case of a false positive is a nonsense size that
 * the positive-dimensions check then rejects — not a wrong picture.
 */
function avifDimensions(bytes: Uint8Array, view: DataView): Dimensions | null {
  if (bytes.byteLength < 32 || readAscii(bytes, 4, 4) !== "ftyp") return null;
  const brand = readAscii(bytes, 8, 4);
  if (brand !== "avif" && brand !== "avis" && brand !== "mif1" && brand !== "msf1") return null;

  const limit = Math.min(bytes.byteLength - 16, 64 * 1024);
  for (let offset = 8; offset < limit; offset += 1) {
    if (readAscii(bytes, offset, 4) !== "ispe") continue;
    /* FourCC, then a 4-byte full-box version/flags, then width and height as
       big-endian uint32s. */
    return { width: view.getUint32(offset + 8), height: view.getUint32(offset + 12) };
  }
  return null;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  if (offset + length > bytes.byteLength) return "";
  let out = "";
  for (let index = 0; index < length; index += 1) out += String.fromCharCode(bytes[offset + index]!);
  return out;
}
