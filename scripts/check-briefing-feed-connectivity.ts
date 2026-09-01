import { BRIEFING_RSS_CANDIDATES } from "@/server/modules/sources/catalog";

const timeoutMs = 12_000;
const concurrency = positiveNumber("BRIEFING_CONNECTIVITY_CONCURRENCY", 4);

async function check(feedUrl: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        "user-agent": "LionsOfZion-NewsMonitor/1.0 (+https://lionsofzion.io/methodology)",
      },
    });
    const body = await response.text();
    const looksLikeFeed = /<(rss|feed|rdf:RDF)\b/i.test(body);
    return {
      status: response.ok && looksLikeFeed ? "reachable_feed" : "invalid_feed",
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      bytes: Buffer.byteLength(body, "utf8"),
      latencyMs: Date.now() - started,
    };
  } catch (cause) {
    return {
      status: "failed",
      httpStatus: null,
      contentType: null,
      bytes: 0,
      latencyMs: Date.now() - started,
      error: cause instanceof Error ? `${cause.name}: ${cause.message}`.slice(0, 180) : "UnknownError",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const results: Array<Record<string, unknown> | undefined> = Array(BRIEFING_RSS_CANDIDATES.length);
  let next = 0;
  async function worker() {
    while (next < BRIEFING_RSS_CANDIDATES.length) {
      const index = next++;
      const source = BRIEFING_RSS_CANDIDATES[index]!;
      results[index] = { slug: source.slug, feedUrl: source.feedUrl, ...(await check(source.feedUrl)) };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, BRIEFING_RSS_CANDIDATES.length) }, worker));
  const failed = results.filter((result) => result?.status !== "reachable_feed").length;
  console.log(JSON.stringify({ checked: results.length, concurrency, failed, results }, null, 2));
  if (process.argv.includes("--strict") && failed > 0) process.exitCode = 1;
}

function positiveNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

void main();
