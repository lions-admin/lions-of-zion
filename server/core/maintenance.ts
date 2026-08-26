import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

type Row = { rate_limits: number | string; idempotency_keys: number | string };

export async function runMaintenance(): Promise<{ rateLimits: number; idempotencyKeys: number }> {
  const result = await db().execute<Row>(sql`
    SELECT
      prune_rate_limits(interval '1 day') AS rate_limits,
      prune_expired_idempotency() AS idempotency_keys
  `);
  const row = result.rows[0];
  return {
    rateLimits: Number(row?.rate_limits ?? 0),
    idempotencyKeys: Number(row?.idempotency_keys ?? 0),
  };
}
