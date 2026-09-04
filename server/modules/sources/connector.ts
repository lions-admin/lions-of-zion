import "server-only";

/**
 * What every ingestion source implements, and nothing more.
 *
 * A connector's only job is to turn a source's configuration into a batch of
 * candidate items and, where the format allows it, the raw body those items
 * were parsed from. It does not touch the database, does not decide what is
 * new, and does not write evidence — `ingestSource()` does all of that, so a
 * connector can be tested against a fixture with no database at all.
 */

import type { Source } from "@/server/db/schema";
import type { SourceKind } from "@/server/contracts/enums";

export type FetchedItem = {
  /** Stable across re-fetches — an RSS guid, a post id, or (failing that) a
   *  hash the connector derives itself. This is the only thing standing
   *  between "checked this feed again" and "duplicated everything in it". */
  externalId: string;
  title: string;
  url?: string;
  discoveryUrl?: string;
  canonicalUrl?: string;
  excerpt?: string;
  publishedAt?: Date;
  publisher?: { name: string; homepageUrl: string };
  contentType?: string;
  discoveryMetadata?: Record<string, unknown>;
};

export type ConnectorFetchResult = {
  status: "success" | "partial" | "failed";
  httpStatus?: number;
  items: FetchedItem[];
  /** The full response body, stored to Blob once per fetch rather than once
   *  per item. Absent on a `failed` fetch that never got a body. */
  rawBody?: string;
  /** Actual media type returned by the source, without parameters. */
  rawContentType?: string;
  /** Required when `status` is `failed` or `partial` — the same rule the
   *  `source_fetch` table enforces with a CHECK. */
  errorMessage?: string;
  query?: string;
  /** What this fetch cost, when the connector can price its own queries from
   *  configuration. A per-query billed estimate recorded at fetch time — not
   *  a provider billing feed. Absent for free connectors. */
  actualCostUsd?: number;
};

export interface SourceConnector {
  kind: SourceKind;
  fetch(source: Source): Promise<ConnectorFetchResult>;
}
