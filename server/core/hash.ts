/**
 * Two hash functions, split by purpose rather than by preference.
 *
 * `changeHash` answers "is this different from what we indexed?" — md5 is
 * ample, and it is what a generated Postgres column can compute, since
 * `convert_to()` is STABLE and a generation expression must be IMMUTABLE.
 *
 * `integrityHash` answers "are these the bytes we fetched?" — that is a
 * provenance claim someone may one day rely on, so it is sha256 and it is
 * written by the application rather than generated.
 */

import { createHash } from "node:crypto";

export const changeHash = (...parts: (string | null | undefined)[]): string =>
  createHash("md5").update(parts.map((p) => p ?? "").join("\n"), "utf8").digest("hex");

export const integrityHash = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");
