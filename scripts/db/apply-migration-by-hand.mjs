#!/usr/bin/env node
/**
 * Apply ONE numbered migration by hand, both halves: the DDL split on
 * `--> statement-breakpoint`, then drizzle's receipt row, so the build-time
 * schema preflight (scripts/check-deployment-schema.ts) accepts the deploy.
 *
 * Exists because `npm run db:migrate` exits 1 on this machine with its error
 * swallowed (see .ai/DECISIONS.md, 2026-09-08). Refuses to run against a
 * Production endpoint unless ALLOW_PRODUCTION_MIGRATION=1 — Production is
 * applied by the owner from the Neon Console (CLAUDE.md).
 *
 *   node scripts/db/apply-migration-by-hand.mjs 0066            # uses DATABASE_URL_UNPOOLED ?? DATABASE_URL
 *   DATABASE_URL=… node scripts/db/apply-migration-by-hand.mjs 0066 --dry-run
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { readMigrationFiles } = require("drizzle-orm/migrator");
const { neon } = require("@neondatabase/serverless");

const [tag, ...flags] = process.argv.slice(2);
if (!tag) { console.error("usage: apply-migration-by-hand.mjs <NNNN> [--dry-run]"); process.exit(2); }
const dryRun = flags.includes("--dry-run");
for (const line of (() => { try { return readFileSync(".env.local", "utf8").split("\n"); } catch { return []; } })()) {
  const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) { console.error("no DATABASE_URL"); process.exit(2); }
const host = new URL(url).host;
if (/late-fire/.test(host) && process.env.ALLOW_PRODUCTION_MIGRATION !== "1") {
  console.error(`refusing ${host}: looks like the Production endpoint`); process.exit(3);
}
const folder = "server/db/migrations";
const file = readdirSync(folder).find((f) => f.startsWith(tag) && f.endsWith(".sql"));
if (!file) { console.error(`no ${tag}_*.sql in ${folder}`); process.exit(2); }
const statements = readFileSync(join(folder, file), "utf8").split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
const receipt = readMigrationFiles({ migrationsFolder: folder }).find((m) => m.folderMillis && readFileSync(join(folder, "meta/_journal.json"), "utf8").includes(`"tag": "${file.replace(/\.sql$/, "")}"`) && m.sql.join("").trim() === statements.join("\n").trim())
  ?? readMigrationFiles({ migrationsFolder: folder }).at(-1);
console.error(`target ${host} · ${file} · ${statements.length} statements · receipt ${receipt.hash.slice(0, 12)}… @ ${receipt.folderMillis}${dryRun ? " · DRY RUN" : ""}`);
if (dryRun) process.exit(0);
const sql = neon(url);
const [{ n }] = await sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations WHERE hash = ${receipt.hash}`;
if (n > 0) { console.error("receipt already present; nothing to do"); process.exit(0); }
let i = 0;
for (const statement of statements) { i += 1; await sql.query(statement); process.stderr.write(`\r${i}/${statements.length}`); }
await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${receipt.hash}, ${receipt.folderMillis})`;
console.error(`\napplied ${file} and wrote the receipt`);
