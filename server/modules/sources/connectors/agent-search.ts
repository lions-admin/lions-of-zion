import "server-only";

import { googleAgentSearchConfig, isProduction } from "@/server/core/config";
import { googleCloudAccessToken } from "@/server/core/google-cloud-auth";
import { integrityHash } from "@/server/core/hash";
import { db } from "@/server/db/client";
import {
  bucketForSubject,
  enforceRateLimit,
  OUTBOUND_SOURCE_DOMAIN,
  OUTBOUND_SOURCE_GLOBAL,
} from "@/server/core/rate-limit";
import type { ConnectorFetchResult, FetchedItem, SourceConnector } from "../connector";

type SearchDocument = {
  id?: string;
  name?: string;
  derivedStructData?: Record<string, unknown>;
  structData?: Record<string, unknown>;
};

type SearchResponse = {
  results?: Array<{ id?: string; document?: SearchDocument }>;
  totalSize?: number;
  attributionToken?: string;
  error?: { message?: string };
};

function sourceConfig(source: { config: unknown }): { query: string | null; allowedDomains: string[] } {
  if (!source.config || typeof source.config !== "object") return { query: null, allowedDomains: [] };
  const config = source.config as Record<string, unknown>;
  const query = config.query;
  const allowedDomains = Array.isArray(config.allowedDomains)
    ? config.allowedDomains.filter((value): value is string => typeof value === "string" && /^[a-z0-9.-]+$/i.test(value)).map((value) => value.toLowerCase())
    : [];
  return { query: typeof query === "string" && query.trim() ? query.trim() : null, allowedDomains };
}

/** Maps Agent Search results to original-publisher candidates. Search summary
 * prose is intentionally ignored; only document fields and snippets survive. */
export function parseAgentSearchResults(json: SearchResponse, allowedDomains: readonly string[] = []): FetchedItem[] {
  const seen = new Set<string>();
  return (json.results ?? []).flatMap((result, index) => {
    const document = result.document;
    const data = { ...(document?.structData ?? {}), ...(document?.derivedStructData ?? {}) };
    const url = firstString(data.link, data.url, data.uri);
    if (!url || seen.has(url)) return [];
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return [];
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (allowedDomains.length && !allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))) return [];
    seen.add(url);
    const title = cleanText(firstString(data.title, data.htmlTitle)) || parsed.hostname;
    const snippets = Array.isArray(data.snippets) ? data.snippets : [];
    const firstSnippet = snippets.find((value) => value && typeof value === "object") as
      | Record<string, unknown>
      | undefined;
    const excerpt = cleanText(firstString(
      firstSnippet?.snippet,
      firstSnippet?.text,
      data.description,
    ));
    const publishedAt = dateValue(firstString(data.datePublished, data.publishedAt, data.publish_time));
    const homepageUrl = `${parsed.protocol}//${parsed.host}`;
    const publisherName = cleanText(firstString(data.publisher, data.siteName)) || parsed.hostname.replace(/^www\./, "");
    return [{
      externalId: result.id || document?.id || integrityHash(url).slice(0, 32),
      title,
      url,
      discoveryUrl: url,
      excerpt: excerpt || undefined,
      publishedAt,
      publisher: { name: publisherName, homepageUrl },
      contentType: "text/html",
      discoveryMetadata: {
        provider: "google_agent_search",
        documentName: document?.name ?? null,
        rank: index + 1,
        snippetStatus: firstString(firstSnippet?.snippetStatus) ?? null,
      },
    }];
  });
}

export const agentSearchConnector: SourceConnector = {
  kind: "agent_search",

  async fetch(source): Promise<ConnectorFetchResult> {
    const { query, allowedDomains } = sourceConfig(source);
    if (!query) {
      return { status: "failed", items: [], errorMessage: "Agent Search source has no query" };
    }
    try {
      const config = googleAgentSearchConfig();
      if (isProduction()) {
        await enforceRateLimit(
          db(),
          bucketForSubject("outbound-source-global", "all"),
          OUTBOUND_SOURCE_GLOBAL,
        );
        await enforceRateLimit(
          db(),
          bucketForSubject("outbound-source-domain", "discoveryengine.googleapis.com"),
          OUTBOUND_SOURCE_DOMAIN,
        );
      }
      const accessToken = await googleCloudAccessToken(config);
      const { response, rawBody } = await requestAgentSearch(config, accessToken, query);
      const json = parseJson(rawBody);
      if (!response.ok) {
        return {
          status: "failed",
          httpStatus: response.status,
          items: [],
          query,
          rawBody,
          rawContentType: "application/json",
          errorMessage: json.error?.message ?? `Agent Search returned HTTP ${response.status}`,
        };
      }
      const items = parseAgentSearchResults(json, allowedDomains);
      return {
        status: items.length ? "success" : "partial",
        httpStatus: response.status,
        items,
        query,
        rawBody,
        rawContentType: "application/json",
        ...(items.length ? {} : { errorMessage: "Agent Search returned no direct publisher results" }),
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

/** Google discovery is a paid provider, so it gets one retry only, and only
 * for transport or provider-declared transient failures. */
export function shouldRetryAgentSearch(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function requestAgentSearch(
  config: ReturnType<typeof googleAgentSearchConfig>,
  accessToken: string,
  query: string,
): Promise<{ response: Response; rawBody: string }> {
  const endpoint = `https://discoveryengine.googleapis.com/v1/${config.servingConfig}:search`;
  const body = JSON.stringify({
    query,
    pageSize: 50,
    contentSearchSpec: { snippetSpec: { returnSnippet: true } },
    spellCorrectionSpec: { mode: "AUTO" },
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "x-goog-user-project": config.project,
        },
        body,
      });
      const rawBody = await response.text();
      if (!shouldRetryAgentSearch(response.status) || attempt === 1) return { response, rawBody };
    } catch (cause) {
      if (attempt === 1) throw cause;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Google Agent Search request failed after retry.");
}

function parseJson(body: string): SearchResponse {
  try {
    return JSON.parse(body) as SearchResponse;
  } catch {
    return {};
  }
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim();
}

function cleanText(value?: string): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function dateValue(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
