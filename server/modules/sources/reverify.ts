import "server-only";

/**
 * The way back for a source the system took out of rotation.
 *
 * `recordFetchHealth` disables a source after five consecutive failed
 * fetches, and the catalog review of 2026-09-01 retired two more by hand
 * (`config.retired`) after their endpoints answered 403. Both are the right
 * reaction to a dead feed. Neither had a way back: a source that had been
 * disabled stayed disabled until a person noticed, verified it and flipped
 * it, and nobody did — The Times of Israel answered 200 again within days
 * and stayed off for a week, while the alert evaluator counted it as
 * "repeatedly failing" every morning.
 *
 * Once a day, from the maintenance cron, each such source gets one real
 * connector fetch with nothing written from it — no `source_fetch` row, no
 * evidence, no health counter. A fetch that returns usable items reactivates
 * the source through the versioned service (so the reactivation is a
 * recorded change with an actor and a summary) and clears its failure
 * counters through the same repository call a successful collection uses. A
 * fetch that fails changes nothing; tomorrow asks again. Bounded by the cron
 * cadence and by `limit`, so a dozen dead feeds cost a dozen requests a day.
 */

import type { Source } from "@/server/db/schema";
import type { Actor } from "@/server/core/audit";
import { sql } from "drizzle-orm";
import { connectorFor } from "./connectors";
import type { ConnectorFetchResult } from "./connector";
import { sourceRepo } from "./repo";
import { sourceService } from "./service";

export const SOURCE_REVERIFY_ACTOR: Actor = { label: "service:source-reverify", userId: null };

export type ReverifyOutcome = {
  sourceId: string;
  slug: string;
  outcome: "reactivated" | "still_failing";
  items?: number;
  error?: string;
};

type Db = { execute: <T>(query: unknown) => Promise<{ rows: T[] }> };

/** Sources the system itself disabled or retired for fetch failures. A source
 *  a person switched off with no such reason is left exactly where it is. */
export async function sourcesAwaitingReverification(database: unknown, limit = 10): Promise<Source[]> {
  const result = await (database as Db).execute<{ id: string }>(sql`
    SELECT id
    FROM source
    WHERE active = false
      AND kind IN ('rss', 'api')
      AND (
        disabled_reason LIKE 'Repeated % fetches%'
        OR config ->> 'retiredReason' LIKE 'Removed from the live RSS catalog after endpoint verification failed%'
      )
    ORDER BY updated_at
    LIMIT ${limit}
  `);
  const repo = sourceRepo(database);
  const rows = await Promise.all(result.rows.map((row) => repo.byId(row.id)));
  return rows.filter((row): row is Source => Boolean(row));
}

export async function reverifyDisabledSources(
  database: unknown,
  opts: { limit?: number; fetch?: (source: Source) => Promise<ConnectorFetchResult>; now?: Date } = {},
): Promise<ReverifyOutcome[]> {
  const now = opts.now ?? new Date();
  const fetchSource = opts.fetch ?? ((source: Source) => connectorFor(source.kind).fetch(source));
  const outcomes: ReverifyOutcome[] = [];
  const candidates = await sourcesAwaitingReverification(database, opts.limit);
  /* The probes run together: a dead endpoint costs its full connect timeout,
     and the maintenance route that hosts this sweep has a minute in total. */
  const probes = await Promise.all(candidates.map(async (source) => {
    try {
      return { source, result: await fetchSource(source), error: null };
    } catch (cause) {
      return { source, result: null, error: cause instanceof Error ? cause.message : String(cause) };
    }
  }));
  for (const { source, result, error } of probes) {
    if (!result) {
      outcomes.push({ sourceId: source.id, slug: source.slug, outcome: "still_failing", error: error ?? "Fetch failed." });
      continue;
    }
    if (result.status !== "success" || result.items.length === 0) {
      outcomes.push({
        sourceId: source.id, slug: source.slug, outcome: "still_failing", items: result.items.length,
        error: result.errorMessage ?? (result.status === "success" ? "Feed returned no items." : `Fetch ended ${result.status}.`),
      });
      continue;
    }
    const config = source.config && typeof source.config === "object" ? source.config as Record<string, unknown> : {};
    await sourceService(database).update(source.id, {
      active: true,
      config: {
        ...config,
        retired: false,
        verificationState: "verified",
        verificationError: null,
        verificationItems: result.items.length,
        verifiedAt: now.toISOString(),
        reactivatedAt: now.toISOString(),
      },
      changeSummary: `Reactivated after a successful re-verification fetch (${result.items.length} items); previously ${source.disabledReason ?? String(config.retiredReason ?? "retired")}`,
    }, SOURCE_REVERIFY_ACTOR);
    await sourceRepo(database).recordFetchHealth(source.id, "success", now);
    outcomes.push({ sourceId: source.id, slug: source.slug, outcome: "reactivated", items: result.items.length });
  }
  return outcomes;
}
