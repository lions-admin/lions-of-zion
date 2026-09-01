import "server-only";

import { safeFetchText } from "@/server/core/safe-fetch";
import { normalizePublicUrl, publisherDomain } from "@/server/core/url-normalization";
import { integrityHash } from "@/server/core/hash";
import { evidenceService, findEvidenceByUrl } from "@/server/modules/evidence";
import type { Actor } from "@/server/core/audit";
import type { BriefingEvidence } from "@/server/modules/briefing/repo";

export async function enrichEvidenceWindow(
  database: unknown,
  rows: BriefingEvidence[],
  actor: Actor,
  requestId?: string,
): Promise<{ attempted: number; enriched: number; failed: number }> {
  let enriched = 0;
  let failed = 0;
  for (let offset = 0; offset < rows.length; offset += 6) {
    const batch = rows.slice(offset, offset + 6);
    const results = await Promise.allSettled(batch.map((row) => enrichOne(database, row, actor, requestId)));
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) enriched++;
      else failed++;
    }
  }
  return { attempted: rows.length, enriched, failed };
}

async function enrichOne(database: unknown, row: BriefingEvidence, actor: Actor, requestId?: string): Promise<boolean> {
  const sourceUrl = row.canonicalUrl ?? row.url;
  if (!sourceUrl) return false;
  const response = await safeFetchText(sourceUrl, {
    accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
    allowedContentTypes: [/^text\/html$/, /^application\/xhtml\+xml$/, /^text\/plain$/],
    timeoutMs: 10_000,
    maxBytes: 1_500_000,
    maxRedirects: 5,
  });
  const accessState = accessStateFor(response.status, response.body);
  const service = evidenceService(database);
  if (!response.ok || accessState !== "open") {
    await service.enrich(row.id, {
      usableTextLength: row.usableTextLength,
      retrievalStatus: response.status >= 500 ? "failed" : "partial",
      accessState,
      contentType: response.contentType,
    }, actor, requestId);
    return false;
  }

  const extracted = extractArticleText(response.body);
  const declaredCanonical = canonicalLink(response.body, response.url);
  let canonicalUrl = normalizePublicUrl(declaredCanonical ?? response.url);
  const duplicate = await findEvidenceByUrl(database, canonicalUrl);
  if (duplicate && duplicate.id !== row.id) canonicalUrl = row.canonicalUrl ?? canonicalUrl;
  const excerpt = extracted.slice(0, 6_000).trim();
  await service.enrich(row.id, {
    excerpt: excerpt || row.excerpt,
    canonicalUrl,
    url: canonicalUrl,
    publisherDomain: publisherDomain(canonicalUrl),
    normalizedContentHash: excerpt ? integrityHash(normalizeText(`${row.title}\n${excerpt}`)) : row.normalizedContentHash,
    usableTextLength: excerpt.length,
    retrievalStatus: excerpt.length >= 240 ? "fetched" : "partial",
    accessState: "open",
    contentType: response.contentType,
  }, actor, requestId);
  return excerpt.length >= 240;
}

function canonicalLink(html: string, base: string): string | null {
  const tags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const rel = attribute(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
    const href = attribute(tag, "href");
    if (rel.includes("canonical") && href) {
      try { return new URL(href, base).toString(); } catch { return null; }
    }
  }
  return null;
}

function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:["']([^"']+)["']|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? null;
}

function extractArticleText(html: string): string {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? html;
  return decodeEntities(article
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ({
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
  })[entity] ?? entity);
}

function accessStateFor(status: number, body: string): "open" | "blocked" | "login_required" | "paywalled" | "unavailable" {
  if (status === 401) return "login_required";
  if (status === 402 || /\bsubscribe to continue|subscriber-only|paywall\b/i.test(body)) return "paywalled";
  if (status === 403 || status === 429) return "blocked";
  if (status >= 400) return "unavailable";
  return "open";
}

function normalizeText(value: string) { return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(); }
