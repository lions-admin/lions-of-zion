import { Pool } from "@neondatabase/serverless";

/**
 * Read-only connection-pressure probe for an isolated database.
 *
 * Deliberately requires TEST_DATABASE_URL. This must never silently target a
 * deployed environment or use a redacted value from `vercel env pull`.
 */
async function main(): Promise<void> {
  const connectionString = process.env.TEST_DATABASE_URL?.trim();
  if (!connectionString || connectionString === "[SENSITIVE]") {
    throw new Error("Set TEST_DATABASE_URL to an isolated PostgreSQL database before running this probe.");
  }

  const max = positiveNumber("DATABASE_POOL_MAX", 8);
  const concurrency = positiveNumber("BRIEFING_DB_PRESSURE_CONCURRENCY", Math.max(2, max * 2));
  const rounds = positiveNumber("BRIEFING_DB_PRESSURE_ROUNDS", 3);
  const pool = new Pool({ connectionString, max, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 8_000 });
  const samples: number[] = [];
  try {
    for (let round = 0; round < rounds; round += 1) {
      const started = performance.now();
      await Promise.all(Array.from({ length: concurrency }, async () => {
        const queryStarted = performance.now();
        await pool.query("select 1 as ok");
        samples.push(performance.now() - queryStarted);
      }));
      console.log(JSON.stringify({ round: round + 1, concurrency, elapsedMs: rounded(performance.now() - started) }));
    }
  } finally {
    await pool.end();
  }

  samples.sort((a, b) => a - b);
  console.log(JSON.stringify({
    database: "TEST_DATABASE_URL",
    poolMax: max,
    concurrency,
    rounds,
    queries: samples.length,
    latencyMs: {
      p50: rounded(percentile(samples, 0.5)),
      p95: rounded(percentile(samples, 0.95)),
      max: rounded(samples.at(-1) ?? 0),
    },
  }, null, 2));
}

function positiveNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)] ?? 0;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
