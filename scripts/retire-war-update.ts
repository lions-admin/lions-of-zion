/**
 * Retires `war_update` publications. Owner decision 2026-09-05: the section was
 * never a product surface; its rows are machine-published pipeline residual.
 *
 * Uses publicationsService.remove() — the repository's only sanctioned hard
 * delete — which refuses anything that is not `draft` or `archived`, writes the
 * deletion to the audit trail, and lets the FK cascades take the dependent
 * join rows (items, evidence JOINS, related, narratives, homepage slots).
 * Shared evidence entities, entity_version history and pre-existing audit rows
 * are retained by the mechanism's documented design.
 *
 * Dry run by default. `--apply` performs the deletions.
 *
 * Usage:
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/retire-war-update.ts           # dry run
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/retire-war-update.ts --apply   # delete
 */
import { sql } from "drizzle-orm";

async function main(): Promise<void> {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());

  const apply = process.argv.includes("--apply");

  const { db } = await import("@/server/db/client");
  const { publicationService } = await import("@/server/modules/publications/service");

const database = db();
const targets = (await database.execute(sql`
  SELECT id, public_id AS "publicId", status
  FROM publication
  WHERE section::text = 'war_update'
`)).rows as { id: string; publicId: string; status: string }[];

  console.log(`war_update publications: ${targets.length}`);
  for (const row of targets) console.log(`  - ${row.publicId} (${row.status})`);

  if (!targets.length) {
    console.log("Nothing to delete.");
    process.exit(0);
  }

  const unexpected = targets.filter((row) => row.status !== "archived");
  if (unexpected.length) {
    console.error(
      `Refusing: ${unexpected.length} row(s) are not archived: ${unexpected.map((row) => row.publicId).join(", ")}`,
    );
    process.exit(1);
  }

  if (!apply) {
    console.log("Dry run — pass --apply to delete.");
    process.exit(0);
  }

  const service = publicationService(database);
  const actor = { label: "war-update-retirement" };
  for (const row of targets) {
    await service.remove(row.id, actor);
    console.log(`Deleted ${row.publicId}`);
  }

const [after] = (await database.execute(sql`
  SELECT count(*)::int AS count FROM publication WHERE section::text = 'war_update'
`)).rows as { count: number }[];
  console.log(`Remaining war_update publications: ${after?.count ?? "?"}`);
  if ((after?.count ?? 1) !== 0) process.exit(1);

  const dangling = await database.execute(sql`
    SELECT
      (SELECT count(*) FROM publication_item      WHERE publication_id NOT IN (SELECT id FROM publication)) AS orphan_items,
      (SELECT count(*) FROM publication_evidence  WHERE publication_id NOT IN (SELECT id FROM publication)) AS orphan_evidence_joins,
      (SELECT count(*) FROM publication_related   WHERE publication_id NOT IN (SELECT id FROM publication)) AS orphan_related,
      (SELECT count(*) FROM publication_narrative WHERE publication_id NOT IN (SELECT id FROM publication)) AS orphan_narratives,
      (SELECT count(*) FROM homepage_placement   WHERE publication_id NOT IN (SELECT id FROM publication)) AS orphan_homepage
  `);
  console.log("Dangling-reference check:", JSON.stringify(dangling.rows[0]));

}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
