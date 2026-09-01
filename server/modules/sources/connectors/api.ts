import "server-only";

import { integrityHash } from "@/server/core/hash";
import { safeFetchText } from "@/server/core/safe-fetch";
import type { ConnectorFetchResult, FetchedItem, SourceConnector } from "../connector";

type ApiRecord = Record<string, unknown>;

/**
 * Small, deliberately boring adapter for a public official JSON endpoint.
 * The endpoint shape is data, not code: each source may declare an
 * `itemsPath` and field paths in its non-secret config. Credentials are not
 * accepted in source rows; authenticated APIs need a dedicated connector.
 */
export function parseOfficialApiResults(
  json: unknown,
  config: Record<string, unknown> = {},
): FetchedItem[] {
  const itemsPath = typeof config.itemsPath === "string" ? config.itemsPath : "items";
  const records = valueAtPath(json, itemsPath);
  if (!Array.isArray(records)) return [];

  const field = (record: ApiRecord, name: string, fallback: string): string | undefined => {
    const configured = typeof config[name] === "string" ? config[name] : fallback;
    const value = valueAtPath(record, configured);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };

  return records.flatMap((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const record = value as ApiRecord;
    const url = field(record, "urlPath", "url")
      ?? field(record, "linkPath", "link")
      ?? (typeof config.urlTemplate === "string" ? urlFromTemplate(record, config.urlTemplate) : undefined);
    const title = field(record, "titlePath", "title");
    if (!title || !url) return [];
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
      const published = field(record, "publishedAtPath", "publishedAt")
        ?? field(record, "datePath", "date");
      const publishedAt = published ? new Date(published) : undefined;
      return [{
        externalId: field(record, "idPath", "id") ?? integrityHash(url).slice(0, 32),
        title,
        url,
        discoveryUrl: url,
        excerpt: field(record, "excerptPath", "excerpt")
          ?? field(record, "summaryPath", "summary")
          ?? field(record, "descriptionPath", "description"),
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
        contentType: "application/json",
        discoveryMetadata: { provider: "official_api", rank: index + 1 },
      } satisfies FetchedItem];
    } catch {
      return [];
    }
  });
}

export const officialApiConnector: SourceConnector = {
  kind: "api",

  async fetch(source): Promise<ConnectorFetchResult> {
    if (!source.feedUrl) return { status: "failed", items: [], errorMessage: "Official API source has no endpoint URL" };
    const config = source.config && typeof source.config === "object"
      ? source.config as Record<string, unknown>
      : {};
    try {
      const response = await safeFetchText(source.feedUrl, {
        accept: "application/json",
        allowedContentTypes: [/^application\/json$/, /^application\/problem\+json$/, /^text\/plain$/],
        timeoutMs: 12_000,
        retryAttempts: 1,
        retryBackoffMs: 500,
        maxBytes: 3_000_000,
      });
      if (!response.ok) {
        return {
          status: "failed", httpStatus: response.status, items: [], rawBody: response.body,
          rawContentType: response.contentType ?? undefined,
          errorMessage: `Official API returned HTTP ${response.status}`,
        };
      }
      let json: unknown;
      try {
        json = JSON.parse(response.body);
      } catch {
        return {
          status: "partial", httpStatus: response.status, items: [], rawBody: response.body,
          rawContentType: response.contentType ?? undefined,
          errorMessage: "Official API returned malformed JSON",
        };
      }
      const items = parseOfficialApiResults(json, config);
      return {
        status: items.length ? "success" : "partial",
        httpStatus: response.status,
        items,
        rawBody: response.body,
        rawContentType: response.contentType ?? undefined,
        ...(items.length ? {} : { errorMessage: "Official API returned no usable article records" }),
      };
    } catch (cause) {
      return {
        status: "failed", items: [],
        errorMessage: cause instanceof Error ? cause.message : String(cause),
      };
    }
  },
};

function valueAtPath(value: unknown, path: string): unknown {
  if (!path.trim()) return value;
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || !(part in current)) return undefined;
    return (current as ApiRecord)[part];
  }, value);
}

function urlFromTemplate(record: ApiRecord, template: string): string | undefined {
  let missing = false;
  const url = template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_, path: string) => {
    const value = valueAtPath(record, path);
    if (typeof value !== "string" || !value.trim()) {
      missing = true;
      return "";
    }
    return encodeURIComponent(value.trim());
  });
  return missing ? undefined : url;
}
