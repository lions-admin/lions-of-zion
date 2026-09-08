import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The store a picture is written to, and the store a source capture is written
 * to, are not the same store — and the difference is not a convention this
 * file is protecting for tidiness.
 *
 * A Vercel Blob store's access mode is fixed **at the store**, not chosen per
 * object. `lions-of-zion-briefing-production` is `access: "private"` because it
 * holds raw source captures: operational evidence, never redistributed. An
 * editorial hero is the opposite — `next/image` fetches it from the reader's
 * own browser, so it must live in a store whose access is `public`.
 *
 * Both upload paths read `briefingBlobOptions()` until 2026-09-07. Production
 * run `chatgpt-daily-2026-09-07-1758-k7m4` therefore asked a private store for
 * public access and was refused:
 *
 *   Vercel Blob: Cannot use public access on a private store.
 *
 * by which point the run had already updated two publications and advanced the
 * homepage, leaving the Lebanon story leading News with no picture. The tests
 * below pin the binding, the access levels, the prefixes and the isolation
 * assertion, so that specific pairing cannot be reintroduced silently.
 */

const { put, head } = vi.hoisted(() => ({
  put: vi.fn(async (pathname: string, _body: unknown, options: Record<string, unknown>) => ({
    url: `https://editorial-media-test.public.blob.vercel-storage.com/${pathname}`,
    contentType: options.contentType,
  })),
  head: vi.fn(async (pathname: string) => ({
    url: `https://briefing-test.private.blob.vercel-storage.com/${pathname}`,
    contentType: "application/xml",
  })),
}));

vi.mock("@vercel/blob", () => ({ put, head }));

import { storeEditorialImage, storeRawBytes } from "@/server/core/blob";
import {
  assertBriefingResourceIsolation,
  briefingBlobOptions,
  briefingResourceFingerprints,
  editorialMediaBlobOptions,
} from "@/server/core/config";

const BRIEFING_STORE = "store_RUrSXEknDqbPmqn9private";
const EDITORIAL_STORE = "store_EDiToRiAlMeDiApub";
const ARCHIVE_STORE = "store_M70Ph8nWOJVAnaRn";

