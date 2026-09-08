#!/usr/bin/env node
/**
 * Is the local development database still current?
 *
 * A Neon branch is frozen at creation and never follows its parent, so
 * `dev/local` silently drifts away from production every day that passes. The
 * failure has no symptom of its own: the code is right, the build is right, and
 * the site simply renders last week's edition. On 2026-09-07 that cost most of
 * a session, and on 2026-09-08 it read as "production has a design local does
 * not". This check turns an invisible drift into one line at session start.
 *
 * Prints nothing at all unless the data is stale, and never fails: no
 * `.env.local`, no network and no database are all ordinary conditions here.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? resolve(new URL("..", import.meta.url).pathname);

const STALE_DAYS = 2;
/* Reset preserves the branch id and the endpoint, so these stay valid across resets. */
const NEON_PROJECT = "floral-voice-23238673";
const NEON_DEV_BRANCH = "br-raspy-brook-aul6jgmu";

/** The local database URL, read only from .env.local so tests and CI stay hermetic. */
function localDatabaseUrl() {
  const text = readFileSync(join(root, ".env.local"), "utf8");
  const line = text.split("\n").find((entry) => entry.startsWith("DATABASE_URL="));
  return line?.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "") || null;
}

export async function checkLocalDataAge() {
  let url;
  try {
    url = localDatabaseUrl();
  } catch {
    return null;
  }
  if (!url) return null;

  const { neon } = await import("@neondatabase/serverless");
  /* One read, no transaction and no RLS role, which is the only case the
     http driver is allowed to serve. See AGENTS.md on server/db/client.ts. */
  /* As text, and compared as UTC midnight: a date-only value put through a
     local-time Date reads a day early east of Greenwich, which is where this runs. */
  const rows = await neon(url)`SELECT to_char(max(published_at), 'YYYY-MM-DD') AS newest FROM publication WHERE status = 'published'`;
  const newest = rows[0]?.newest;
  if (!newest) return null;

  const days = Math.floor((Date.now() - Date.parse(`${newest}T00:00:00Z`)) / 86_400_000);
  if (days <= STALE_DAYS) return null;

  return [
    `Local database content is ${days} days old (newest publication ${newest}); production publishes daily.`,
    `A Neon branch never follows its parent. Reset it — the code is not the problem:`,
    `  neon branches reset ${NEON_DEV_BRANCH} --parent --project-id ${NEON_PROJECT}`,
    `Then clear .next: unstable_cache keeps the pre-reset rows on disk and outlives a restart.`,
  ].join("\n");
}

if (process.argv[1]?.endsWith("scripts/check-local-data-age.mjs")) {
  checkLocalDataAge()
    .then((message) => { if (message) console.log(message); })
    .catch(() => {});
}
