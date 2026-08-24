import "server-only";

/**
 * Source and source-family operations. Owns policy; owns no SQL.
 *
 * `source` is versioned the same way an item is: every edit goes through
 * `recordVersion`, so a feed URL change or a deactivation is traceable.
 * `source_family` is plain reference data, same tier as `topic` and `event`.
 */

import { notFound } from "@/server/http/responses";
import { recordVersion, setIdentity } from "@/server/core/versioning";
import { source } from "@/server/db/schema";
import { sourceFamilyRepo, sourceRepo } from "./repo";
import type {
  CreateSource,
  CreateSourceFamily,
  ListSources,
  UpdateSource,
} from "@/server/contracts/source";
import type { Actor } from "@/server/core/audit";
import type { Source, SourceFamily } from "@/server/db/schema";

type Tx = Parameters<typeof recordVersion>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

export function sourceFamilyService(db: unknown) {
  return {
    list: () => sourceFamilyRepo(db).list(),
    create: (input: CreateSourceFamily): Promise<SourceFamily> =>
      sourceFamilyRepo(db).insert({
        slug: input.slug,
        label: input.label,
        description: input.description ?? null,
      }),
  };
}

export function sourceService(db: unknown) {
  const run = db as unknown as Runner;

  return {
    async get(id: string): Promise<Source> {
      const row = await sourceRepo(db).byId(id);
      if (!row) throw notFound("Source");
      return row;
    },

    list: (filters: ListSources) => sourceRepo(db).list(filters),

    async create(input: CreateSource, actor: Actor, requestId?: string): Promise<Source> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const repo = sourceRepo(tx);

        const row = await repo.insert({
          sourceFamilyId: input.sourceFamilyId,
          kind: input.kind,
          slug: input.slug,
          name: input.name,
          homepageUrl: input.homepageUrl ?? null,
          feedUrl: input.feedUrl ?? null,
          language: input.language,
          country: input.country ?? null,
          active: input.active,
        });

        await recordVersion(tx as Tx, source, row as never, {
          entityType: "source",
          entityId: row.id,
          actor,
          changeSummary: "Source registered",
          changeSource: "human_edit",
          requestId,
        });

        return row;
      });
    },

    async update(id: string, input: UpdateSource, actor: Actor, requestId?: string): Promise<Source> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const repo = sourceRepo(tx);
        const before = await repo.byId(id);
        if (!before) throw notFound("Source");

        const { changeSummary, ...fields } = input;
        const after = await repo.update(id, {
          ...prune(fields),
          updatedAt: new Date(),
        });

        await recordVersion(tx as Tx, source, after as never, {
          entityType: "source",
          entityId: id,
          actor,
          changeSummary,
          changeSource: "human_edit",
          requestId,
          before,
        });

        return after;
      });
    },
  };
}

const prune = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export type SourceService = ReturnType<typeof sourceService>;
export type SourceFamilyService = ReturnType<typeof sourceFamilyService>;
