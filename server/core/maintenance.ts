import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/server/db/client";

type Row = { rate_limits: number | string; idempotency_keys: number | string };

type MeasurementRow = { events_deleted: number | string; presence_deleted: number | string };

export async function runMaintenance(): Promise<{
  rateLimits: number;
  idempotencyKeys: number;
  measurementEvents: number;
  measurementPresence: number;
}> {
  const result = await db().execute<Row>(sql`
    SELECT
      prune_rate_limits(interval '1 day') AS rate_limits,
      prune_expired_idempotency() AS idempotency_keys
  `);
  const row = result.rows[0];
  let measurementEvents = 0;
  let measurementPresence = 0;
  try {
    const pruned = await db().execute<MeasurementRow>(sql`SELECT * FROM prune_measurement()`);
    const m = pruned.rows[0];
    measurementEvents = Number(m?.events_deleted ?? 0);
    measurementPresence = Number(m?.presence_deleted ?? 0);
  } catch {
    /* Measurement tables may not exist on an older branch; never fail maintenance. */
  }
  return {
    rateLimits: Number(row?.rate_limits ?? 0),
    idempotencyKeys: Number(row?.idempotency_keys ?? 0),
    measurementEvents,
    measurementPresence,
  };
}
