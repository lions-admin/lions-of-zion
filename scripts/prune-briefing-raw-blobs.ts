import "server-only";

import { createHash } from "node:crypto";
import { del, list, type ListBlobResultBlob } from "@vercel/blob";
import { sql } from "drizzle-orm";
import { assertBriefingResourceIsolation, briefingBlobOptions } from "@/server/core/config";
import { closeDb, db, withDatabaseRole } from "@/server/db/client";

async function main() {
  const apply = process.argv.includes("--apply");
  const daysArg = process.argv.find((value) => value.startsWith("--days="))?.slice(7);
  const orphanGraceArg = process.argv.find((value) => value.startsWith("--orphan-grace-days="))?.slice(20);
  const days = Number(daysArg ?? 30);
  const orphanGraceDays = Number(orphanGraceArg ?? 7);
  if (!Number.isInteger(days) || days < 7) throw new Error("Retention must be at least seven days.");
  if (!Number.isInteger(orphanGraceDays) || orphanGraceDays < 7) {
    throw new Error("Orphan grace period must be at least seven days.");
  }
  if (apply && process.env.BRIEFING_RETENTION_CONFIRM !== "briefing-only") {
    throw new Error("Set BRIEFING_RETENTION_CONFIRM=briefing-only before --apply.");
  }
  assertBriefingResourceIsolation();

  const { expiredReferences, referencedUrls } = await withDatabaseRole("app_service", "maintenance:briefing-retention", async () => {
    const database = db();
    const [expiredReferences, references] = await Promise.all([
      database.execute<{ rawBlobUrl: string; latestReference: string }>(sql`
        SELECT raw_blob_url AS "rawBlobUrl", max(created_at)::text AS "latestReference"
        FROM source_fetch
        WHERE raw_blob_url IS NOT NULL
        GROUP BY raw_blob_url
        HAVING max(created_at) < now() - (${days} * interval '1 day')
      `),
      database.execute<{ rawBlobUrl: string }>(sql`
        SELECT DISTINCT raw_blob_url AS "rawBlobUrl"
        FROM source_fetch
        WHERE raw_blob_url IS NOT NULL
      `),
    ]);
    return { expiredReferences: expiredReferences.rows, referencedUrls: new Set(references.rows.map((row) => row.rawBlobUrl)) };
  });

  const briefingOnly = expiredReferences.filter((row) => row.rawBlobUrl.includes("/briefing/raw/"));
  const orphaned = (await listBriefingRawBlobs()).filter((blob) =>
    !referencedUrls.has(blob.url) && blob.uploadedAt.getTime() < Date.now() - orphanGraceDays * 86_400_000,
  );
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    retentionDays: days,
    orphanGraceDays,
    expiredReferenceCandidates: briefingOnly.length,
    orphanCandidates: orphaned.length,
  }));
  for (const row of briefingOnly) {
    const reference = createHash("sha256").update(row.rawBlobUrl).digest("hex").slice(0, 12);
    console.log(JSON.stringify({ kind: "expired_reference", reference, latestReference: row.latestReference }));
    if (!apply) continue;
    await del(row.rawBlobUrl, briefingBlobOptions());
    await withDatabaseRole("app_service", "maintenance:briefing-retention", () => db().execute(sql`
      UPDATE source_fetch SET raw_blob_url = NULL
      WHERE raw_blob_url = ${row.rawBlobUrl}
    `));
  }
  for (const blob of orphaned) {
    const reference = createHash("sha256").update(blob.url).digest("hex").slice(0, 12);
    console.log(JSON.stringify({ kind: "orphan", reference, uploadedAt: blob.uploadedAt.toISOString() }));
    if (!apply) continue;
    await del(blob.url, { ...briefingBlobOptions(), ifMatch: blob.etag });
  }
}

async function listBriefingRawBlobs(): Promise<ListBlobResultBlob[]> {
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ ...briefingBlobOptions(), prefix: "briefing/raw/", cursor, limit: 1_000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

main()
  .catch((cause) => { console.error(cause instanceof Error ? cause.message : cause); process.exitCode = 1; })
  .finally(closeDb);
