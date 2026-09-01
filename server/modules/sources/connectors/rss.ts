import "server-only";

/**
 * RSS 2.0 and Atom, minimally. Both formats are parsed to a common shape
 * rather than picking one — real feeds are inconsistently one or the other,
 * and a source's `kind` should not have to know which.
 *
 * No network mocking here on purpose: `fetch()` is called directly, and the
 * test fixture feeds a static XML string straight into `parseFeed()`, which
 * is the part that actually has behaviour worth testing.
 */

import { XMLParser } from "fast-xml-parser";
import { integrityHash } from "@/server/core/hash";
import { safeFetchText } from "@/server/core/safe-fetch";
import type { ConnectorFetchResult, FetchedItem, SourceConnector } from "../connector";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** fast-xml-parser represents a leaf with attributes as `{ "#text": ... }`
 *  and a plain leaf as the scalar itself — this normalises both. */
function textOf(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "object" && "#text" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)["#text"]);
  }
  return String(value);
}

function externalIdFor(guid: unknown, link: string | undefined, title: string): string {
  return textOf(guid) ?? link ?? integrityHash(title).slice(0, 32);
}

function dateOf(value: unknown): Date | undefined {
  const text = textOf(value);
  if (!text) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** What fast-xml-parser hands back: arbitrarily nested, no fixed shape. A
 *  named type documents intent better than `any` while staying just as
 *  permissive about structure the RSS/Atom spec does not actually fix. */
type XmlNode = Record<string, unknown>;

const fieldOf = (node: unknown, key: string): unknown =>
  node && typeof node === "object" ? (node as XmlNode)[key] : undefined;

/** Exported for the RSS connector's own tests, which feed fixture XML
 *  straight in rather than standing up an HTTP server. */
export function parseFeed(xml: string): FetchedItem[] {
  const doc = parser.parse(xml) as XmlNode;

  const channel = fieldOf(doc.rss, "channel");
  if (channel) {
    return asArray(fieldOf(channel, "item")).map((item) => {
      const link = textOf(fieldOf(item, "link"));
      const title = textOf(fieldOf(item, "title")) ?? "(untitled)";
      return {
        externalId: externalIdFor(fieldOf(item, "guid"), link, title),
        title,
        url: link,
        excerpt: textOf(fieldOf(item, "description")),
        publishedAt: dateOf(fieldOf(item, "pubDate")),
      };
    });
  }

  // RSS 1.0 uses RDF as its document root. Deutsche Welle publishes this
  // variant; accepting it here prevents a syntactically valid feed from being
  // treated as an empty response merely because it is not RSS 2.0 or Atom.
  const rdf = fieldOf(doc, "rdf:RDF");
  if (rdf) {
    return asArray(fieldOf(rdf, "item")).map((item) => {
      const link = textOf(fieldOf(item, "link"));
      const title = textOf(fieldOf(item, "title")) ?? "(untitled)";
      return {
        externalId: textOf(fieldOf(item, "dwsyn:contentID"))
          ?? (fieldOf(item, "@_rdf:about") as string | undefined)
          ?? link
          ?? integrityHash(title).slice(0, 32),
        title,
        url: link,
        excerpt: textOf(fieldOf(item, "description")),
        publishedAt: dateOf(fieldOf(item, "dc:date")),
      };
    });
  }

  const feed = doc.feed;
  if (feed) {
    return asArray(fieldOf(feed, "entry")).map((entry) => {
      const linkField = asArray(fieldOf(entry, "link")).at(0);
      const link = (fieldOf(linkField, "@_href") as string | undefined) ?? textOf(linkField);
      const title = textOf(fieldOf(entry, "title")) ?? "(untitled)";
      return {
        externalId: textOf(fieldOf(entry, "id")) ?? link ?? integrityHash(title).slice(0, 32),
        title,
        url: link,
        excerpt: textOf(fieldOf(entry, "summary")) ?? textOf(fieldOf(entry, "content")),
        publishedAt: dateOf(fieldOf(entry, "published") ?? fieldOf(entry, "updated")),
      };
    });
  }

  return [];
}

export const rssConnector: SourceConnector = {
  kind: "rss",

  async fetch(source): Promise<ConnectorFetchResult> {
    if (!source.feedUrl) {
      return { status: "failed", items: [], errorMessage: "Source has no feed_url configured" };
    }

    let response: Awaited<ReturnType<typeof safeFetchText>>;
    try {
      response = await safeFetchText(source.feedUrl, {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        allowedContentTypes: [
          /^application\/(rss\+xml|atom\+xml|xml)$/,
          /^text\/(xml|plain)$/,
        ],
        timeoutMs: 15_000,
        retryAttempts: 2,
        retryBackoffMs: 300,
        maxBytes: 2_000_000,
      });
    } catch (cause) {
      return {
        status: "failed",
        items: [],
        errorMessage: cause instanceof Error ? cause.message : String(cause),
      };
    }

    const body = response.body;
    if (!response.ok) {
      return {
        status: "failed",
        httpStatus: response.status,
        items: [],
        rawBody: body,
        rawContentType: response.contentType ?? undefined,
        errorMessage: `Feed returned HTTP ${response.status}`,
      };
    }

    try {
      const items = parseFeed(body);
      return {
        status: items.length ? "success" : "partial",
        httpStatus: response.status,
        items,
        rawBody: body,
        rawContentType: response.contentType ?? undefined,
        ...(items.length ? {} : { errorMessage: "Feed contained no RSS or Atom entries" }),
      };
    } catch (cause) {
      return {
        status: "partial",
        httpStatus: response.status,
        items: [],
        rawBody: body,
        rawContentType: response.contentType ?? undefined,
        errorMessage: `Could not parse feed: ${cause instanceof Error ? cause.message : String(cause)}`,
      };
    }
  },
};
