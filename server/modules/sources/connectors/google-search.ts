import "server-only";

import { googleSearchApiKey } from "@/server/core/config";
import { integrityHash } from "@/server/core/hash";
import type { ConnectorFetchResult, SourceConnector } from "../connector";

type GoogleResponse = {
  candidates?: Array<{
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
  }>;
  error?: { message?: string };
};

function queryFor(source: { config: unknown; name: string }): string | null {
  if (source.config && typeof source.config === "object" && "query" in source.config) {
    const query = (source.config as { query?: unknown }).query;
    if (typeof query === "string" && query.trim()) return query.trim();
  }
  return source.name.trim() || null;
}

function homepageFor(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/** Google Search Grounding only discovers cited public URLs. Its generated
 * prose is discarded; OpenAI owns classification and editorial drafting. */
export const googleSearchConnector: SourceConnector = {
  kind: "google_search",

  async fetch(source): Promise<ConnectorFetchResult> {
    const query = queryFor(source);
    if (!query) return { status: "failed", items: [], query: "", errorMessage: "Google Search source has no query" };

    let apiKey: string;
    try {
      apiKey = googleSearchApiKey();
    } catch (cause) {
      return { status: "failed", items: [], query, errorMessage: cause instanceof Error ? cause.message : String(cause) };
    }

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Discover current public reporting for this monitoring query: ${query}. Do not analyse, judge, or write an article. Return a terse source catalogue with citations.` }] }],
            tools: [{ google_search: {} }],
          }),
        },
      );
      const json = (await response.json()) as GoogleResponse;
      if (!response.ok) {
        return { status: "failed", items: [], query, httpStatus: response.status, errorMessage: json.error?.message ?? `Google Search returned HTTP ${response.status}` };
      }
      const metadata = json.candidates?.[0]?.groundingMetadata;
      const seen = new Set<string>();
      const items = (metadata?.groundingChunks ?? []).flatMap(({ web }) => {
        const url = web?.uri;
        const homepageUrl = url ? homepageFor(url) : null;
        if (!url || !homepageUrl || seen.has(url)) return [];
        seen.add(url);
        const publisher = new URL(homepageUrl).hostname.replace(/^www\./, "");
        return [{
          externalId: integrityHash(url).slice(0, 32),
          title: web?.title?.trim() || publisher,
          url,
          publisher: { name: publisher, homepageUrl },
        }];
      });
      return {
        status: items.length ? "success" : "partial",
        items,
        query: metadata?.webSearchQueries?.join(" | ") || query,
        ...(items.length ? {} : { errorMessage: "Google Search returned no cited public URLs" }),
      };
    } catch (cause) {
      return { status: "failed", items: [], query, errorMessage: cause instanceof Error ? cause.message : String(cause) };
    }
  },
};
