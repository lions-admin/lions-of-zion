/**
 * Post-publish verification — the third job of the publishing workflow.
 *
 * A 2xx from the ingest API means the transaction committed, not that a
 * reader can see the edition. Between those two facts sit the public read
 * cache (`lib/publications.ts` wraps the listing in `unstable_cache` with a
 * 300-second revalidate) and the outbox-driven cache invalidation, so this
 * polls rather than asserting once: a miss on the first attempt is expected
 * and means "not visible yet", not "not published".
 *
 * Checks each created publication two ways, because they fail
 * independently: presence in the public listing (what
 * `/geopolitical-brief` renders from) and a 200 on its own article page.
 */

import type { ExternalBriefingPublishResult } from "@/server/contracts/external-briefing";

const DEFAULT_TARGET_URL = "https://lionsofzion.io";
const ATTEMPTS = 6;
const DELAY_MS = 10_000;
const FETCH_TIMEOUT_MS = 15_000;

function targetBaseUrl(): string {
  return process.env.BRIEFING_INGEST_BASE_URL?.trim() || DEFAULT_TARGET_URL;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/** The public listing the brief hub reads, projected to the ids we care about. */
async function publishedPublicIds(baseUrl: string): Promise<Set<string>> {
  const body = await fetchJson(`${baseUrl}/api/v1/published-publications?limit=50`);
  const rows = (body as { publications?: Array<{ publicId?: unknown }> }).publications ?? [];
  return new Set(rows.map((row) => row.publicId).filter((id): id is string => typeof id === "string"));
}

async function articlePageIsLive(baseUrl: string, publicId: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/articles/${publicId}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Returns true when every publication in `result` is publicly reachable.
 *
 * A `draft` result is reported as a deliberate non-failure: publication was
 * paused by an operator (`briefing_control.automatic_publication_paused`),
 * the rows exist but are not public, and treating that as a verification
 * failure would misreport a working kill switch as a broken pipeline.
 */
export async function verifyPublished(result: ExternalBriefingPublishResult): Promise<boolean> {
  const baseUrl = targetBaseUrl();

  if (result.status === "draft") {
    console.log(
      "Automatic publication is paused, so the edition was stored as drafts and is intentionally not public.",
    );
    console.log("Nothing to verify on the public site. Unpause publication to release it.");
    return true;
  }

  if (result.publications.length === 0) {
    console.error("The ingest API reported success but created no publications; nothing to verify.");
    return false;
  }

  const wanted = result.publications.map((publication) => publication.publicId);
  console.log(`Verifying ${wanted.length} publication(s) are publicly visible at ${baseUrl} ...`);

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let listed: Set<string>;
    try {
      listed = await publishedPublicIds(baseUrl);
    } catch (cause) {
      console.log(
        `  attempt ${attempt}/${ATTEMPTS}: could not read the public listing (${cause instanceof Error ? cause.message : String(cause)})`,
      );
      if (attempt < ATTEMPTS) await sleep(DELAY_MS);
      continue;
    }

    const missing = wanted.filter((publicId) => !listed.has(publicId));
    if (missing.length === 0) {
      const pageChecks = await Promise.all(
        wanted.map(async (publicId) => ({ publicId, live: await articlePageIsLive(baseUrl, publicId) })),
      );
      const unreachable = pageChecks.filter((check) => !check.live);
      if (unreachable.length === 0) {
        console.log("All publications are in the public listing and their article pages return 200:");
        for (const publicId of wanted) console.log(`  ${baseUrl}/articles/${publicId}`);
        console.log(`Brief hub: ${result.briefUrl}`);
        return true;
      }
      console.log(
        `  attempt ${attempt}/${ATTEMPTS}: listed, but ${unreachable.length} article page(s) not reachable yet`,
      );
    } else {
      console.log(`  attempt ${attempt}/${ATTEMPTS}: ${missing.length}/${wanted.length} not in the public listing yet`);
    }

    if (attempt < ATTEMPTS) await sleep(DELAY_MS);
  }

  console.error(
    `Publication did not become publicly visible within ${(ATTEMPTS * DELAY_MS) / 1000}s.`,
  );
  console.error(
    "The ingest transaction committed, so this is a visibility problem (cache invalidation or the outbox drain), not a lost edition. Check the ids below directly before resubmitting — resending the same runId is safe and returns the same ids.",
  );
  for (const publicId of wanted) console.error(`  ${baseUrl}/articles/${publicId}`);
  return false;
}
