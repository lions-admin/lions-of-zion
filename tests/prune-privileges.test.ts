import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { as, freshDatabase, violation } from "@/server/db/testing";

/**
 * `prune_rate_limits` and `prune_expired_idempotency` are `SECURITY DEFINER`
 * and both DELETE. Postgres grants EXECUTE to PUBLIC on every new function, so
 * without an explicit REVOKE any role can run owner-privileged deletion —
 * including the anonymous one, against the very table that limits it.
 *
 * Migration `0018` closed that for the two functions above these and not for
 * these. Migration `0022` closes it, and this asserts the outcome from the
 * roles themselves rather than by reading the grant: the service role that the
 * maintenance cron actually runs as still works, and the two that have no
 * business pruning are refused.
 */
describe("the prune functions are executable by the service role alone", () => {
  it("lets app_service prune, because that is what the maintenance cron runs as", async () => {
    const db = await freshDatabase();
    await as(db, "app_service", "service:cron", async (tx) => {
      const rows = await tx.execute<{ pruned: number }>(
        sql`SELECT prune_rate_limits(interval '1 day') AS pruned`,
      );
      expect(Number(rows.rows[0]?.pruned ?? -1)).toBeGreaterThanOrEqual(0);
      const keys = await tx.execute<{ pruned: number }>(
        sql`SELECT prune_expired_idempotency() AS pruned`,
      );
      expect(Number(keys.rows[0]?.pruned ?? -1)).toBeGreaterThanOrEqual(0);
    });
  });

  it("refuses app_public, which would otherwise clear the counter that limits it", async () => {
    const db = await freshDatabase();
    /* One transaction per refusal: the first failure aborts the transaction,
       so a second query inside it reports 25P02 (in_failed_sql_transaction)
       rather than the privilege error we are actually asserting. */
    await as(db, "app_public", "anon", async (tx) => {
      /* Drizzle wraps the error; `violation` walks to the Postgres cause. */
      const v = await violation(tx.execute(sql`SELECT prune_rate_limits(interval '1 day')`));
      expect(v.code, "insufficient_privilege").toBe("42501");
      expect(v.message).toMatch(/permission denied for function prune_rate_limits/);
    });
    await as(db, "app_public", "anon", async (tx) => {
      const v = await violation(tx.execute(sql`SELECT prune_expired_idempotency()`));
      expect(v.code, "insufficient_privilege").toBe("42501");
      expect(v.message).toMatch(/permission denied for function prune_expired_idempotency/);
    });
  });

  it("refuses app_staff, which has no pruning path either", async () => {
    const db = await freshDatabase();
    await as(db, "app_staff", "staff", async (tx) => {
      const v = await violation(tx.execute(sql`SELECT prune_rate_limits(interval '1 day')`));
      expect(v.code, "insufficient_privilege").toBe("42501");
    });
  });
});
