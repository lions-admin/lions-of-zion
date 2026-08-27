import "server-only";

/**
 * User-submitted reports. Owns policy; owns no SQL beyond the repository.
 *
 * Submission is the only write path in the system reachable by an
 * unauthenticated stranger, so it is the only one that assumes hostility:
 * rate limited, never echoed back, stored as text and never as markup,
 * classified `internal` on arrival because a reporter may have volunteered
 * personal detail that nobody has reviewed.
 *
 * The status trail is written by a database trigger, not here — same choice
 * as `item_status_transition`, and for the same reason: a trail the service
 * has to remember to write is a trail that eventually is not written.
 */

import { ApiError, notFound } from "@/server/http/responses";
import { setIdentity } from "@/server/core/versioning";
import { writeAudit } from "@/server/core/audit";
import { integrityHash } from "@/server/core/hash";
import { repo } from "./repo";
import { canTransitionReport, LEGAL_REPORT_TRANSITIONS } from "@/server/contracts/report";
import type { ListReports, SubmitReport, TriageReport } from "@/server/contracts/report";
import type { Actor } from "@/server/core/audit";
import type { Report } from "@/server/db/schema";

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };


export function reportService(db: unknown) {
  const run = db as unknown as Runner;

  return {
    async get(id: string): Promise<Report> {
      const row = await repo(db).byId(id);
      if (!row) throw notFound("Report");
      return row;
    },

    list: (filters: ListReports) => repo(db).list(filters),

    /**
     * Accepts a submission from the public.
     *
     * `submittedFrom` is hashed before it is stored — the column exists for
     * abuse triage, not to keep a log of who visited.
     */
    async submit(input: SubmitReport, submittedFrom?: string): Promise<Report> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, "public:report");
        const row = await repo(tx).insert({
          publicId: `r-${crypto.randomUUID().slice(0, 12)}`,
          url: input.url ?? null,
          body: input.body ?? null,
          reporterEmail: input.reporterEmail ?? null,
          reporterNote: input.reporterNote ?? null,
          submittedFromHash: submittedFrom ? integrityHash(submittedFrom) : null,
        });

        await writeAudit(tx as never, {
          actor: { label: "public:report", userId: null },
          action: "report.received",
          entityType: "report",
          entityId: row.id,
          /* The submission itself is not copied into the audit trail — it is
             already in `report`, and duplicating unreviewed public input into
             a second table doubles what has to be redacted later. */
          after: { publicId: row.publicId },
        });

        return row;
      });
    },

    /** Moves a report through triage. The trail is written by the trigger. */
    async triage(id: string, input: TriageReport, actor: Actor): Promise<Report> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = repo(tx);
        const before = await r.byId(id);
        if (!before) throw notFound("Report");
        if (before.status === input.to) return before;

        if (!canTransitionReport(before.status, input.to)) {
          throw new ApiError(
            "PRECONDITION_FAILED",
            `A report in "${before.status}" cannot move to "${input.to}". ` +
              `It may move to: ${LEGAL_REPORT_TRANSITIONS[before.status].join(", ") || "nowhere"}.`,
          );
        }

        if (["closed", "rejected"].includes(input.to) && !input.resolutionNote?.trim()) {
          throw new ApiError(
            "VALIDATION_ERROR",
            `Moving a report to "${input.to}" requires a resolution note. An unexplained refusal is not a record.`,
          );
        }
        if (
          ["linked_to_existing_item", "converted_to_item"].includes(input.to) &&
          !input.itemId &&
          !before.itemId
        ) {
          throw new ApiError(
            "VALIDATION_ERROR",
            `Moving a report to "${input.to}" requires the item it refers to.`,
          );
        }

        return r.update(id, {
          status: input.to,
          resolutionNote: input.resolutionNote ?? before.resolutionNote,
          itemId: input.itemId ?? before.itemId,
          assignedTo: actor.userId ?? before.assignedTo,
          updatedAt: new Date(),
        });
      });
    },
  };
}

export type ReportService = ReturnType<typeof reportService>;
