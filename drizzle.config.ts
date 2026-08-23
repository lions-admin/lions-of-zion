import { defineConfig } from "drizzle-kit";

/**
 * Migrations are checked in and applied in filename order — by the test
 * harness against PGlite, and by `db:migrate` against Neon. Same files, same
 * order, both places, so a trigger cannot be present in one and missing in
 * the other.
 *
 * `DATABASE_URL` is only needed to PUSH. Generating migrations from the schema
 * needs no database at all, which is what keeps the whole of Phase 1 runnable
 * before anything is provisioned.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema/index.ts",
  out: "./server/db/migrations",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://unset" },
  verbose: true,
  strict: true,
});
