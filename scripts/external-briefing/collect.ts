/**
 * Step 1 — collect candidate material from the public catalog.
 *
 * Deliberately standalone: `server/modules/sources/connectors/rss.ts` cannot
 * be imported (this script runs outside the Next.js app, and the layering
 * rule for `server/**` restricts this script to four read-only files), so the
 * RSS/RDF/Atom parsing here is a reimplementation of that connector's
 * `parseFeed()`, adapted to return the fields this script needs. The
 * fetch/timeout/worker-pool/user-agent convention mirrors
 * `scripts/check-briefing-feed-connectivity.ts`, which already polls the same
 * candidate list.
 */

import { XMLParser } from "fast-xml-parser";
import {
  BRIEFING_OFFICIAL_API_CANDIDATES,
  BRIEFING_RSS_CANDIDATES,
  sourceCategoryForDomain,
  type BriefingSourceCategory,
} from "@/server/modules/sources/catalog";
import type { CollectedItem } from "./types";

const USER_AGENT = "LionsOfZion-ExternalBriefingComposer/1.0 (+https://lionsofzion.io/methodology)";
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 5;
const RECENCY_WINDOW_HOURS = 30;
/** Tolerate a little clock skew between a feed's own timestamp and ours,
 * rather than dropping an item published a few minutes "in the future". */
const FUTURE_GRACE_MS = 2 * 60 * 60 * 1000;
const EXCERPT_MIN = 200;
const EXCERPT_MAX = 20_000;

/* ── RSS/RDF/Atom parsing, adapted from server/modules/sources/connectors/rss.ts ── */

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

type XmlNode = Record<string, unknown>;

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

const fieldOf = (node: unknown, key: string): unknown =>
  node && typeof node === "object" ? (node as XmlNode)[key] : undefined;

