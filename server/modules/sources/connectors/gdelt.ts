import "server-only";

import { integrityHash } from "@/server/core/hash";
import { safeFetchText } from "@/server/core/safe-fetch";
import type { ConnectorFetchResult, FetchedItem, SourceConnector } from "../connector";

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
  context?: string;
  snippet?: string;
};

type GdeltResponse = { articles?: GdeltArticle[] };

export function parseGdeltResults(json: GdeltResponse): FetchedItem[] {
  const seen = new Set<string>();
  return (json.articles ?? []).flatMap((article, index) => {
    if (!article.url || seen.has(article.url)) return [];
    let parsed: URL;
    try {
      parsed = new URL(article.url);
    } catch {
      return [];
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
    seen.add(article.url);
    const domain = (article.domain || parsed.hostname).replace(/^www\./, "").toLowerCase();
    const title = article.title?.trim() || domain;
    const excerpt = (article.context || article.snippet)?.replace(/\s+/g, " ").trim();
    return [{
      externalId: integrityHash(article.url).slice(0, 32),
      title,
      url: article.url,
      discoveryUrl: article.url,
      excerpt: excerpt || undefined,
      publishedAt: gdeltDate(article.seendate),
      publisher: { name: domain, homepageUrl: `${parsed.protocol}//${parsed.host}` },
      contentType: "text/html",
      discoveryMetadata: {
        provider: "gdelt_context_2",
        rank: index + 1,
        sourceLanguage: article.language ?? null,
        sourceCountry: article.sourcecountry ?? null,
      },
    }];
  });
}

export const gdeltConnector: SourceConnector = {
  kind: "gdelt",

  async fetch(source): Promise<ConnectorFetchResult> {
    const config = source.config && typeof source.config === "object"
      ? source.config as Record<string, unknown>
      : {};
    const query = typeof config.query === "string" ? config.query.trim() : "";
    if (!query) return { status: "failed", items: [], errorMessage: "GDELT source has no query" };

    const maxRecords = boundedInteger(config.maxRecords, 100, 10, 250);
    const timespan = typeof config.timespan === "string" && /^[1-9]\d*[hdwm]$/i.test(config.timespan)
      ? config.timespan
      : "24h";
    const endpoint = new URL("https://api.gdeltproject.org/api/v2/context/context");
    endpoint.search = new URLSearchParams({
      query,
      mode: "artlist",
      maxrecords: String(maxRecords),
      format: "json",
      timespan,
      sort: "datedesc",
    }).toString();

    try {
      const response = await safeFetchText(endpoint.toString(), {
        accept: "application/json",
        allowedContentTypes: [/^application\/(json|problem\+json)$/, /^text\/plain$/],
        timeoutMs: 20_000,
        maxBytes: 3_000_000,
      });
      if (!response.ok) {
        return {
          status: "failed",
          httpStatus: response.status,
          items: [],
          query,
          rawBody: response.body,
          rawContentType: response.contentType ?? undefined,
          errorMessage: `GDELT returned HTTP ${response.status}`,
        };
      }
      let json: GdeltResponse;
      try {
        json = JSON.parse(response.body) as GdeltResponse;
      } catch {
        return {
          status: "partial",
          httpStatus: response.status,
          items: [],
          query,
          rawBody: response.body,
          rawContentType: response.contentType ?? undefined,
          errorMessage: "GDELT returned malformed JSON",
        };
      }
      const items = parseGdeltResults(json);
      return {
        status: items.length ? "success" : "partial",
        httpStatus: response.status,
        items,
        query,
        rawBody: response.body,
        rawContentType: response.contentType ?? undefined,
        ...(items.length ? {} : { errorMessage: "GDELT returned no direct publisher results" }),
      };
    } catch (cause) {
      return {
        status: "failed",
        items: [],
        query,
        errorMessage: cause instanceof Error ? cause.message : String(cause),
      };
    }
  },
};

function gdeltDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const normalized = /^\d{8}T\d{6}Z$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`
    : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
