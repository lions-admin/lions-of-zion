import "server-only";

import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { closeDb, db, withDatabaseRole } from "@/server/db/client";
import { setIdentity } from "@/server/core/versioning";
import { emit, TOPICS } from "@/server/core/outbox";

async function main() {
  const idsArg = process.argv.find((value) => value.startsWith("--ids="))?.slice(6) ?? "";
  const snapshotArg = process.argv.find((value) => value.startsWith("--snapshot="))?.slice(11) ?? "";
  const ids = idsArg.split(",").map((value) => value.trim()).filter(Boolean);
  if (ids.length !== 6 || new Set(ids).size !== 6) {
    throw new Error("Exactly six unique publication UUIDs or public IDs are required with --ids=...");
  }
  if (!snapshotArg) throw new Error("A verified backup manifest is required with --snapshot=/path/file.dump.manifest");
  const manifest = await readFile(snapshotArg, "utf8");
  if (!manifest.includes("scope=full-database-before-briefing-change")) {
    throw new Error("The supplied file is not a briefing backup manifest.");
  }

  await withDatabaseRole("app_service", "maintenance:archive-defective-briefing-publications", async () => {
    const database = db();
    await database.transaction(async (tx) => {
      await setIdentity(tx as never, "maintenance:archive-defective-briefing-publications");
      const matched = await tx.execute<{ id: string; publicId: string; status: string }>(sql`
        SELECT id, public_id AS "publicId", status
        FROM publication
        WHERE id::text IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
           OR public_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
        FOR UPDATE
      `);
      if (matched.rows.length !== 6) throw new Error(`Expected six publications, found ${matched.rows.length}. No changes were made.`);
      await tx.execute(sql`
        UPDATE publication
        SET status = 'archived', updated_at = now()
        WHERE id IN (${sql.join(matched.rows.map((row) => sql`${row.id}`), sql`, `)})
      `);
      await tx.execute(sql`
        DELETE FROM homepage_feature
        WHERE publication_id IN (${sql.join(matched.rows.map((row) => sql`${row.id}`), sql`, `)})
      `);
      await emit(tx as never, TOPICS.publicationCacheInvalidate, { publicIds: matched.rows.map((row) => row.publicId) });
    });
  });

  console.log("Archived exactly six publications. Evidence, model runs, versions, and audit records were preserved.");
}

main()
  .catch((cause) => { console.error(cause instanceof Error ? cause.message : cause); process.exitCode = 1; })
  .finally(closeDb);
