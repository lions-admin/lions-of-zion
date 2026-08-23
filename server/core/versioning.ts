import "server-only";

/**
 * The single write path for anything versioned.
 *
 * Five things have to happen together whenever a versioned entity changes:
 * the row is updated, a version is appended, the head pointer moves, the audit
 * trail records who did it, and a reindex is queued. Four of those are easy to
 * forget, and every one of them is silent when forgotten — a missing version
 * is only noticed when someone asks what an item used to say.
 *
 * So they live in one function, in one transaction. Nothing else may UPDATE a
 * versioned table; that is checkable by grepping for `db.update(` outside the
 * module repositories.
 */

import { eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { entityVersion } from "@/server/db/schema";
import { changeHash } from "./hash";
import { writeAudit, type Actor } from "./audit";
import { emit, TOPICS } from "./outbox";
import type { ChangeSource, EntityType } from "@/server/contracts/enums";

export type VersionMeta = {
  entityType: EntityType;
  entityId: string;
  actor: Actor;
  changeSummary: string;
  changeSource: ChangeSource;
  /** Required when `changeSource` is `ai_suggestion_accepted`; the database
   *  enforces it too, so forgetting is a constraint violation rather than an
   *  untraceable AI edit. */
  aiRunId?: string | null;
  requestId?: string | null;
  /** What the entity looked like before, for the audit trail. */
  before?: unknown;
};

/* Structural, so this works with both the Neon and PGlite drizzle instances
   without dragging either driver's types into the signature. */
type Tx = {
  execute: (q: unknown) => Promise<unknown>;
  insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<unknown[]> } };
  update: (t: unknown) => { set: (v: unknown) => { where: (w: unknown) => Promise<unknown> } };
  select: (f?: unknown) => {
    from: (t: unknown) => { where: (w: unknown) => Promise<Record<string, unknown>[]> };
  };
};

/**
 * Appends a version for an entity that has already been written in this
 * transaction, advances its head pointer, audits it, and queues a reindex.
 *
 * `snapshot` is the entity as it now stands. It is stored verbatim: a diff
 * computed later against a schema that has moved on is a diff of the wrong
 * thing, and storage is cheaper than that ambiguity.
 */
export async function recordVersion(
  tx: Tx,
  table: PgTable,
  snapshot: Record<string, unknown>,
  meta: VersionMeta,
): Promise<string> {
  const nextNumber = await nextVersionNumber(tx, meta.entityType, meta.entityId);
  const previous = await currentVersionId(tx, meta.entityType, meta.entityId);

  const [version] = (await tx
    .insert(entityVersion)
    .values({
      entityType: meta.entityType,
      entityId: meta.entityId,
      versionNumber: nextNumber,
      previousVersionId: previous,
      snapshot: snapshot as never,
      changeSummary: meta.changeSummary,
      changeSource: meta.changeSource,
      changedBy: meta.actor.userId ?? null,
      changedByLabel: meta.actor.label,
      aiRunId: meta.aiRunId ?? null,
      contentHash: changeHash(JSON.stringify(snapshot)),
    })
    .returning()) as { id: string }[];

  await tx
    .update(table)
    .set({ currentVersionId: version!.id })
    .where(eq((table as unknown as { id: never }).id, meta.entityId as never));

  await writeAudit(tx as never, {
    actor: meta.actor,
    action: `${meta.entityType}.${nextNumber === 1 ? "created" : "updated"}`,
    entityType: meta.entityType,
    entityId: meta.entityId,
    before: meta.before,
    after: snapshot,
    requestId: meta.requestId,
  });

  await emit(tx as never, TOPICS.searchReindex, { entityType: meta.entityType, id: meta.entityId }, {
    entityType: meta.entityType,
    entityId: meta.entityId,
  });

  return version!.id;
}

async function nextVersionNumber(
  tx: Tx,
  entityType: EntityType,
  entityId: string,
): Promise<number> {
  const result = (await tx.execute(
    sql`SELECT COALESCE(MAX(version_number), 0) + 1 AS next
        FROM entity_version
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}`,
  )) as { rows: { next: number | string }[] };
  return Number(result.rows[0]?.next ?? 1);
}

async function currentVersionId(
  tx: Tx,
  entityType: EntityType,
  entityId: string,
): Promise<string | null> {
  const result = (await tx.execute(
    sql`SELECT id FROM entity_version
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}
        ORDER BY version_number DESC LIMIT 1`,
  )) as { rows: { id: string }[] };
  return result.rows[0]?.id ?? null;
}

/**
 * Sets the acting identity for the transaction.
 *
 * The status-transition trigger reads this to attribute the trail, so a change
 * made without it is recorded against the database user instead of a person.
 * Transaction-local (`true`), which means it needs a real transaction — the
 * Neon HTTP driver would make this a silent no-op, which is why the client
 * uses the WebSocket pool.
 */
export async function setIdentity(tx: Tx, label: string): Promise<void> {
  await tx.execute(sql`SELECT set_config('app.identity', ${label}, true)`);
}
