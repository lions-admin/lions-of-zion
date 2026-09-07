import { Pool } from "@neondatabase/serverless";
import { assertSchemaCompatible, requireSchemaTarget } from "./schema-compatibility";

async function main() {
  const build = process.argv.includes("--build");
  const target = build ? process.env.VERCEL_ENV : process.argv[2];
  
  if (build && target !== "production") {
    console.log("Production schema preflight: not a production build.");
  } else {
    let pool: Pool | undefined;
    try {
      const connectionString = requireSchemaTarget(target, process.env);
      pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
      const client = await pool.connect();
      try {
        await client.query("BEGIN READ ONLY");
        await client.query("SET LOCAL statement_timeout = '15s'");
        const result = await assertSchemaCompatible((sql) => client.query(sql));
        console.log(`Schema preflight passed for ${target}: ${result.migrations} migrations and application columns verified.`);
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    } catch (cause) {
      // Driver errors can contain connection details. Only our own safe messages
      // are suitable for public CI logs.
      const message = cause instanceof Error ? cause.message : "";
      console.error(message.startsWith("Schema ") || message.startsWith("Expected schema")
        ? message : "Schema preflight failed: unable to verify target database. Promotion is not safe.");
      process.exitCode = 1;
    } finally {
      await pool?.end();
    }
  }
}

void main();
