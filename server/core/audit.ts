import "server-only";

/**
 * The audit trail.
 *
 * Always called inside the caller's transaction, so a change and its record
 * commit together or not at all. An audit row written afterwards is a row that
 * goes missing exactly when something crashed, which is exactly when it is
 * wanted.
 */

import { auditLog } from "@/server/db/schema";
import type { EntityType } from "@/server/contracts/enums";

export type Actor = {
  userId?: string | null;
  /** Denormalised so the trail stays readable after a user is renamed or
   *  removed. Required — an unattributable audit row is barely a record. */
  label: string;
};

export type AuditInput = {
  actor: Actor;
  action: string;
  entityType: EntityType;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  requestId?: string | null;
};

type Inserter = { insert: (table: typeof auditLog) => { values: (v: unknown) => Promise<unknown> } };

export async function writeAudit(tx: Inserter, input: AuditInput): Promise<void> {
  await tx.insert(auditLog).values({
    actorUserId: input.actor.userId ?? null,
    actorLabel: input.actor.label,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    beforeState: (input.before ?? null) as never,
    afterState: (input.after ?? null) as never,
    requestId: input.requestId ?? null,
  });
}