function dateOf(value: unknown): Date | undefined {
  const text = textOf(value);
  if (!text) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

type RawFeedItem = {
  title: string;
  url: string | undefined;
  excerpt: string | undefined;
  publishedAt: Date | undefined;
};

function parseFeed(xml: string): RawFeedItem[] {
  const doc = xmlParser.parse(xml) as XmlNode;

  const channel = fieldOf(doc.rss, "channel");
  if (channel) {
    return asArray(fieldOf(channel, "item")).map((item) => ({
      title: textOf(fieldOf(item, "title")) ?? "(untitled)",
      url: textOf(fieldOf(item, "link")),
      excerpt: textOf(fieldOf(item, "description")),
      publishedAt: dateOf(fieldOf(item, "pubDate")),
    }));
  }

  // RSS 1.0 uses RDF as its document root (Deutsche Welle publishes this
  // variant, though it is not in BRIEFING_RSS_CANDIDATES today).
  const rdf = fieldOf(doc, "rdf:RDF");
  if (rdf) {
    return asArray(fieldOf(rdf, "item")).map((item) => ({
      title: textOf(fieldOf(item, "title")) ?? "(untitled)",
      url: textOf(fieldOf(item, "link")),
      excerpt: textOf(fieldOf(item, "description")),
      publishedAt: dateOf(fieldOf(item, "dc:date")),
    }));
  }

  const feed = doc.feed;
  if (feed) {
    return asArray(fieldOf(feed, "entry")).map((entry) => {
      const linkField = asArray(fieldOf(entry, "link")).at(0);
      const url = (fieldOf(linkField, "@_href") as string | undefined) ?? textOf(linkField);
      return {
        title: textOf(fieldOf(entry, "title")) ?? "(untitled)",
        url,
        excerpt: textOf(fieldOf(entry, "summary")) ?? textOf(fieldOf(entry, "content")),
        publishedAt: dateOf(fieldOf(entry, "published") ?? fieldOf(entry, "updated")),
      };
    });
  }

  return [];
}

/* ── HTML/entity cleanup ───────────────────────────────────────────────── */

function cleanExcerpt(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/* ── Dot-path JSON extraction, for BRIEFING_OFFICIAL_API_CANDIDATES ──────── */

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function fillTemplate(template: string, item: unknown): string {
  return template.replace(/\{([^}]+)\}/g, (_match, path: string) => {
    const value = getPath(item, path);
    return value == null ? "" : String(value);
  });
}

/* ── Fetch + concurrency ──────────────────────────────────────────────── */

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json",
        "user-agent": USER_AGENT,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function runPool<T>(items: readonly T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function runner(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      await worker(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, runner));
}

function isRecent(date: Date | undefined, now: Date): date is Date {
  if (!date || Number.isNaN(date.getTime())) return false;
  const ageMs = now.getTime() - date.getTime();
  return ageMs <= RECENCY_WINDOW_HOURS * 60 * 60 * 1000 && ageMs >= -FUTURE_GRACE_MS;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/* ── Collection ────────────────────────────────────────────────────────── */

export async function collectItems(now: Date = new Date()): Promise<CollectedItem[]> {
  const items: CollectedItem[] = [];
  const counters = new Map<string, number>();
  const nextCitationKey = (slug: string): string => {
    const n = counters.get(slug) ?? 0;
    counters.set(slug, n + 1);
    return `${slug}-${n}`;
  };

  await runPool(BRIEFING_RSS_CANDIDATES, async (source) => {
    let xml: string;
    try {
      xml = await fetchText(source.feedUrl);
    } catch (cause) {
      console.error(`[collect] ${source.slug}: fetch failed — ${cause instanceof Error ? cause.message : String(cause)}`);
      return;
    }

    let parsed: RawFeedItem[];
    try {
      parsed = parseFeed(xml);
    } catch (cause) {
      console.error(`[collect] ${source.slug}: parse failed — ${cause instanceof Error ? cause.message : String(cause)}`);
      return;
    }

    for (const raw of parsed) {
      if (!raw.url) continue;
      if (!isRecent(raw.publishedAt, now)) continue;
      const excerpt = cleanExcerpt(raw.excerpt).slice(0, EXCERPT_MAX);
      if (excerpt.length < EXCERPT_MIN) continue;

      const category: BriefingSourceCategory | null =
        (source.category as BriefingSourceCategory | undefined) ?? sourceCategoryForDomain(hostnameOf(raw.url));

      items.push({
        citationKey: nextCitationKey(source.slug),
        publisherKey: source.slug,
        publisherName: source.name,
        publisherHomepageUrl: source.homepageUrl,
        publisherLanguage: source.language,
        publisherCountry: source.country ?? null,
        title: raw.title,
        url: raw.url,
        canonicalUrl: null,
        publishedAt: raw.publishedAt.toISOString(),
        excerpt,
        language: source.language,
        category,
        official: category === "official_israeli",
      });
    }
  });

  await runPool(BRIEFING_OFFICIAL_API_CANDIDATES, async (source) => {
    let text: string;
    try {
      text = await fetchText(source.feedUrl);
    } catch (cause) {
      console.error(`[collect] ${source.slug}: fetch failed — ${cause instanceof Error ? cause.message : String(cause)}`);
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (cause) {
      console.error(`[collect] ${source.slug}: JSON parse failed — ${cause instanceof Error ? cause.message : String(cause)}`);
      return;
    }

    const config = source.config;
    const rawItems = getPath(json, config.itemsPath);
    if (!Array.isArray(rawItems)) {
      console.error(`[collect] ${source.slug}: itemsPath "${config.itemsPath}" did not resolve to an array`);
      return;
    }

    for (const item of rawItems) {
      const title = getPath(item, config.titlePath);
      if (typeof title !== "string" || !title.trim()) continue;

      const publishedAtRaw = getPath(item, config.publishedAtPath);
      const publishedAt = typeof publishedAtRaw === "string" ? new Date(publishedAtRaw) : undefined;
      if (!isRecent(publishedAt, now)) continue;

      const excerptRaw = getPath(item, config.excerptPath);
      const excerpt = cleanExcerpt(typeof excerptRaw === "string" ? excerptRaw : undefined).slice(0, EXCERPT_MAX);
      if (excerpt.length < EXCERPT_MIN) continue;

      let url: string;
      try {
        url = new URL(fillTemplate(config.urlTemplate, item)).toString();
      } catch {
        continue;
      }

      const category: BriefingSourceCategory | null =
        (source.category as BriefingSourceCategory | undefined) ?? sourceCategoryForDomain(hostnameOf(url));

      items.push({
        citationKey: nextCitationKey(source.slug),
        publisherKey: source.slug,
        publisherName: source.name,
        publisherHomepageUrl: source.homepageUrl,
        publisherLanguage: source.language,
        publisherCountry: source.country ?? null,
        title,
        url,
        canonicalUrl: null,
        publishedAt: publishedAt.toISOString(),
        excerpt,
        language: source.language,
        category,
        official: category === "official_israeli",
      });
    }
  });

  return items;
}