const ENV_KEYS = [
  "VERCEL",
  "APP_ENV",
  "VERCEL_ENV",
  "BRIEFING_BLOB_RESOURCE_ID",
  "EDITORIAL_MEDIA_BLOB_RESOURCE_ID",
  "OCTOBER7_BLOB_RESOURCE_ID",
  "BLOB_READ_WRITE_TOKEN",
  "BRIEFING_BLOB_READ_WRITE_TOKEN",
  "EDITORIAL_MEDIA_BLOB_READ_WRITE_TOKEN",
  "DATABASE_RESOURCE_ENV",
  "BLOB_RESOURCE_ENV",
  "QUEUE_RESOURCE_ENV",
  "SEARCH_RESOURCE_ENV",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  put.mockClear();
  head.mockClear();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

/** A deployed Vercel environment with both stores bound, as Production is. */
function deployedWithBothStores(environment = "production"): void {
  process.env.VERCEL = "1";
  process.env.APP_ENV = environment;
  process.env.BRIEFING_BLOB_RESOURCE_ID = BRIEFING_STORE;
  process.env.EDITORIAL_MEDIA_BLOB_RESOURCE_ID = EDITORIAL_STORE;
  process.env.OCTOBER7_BLOB_RESOURCE_ID = ARCHIVE_STORE;
  for (const label of ["DATABASE", "BLOB", "QUEUE", "SEARCH"]) {
    process.env[`${label}_RESOURCE_ENV`] = environment;
  }
}

const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
const optionsOfLastPut = () => put.mock.calls.at(-1)![2] as Record<string, unknown>;

describe("editorial media Blob binding", () => {
  describe("access level and store selection", () => {
    it("writes a raw briefing capture privately, to the briefing store", async () => {
      deployedWithBothStores();
      await storeRawBytes("briefing/raw/example.html", "<html></html>", "text/html");

      const options = optionsOfLastPut();
      expect(options.access).toBe("private");
      expect(options.storeId).toBe(BRIEFING_STORE);
      expect(options.storeId).not.toBe(EDITORIAL_STORE);
    });

    it("writes an editorial image publicly, to the editorial-media store", async () => {
      deployedWithBothStores();
      await storeEditorialImage("publications/media/abc123.png", png(), "image/png");

      const options = optionsOfLastPut();
      expect(options.access).toBe("public");
      expect(options.storeId).toBe(EDITORIAL_STORE);
    });

    /* The exact Production failure of 2026-09-07, as an assertion rather than a
       stack trace: whatever else changes, the private capture store must never
       be the store a public upload is pointed at. */
    it("never passes the private briefing store to the public image path", async () => {
      deployedWithBothStores();
      await storeEditorialImage("publications/media/abc123.png", png(), "image/png");

      const options = optionsOfLastPut();
      expect(options.access).toBe("public");
      expect(options.storeId).not.toBe(BRIEFING_STORE);
      expect(options.storeId).not.toBe(ARCHIVE_STORE);
    });

    it("keeps the two bindings distinct in a deployed environment", () => {
      deployedWithBothStores();
      expect(briefingBlobOptions()).toEqual({ storeId: BRIEFING_STORE });
      expect(editorialMediaBlobOptions()).toEqual({ storeId: EDITORIAL_STORE });
      expect(editorialMediaBlobOptions()).not.toEqual(briefingBlobOptions());
    });

    /* Outside Vercel there is no OIDC token, so both fall back to an explicit
       token — and the editorial one must not fall back to the *briefing*
       token, whose store is private and would reproduce the failure locally. */
    it("falls back to the public generic token off-Vercel, never the briefing token", () => {
      delete process.env.VERCEL;
      process.env.BRIEFING_BLOB_RESOURCE_ID = BRIEFING_STORE;
      process.env.EDITORIAL_MEDIA_BLOB_RESOURCE_ID = EDITORIAL_STORE;
      process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_public";
      process.env.BRIEFING_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_private_briefing";
      delete process.env.EDITORIAL_MEDIA_BLOB_READ_WRITE_TOKEN;

      expect(editorialMediaBlobOptions()).toEqual({ token: "vercel_blob_rw_public" });
      expect(briefingBlobOptions()).toEqual({ token: "vercel_blob_rw_private_briefing" });
    });

    it("prefers a dedicated editorial-media token when one is configured", () => {
      delete process.env.VERCEL;
      process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_public";
      process.env.EDITORIAL_MEDIA_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_editorial";

      expect(editorialMediaBlobOptions()).toEqual({ token: "vercel_blob_rw_editorial" });
    });
  });

  describe("prefix isolation", () => {
    it("refuses an editorial image outside publications/media/", async () => {
      deployedWithBothStores();
      await expect(storeEditorialImage("briefing/raw/sneaky.png", png(), "image/png"))
        .rejects.toThrow(/publications\/media/);
      await expect(storeEditorialImage("elsewhere/x.png", png(), "image/png"))
        .rejects.toThrow(/publications\/media/);
      expect(put).not.toHaveBeenCalled();
    });

    it("refuses a raw capture outside briefing/raw/", async () => {
      deployedWithBothStores();
      await expect(storeRawBytes("publications/media/x.html", "<html></html>", "text/html"))
        .rejects.toThrow(/briefing\/raw/);
      expect(put).not.toHaveBeenCalled();
    });
  });

  describe("idempotency", () => {
    /* The pathname is the sha256 of the bytes, so an overwrite can only ever
       replace an object with byte-identical content. That is what turns a
       retried run into a no-op instead of a BlobAlreadyExistsError that would
       cost the publication its picture. */
    it("lets a retry overwrite the same content-addressed object", async () => {
      deployedWithBothStores();
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const hash = createHash("sha256").update(bytes).digest("hex");
      const pathname = `publications/media/${hash}.png`;

      const first = await storeEditorialImage(pathname, bytes.buffer as ArrayBuffer, "image/png");
      const second = await storeEditorialImage(pathname, bytes.buffer as ArrayBuffer, "image/png");

      expect(first.url).toBe(second.url);
      for (const call of put.mock.calls) {
        expect(call[2]).toMatchObject({ allowOverwrite: true, addRandomSuffix: false });
      }
    });

    it("keeps the raw capture path refusing an overwrite", async () => {
      deployedWithBothStores();
      await storeRawBytes("briefing/raw/example.html", "<html></html>", "text/html");
      expect(optionsOfLastPut()).toMatchObject({ allowOverwrite: false, addRandomSuffix: false });
    });

    /* Production, 2026-09-07 22:30 → 09-08 04:13 UTC. Israel Hayom served
       byte-identical feed content for six hours; the object for those bytes
       was already in the store with no `source_fetch` row pointing at it, so
       every collection window re-derived the same content-addressed path,
       `put()` refused it, and twelve jobs burned five attempts each into
       quarantine while the feed was healthy. An existing object at a
       content-addressed path *is* the bytes about to be stored. */
    it("returns the existing object when a content-addressed raw path is already taken", async () => {
      deployedWithBothStores();
      put.mockRejectedValueOnce(new Error(
        "Vercel Blob: This blob already exists, use `allowOverwrite: true` if you want to overwrite it. Or `addRandomSuffix: true` to generate a unique filename.",
      ));
      const pathname = "briefing/raw/source-id/6a731b4f61b7346d2cb246b7b2d8e8024e3153db884695ed59f396aaacbba29e.xml";

      const stored = await storeRawBytes(pathname, "<rss/>", "application/xml");

      expect(stored.url).toBe(`https://briefing-test.private.blob.vercel-storage.com/${pathname}`);
      expect(put).toHaveBeenCalledTimes(1);
      expect(optionsOfLastPut()).toMatchObject({ allowOverwrite: false, addRandomSuffix: false });
      expect(head).toHaveBeenCalledWith(pathname, { storeId: BRIEFING_STORE });
    });

    it("still surfaces every other raw storage failure", async () => {
      deployedWithBothStores();
      put.mockRejectedValueOnce(new Error("Vercel Blob: Access denied, please provide a valid token for this resource."));
      await expect(storeRawBytes("briefing/raw/example.html", "<html></html>", "text/html"))
        .rejects.toThrow(/Access denied/);
      expect(head).not.toHaveBeenCalled();
    });

    it("passes the caller's content type through unchanged", async () => {
      deployedWithBothStores();
      await storeEditorialImage("publications/media/a.webp", png(), "image/webp");
      expect(optionsOfLastPut().contentType).toBe("image/webp");
    });
  });

  describe("resource isolation assertion", () => {
    it("passes when all three stores are distinct", () => {
      deployedWithBothStores();
      expect(() => assertBriefingResourceIsolation()).not.toThrow();
    });

    it("refuses a deployment whose editorial media points at the private briefing store", () => {
      deployedWithBothStores();
      process.env.EDITORIAL_MEDIA_BLOB_RESOURCE_ID = BRIEFING_STORE;
      expect(() => assertBriefingResourceIsolation())
        .toThrow(/separate from the private briefing capture store/);
    });

    it("refuses a deployment whose editorial media points at the October 7 archive", () => {
      deployedWithBothStores();
      process.env.EDITORIAL_MEDIA_BLOB_RESOURCE_ID = ARCHIVE_STORE;
      expect(() => assertBriefingResourceIsolation())
        .toThrow(/separate from the October 7 archive store/);
    });

    it("refuses a deployment with no editorial-media binding at all", () => {
      deployedWithBothStores();
      delete process.env.EDITORIAL_MEDIA_BLOB_RESOURCE_ID;
      expect(() => assertBriefingResourceIsolation()).toThrow(/EDITORIAL_MEDIA_BLOB_RESOURCE_ID/);
    });

    it("still refuses briefing and archive sharing a store", () => {
      deployedWithBothStores();
      process.env.OCTOBER7_BLOB_RESOURCE_ID = BRIEFING_STORE;
      expect(() => assertBriefingResourceIsolation())
        .toThrow(/Briefing storage must be separate from the October 7 archive store/);
    });
  });

  describe("diagnostics never leak the binding", () => {
    it("reports the editorial-media store as a one-way fingerprint only", () => {
      deployedWithBothStores();
      const fingerprints = briefingResourceFingerprints();
      const value = fingerprints.editorialMediaBlob;

      expect(value).toMatch(/^[0-9a-f]{16}$/);
      expect(value).not.toBe(EDITORIAL_STORE);
      expect(JSON.stringify(fingerprints)).not.toContain(EDITORIAL_STORE);
      expect(JSON.stringify(fingerprints)).not.toContain(BRIEFING_STORE);
    });

    it("distinguishes the two stores without revealing either", () => {
      deployedWithBothStores();
      const fingerprints = briefingResourceFingerprints();
      expect(fingerprints.editorialMediaBlob).not.toBe(fingerprints.briefingBlob);
      expect(fingerprints.editorialMediaBlob).not.toBe(fingerprints.october7Blob);
    });

    it("reports null rather than a placeholder when nothing is bound", () => {
      delete process.env.EDITORIAL_MEDIA_BLOB_RESOURCE_ID;
      expect(briefingResourceFingerprints().editorialMediaBlob).toBeNull();
    });
  });
});
