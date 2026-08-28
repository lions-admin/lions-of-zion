import "server-only";

/**
 * Evidence operations. Owns policy; owns no SQL.
 *
 * `createEvidenceInTx` is exported separately from the service because
 * ingestion needs to write several evidence rows and one `source_fetch` row
 * as a single unit — it opens its own transaction and calls this directly,
 * rather than nesting one service transaction inside another.
 */

import { notFound } from "@/server/http/responses";
import { recordVersion, setIdentity } from "@/server/core/versioning";
import { evidence } from "@/server/db/schema";
import { evidenceRepo } from "./repo";
import type { CreateEvidence, ListEvidence } from "@/server/contracts/evidence";
import type { Actor } from "@/server/core/audit";
import type { Evidence } from "@/server/db/schema";
import type { ChangeSource } from "@/server/contracts/enums";

type Tx = Parameters<typeof recordVersion>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

/** Inserts one evidence row, versions it, and opens its provenance trail with
 *  a single "captured" entry — all against an already-open transaction. */
export async function createEvidenceInTx(
  tx: unknown,
  input: CreateEvidence,
  actor: Actor,
  opts: { changeSource?: ChangeSource; requestId?: string; provenanceDetail?: unknown } = {},
): Promise<Evidence> {
  const repo = evidenceRepo(tx);

  const row = await repo.insert({
    sourceId: input.sourceId,
    sourceFetchId: input.sourceFetchId ?? null,
    kind: input.kind,
    dataClass: input.dataClass,
    title: input.title,
    excerpt: input.excerpt ?? null,
    externalId: input.externalId ?? null,
    url: input.url ?? null,
    language: input.language,
    publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
  });

  await recordVersion(tx as Tx, evidence, row as never, {
    entityType: "evidence",
    entityId: row.id,
    actor,
    changeSummary: "Evidence captured",
    changeSource: opts.changeSource ?? "import",
    requestId: opts.requestId,
  });

  await repo.insertProvenance({
    evidenceId: row.id,
    action: "captured",
    actorUserId: actor.userId ?? null,
    actorLabel: actor.label,
    detail: opts.provenanceDetail ?? null,
  });

  return row;
}

/** The dedup check ingestion runs before inserting — exported rather than
 *  making callers reach into the repository directly. */
export async function findEvidenceByExternalId(
  tx: unknown,
  sourceId: string,
  externalId: string,
): Promise<Evidence | undefined> {
  return evidenceRepo(tx).byExternalId(sourceId, externalId);
}

export async function findEvidenceByUrl(tx: unknown, url: string): Promise<Evidence | undefined> {
  return evidenceRepo(tx).byUrl(url);
}

export function evidenceService(db: unknown) {
  const run = db as unknown as Runner;

  return {
    async get(id: string): Promise<Evidence> {
      const row = await evidenceRepo(db).byId(id);
      if (!row) throw notFound("Evidence");
      return row;
    },

    list: (filters: ListEvidence) => evidenceRepo(db).list(filters),

    async create(input: CreateEvidence, actor: Actor, requestId?: string): Promise<Evidence> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        return createEvidenceInTx(tx, input, actor, { requestId });
      });
    },
  };
}

export type EvidenceService = ReturnType<typeof evidenceService>;
