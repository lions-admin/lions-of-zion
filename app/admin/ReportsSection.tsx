"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Skeleton } from "@/components/ui/Skeleton";
import { LEGAL_REPORT_TRANSITIONS } from "@/server/contracts/report";
import type { ReportStatus } from "@/server/contracts/enums";
import type { ConsoleReport, ConsoleReports } from "@/server/contracts/admin-console";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import {
  ConsoleNotices,
  EmptyLine,
  Pill,
  ReadGate,
  formatAgo,
  formatDate,
  useOperations,
} from "./console-primitives";
import { REPORT_STATUS_LABEL, SENTENCE, T } from "./lexicon";
import { RouteUnavailable, callConsole, readConsole, type ReadState } from "./useConsoleRead";
import { AuthRequired } from "./auth-required";
import cmd from "./command.module.css";
import styles from "./admin.module.css";

/**
 * The reports desk (דוח״צ) — the public's submissions of suspected false
 * information, and the one staff triage route they flow through.
 *
 * The keyset mirrors the audit section: each page carries the cursor of the
 * oldest row seen, and the load-older control appends what follows. Triage
 * splits by cost, exactly the way the incidents area does:
 *
 *  - a move between internal states is asked for nothing — it is reversible,
 *    and the report's own status trail records it;
 *  - closing and rejecting are the two moves the report's requester sees,
 *    and the route refuses both without a `resolutionNote`, so each goes
 *    through the shared confirmation with the note typed inside it.
 */
export function ReportsSection({ signal }: { signal: number }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [applied, setApplied] = useState("");
  const [reports, setReports] = useState<ConsoleReport[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "auth-required" | "failed">("loading");
  const [failure, setFailure] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  /* STATE-004 — the focus fallback, on the section itself. */
  const areaRef = useRef<HTMLElement | null>(null);
  /* The close/reject note is typed inside the confirmation; the ref keeps
     the opener from re-rendering on every keystroke. */
  const noteRef = useRef<string>("");
  const ops = useOperations();

  useEffect(() => {
    let live = true;
    readConsole<ConsoleReports>(reportsQuery(applied, null))
      .then((page) => {
        if (!live) return;
        setReports(page.reports);
        setNextCursor(page.nextCursor);
        setState("ready");
      })
      .catch((cause: unknown) => {
        if (!live) return;
        if (cause instanceof AuthRequired) setState("auth-required");
        else if (cause instanceof RouteUnavailable) setState("unavailable");
        else {
          setFailure(cause instanceof Error ? cause.message : `לא ניתן לקרוא את ${T.reportsWhat}.`);
          setState("failed");
        }
      });
    return () => {
      live = false;
    };
  }, [applied, signal, tick]);

  async function loadOlder() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await readConsole<ConsoleReports>(reportsQuery(applied, nextCursor));
      setReports((current) => [...current, ...page.reports]);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "לא ניתן לקרוא דיווחים ישנים יותר.");
    } finally {
      setLoadingMore(false);
    }
  }

  /* Annotated rather than inferred — the same reason AuditSection annotates. */
  const readState: ReadState<ConsoleReport[]> =
    state === "loading"
      ? ({ kind: "loading" } as const)
      : state === "ready"
        ? ({ kind: "ready", value: reports } as const)
        : state === "failed"
          ? ({ kind: "failed", message: failure } as const)
          : ({ kind: state } as const);

  return (
    <section className={styles.subArea} aria-label={T.reportsDesk} ref={areaRef} tabIndex={-1}>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} idPrefix="reports" />

      <form
        className={styles.filterRow}
        aria-label={T.reportsFilter}
        onSubmit={(event) => {
          event.preventDefault();
          setState("loading");
          setApplied(statusFilter);
        }}
      >
        <SelectField className={styles.editorField} label={T.reportsFilter} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">הכול</option>
          {Object.entries(REPORT_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <div className={styles.filterActions}>
          <Button variant="secondary" type="submit" disabled={state === "loading"}>
            {T.applyFilters}
          </Button>
        </div>
      </form>

      <ReadGate state={readState} what={T.reportsWhat} reload={() => { setState("loading"); setTick((current) => current + 1); }} skeleton={<Skeleton shape="block" height="20rem" />}>
        {(rows) =>
          rows.length ? (
            <>
              <div className={`${styles.tableWrap} ${cmd.desktopOnly}`}>
                <table className={styles.table}>
                  <caption className={styles.tableCaption}>החדשים ביותר בראש. ההכרעות שהדווח יראה מבקשות סיבה; ההעברות הפנימיות נרשמות בלבד.</caption>
                  <thead>
                    <tr>
                      <th scope="col">{T.date}</th>
                      <th scope="col">{T.colStatus}</th>
                      <th scope="col">{T.reporter}</th>
                      <th scope="col">{T.channel}</th>
                      <th scope="col">{T.trail}</th>
                      <th scope="col">{T.colRecovery}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((report) => (
                      <tr key={report.id}>
                        <td>
                          {formatDate(report.createdAt)}
                          <small className={styles.plainSmall}>{`${T.version} ${report.publicId}`}</small>
                        </td>
                        <td>
                          <Pill tone={reportTone(report.status)}>{REPORT_STATUS_LABEL[report.status] ?? report.status}</Pill>
                        </td>
                        <td>{report.reporterEmail ?? "—"}</td>
                        <td>
                          {report.url ? <a href={report.url} target="_blank" rel="noreferrer">{report.url}</a> : report.body?.slice(0, 120) ?? "—"}
                        </td>
                        <td>
                          <LatestTrailPill report={report} />
                        </td>
                        <td>
                          <TriageActions report={report} disabled={ops.disabled} onTransfer={transfer} onRequestDecision={requestDecision} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Narrow screens get cards, not a shrunken six-column table. */}
              <div className={cmd.sourceCards} aria-label={T.reports}>
                {rows.map((report) => (
                  <ReportCard key={report.id} report={report} disabled={ops.disabled} onTransfer={transfer} onRequestDecision={requestDecision} />
                ))}
              </div>
              <div className={styles.actionRow}>
                {nextCursor ? (
                  <Button variant="secondary" type="button" isLoading={loadingMore} onClick={loadOlder}>
                    {T.loadOlder}
                  </Button>
                ) : (
                  <p className={styles.muted}>זה הדיווח הישן ביותר שהסינון מגיע אליו.</p>
                )}
              </div>
            </>
          ) : (
            <EmptyLine>אין דיווחים תואמים. הקריאה הצליחה; הסינון הוציא כל שורה, או שאין דיווחים.</EmptyLine>
          )
        }
      </ReadGate>

      <ConfirmDialog intent={confirmIntent} onClose={() => setConfirmIntent(null)} fallbackFocusRef={areaRef} />
    </section>
  );

  function reportsQuery(status: string, cursor: string | null): string {
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (cursor) params.set("cursor", cursor);
    if (status) params.set("status", status);
    return `admin/console/reports?${params.toString()}`;
  }

  /* A move between internal states, asked for nothing: the trail records it,
     and every transition the route permits is legal from the row's status. */
  async function transfer(report: ConsoleReport, to: ReportStatus) {
    await ops.run(`triage:${report.id}`, async () => {
      await callConsole(`reports/${report.id}/triage`, {
        method: "POST",
        body: { to },
        failure: "לא ניתן להעביר את הדיווח.",
      });
      setTick((current) => current + 1);
      return SENTENCE.reportTriaged(report.publicId, REPORT_STATUS_LABEL[to] ?? to);
    });
  }

  /* Closing and rejecting are the two moves the report's requester sees, and
     both demand the note the route requires — so each is confirmed, with the
     note typed inside the dialog like the quarantine discard's reason. */
  function requestDecision(report: ConsoleReport, to: "closed" | "rejected") {
    noteRef.current = "";
    const rejecting = to === "rejected";
    setConfirmIntent({
      action: rejecting ? T.rejectReport : T.closeReport,
      target: report.publicId,
      targetDetail: report.url ?? undefined,
      consequence: rejecting ? T.rejectReportConsequence : T.closeReportConsequence,
      confirmLabel: rejecting ? T.rejectReport : T.closeReport,
      tone: "danger",
      run: () => decideReport(report, to),
      body: (
        <Field
          className={styles.editorField}
          name="note"
          label={T.reason}
          description={T.reasonNote}
          required
          maxLength={4000}
          onChange={(event) => {
            noteRef.current = event.currentTarget.value;
          }}
        />
      ),
    });
  }

  async function decideReport(report: ConsoleReport, to: "closed" | "rejected") {
    const note = noteRef.current.trim();
    await ops.run(`triage:${report.id}`, async () => {
      if (!note) throw new Error(SENTENCE.needTriageNote());
      await callConsole(`reports/${report.id}/triage`, {
        method: "POST",
        body: { to, resolutionNote: note },
        failure: to === "rejected" ? "לא ניתן לדחות את הדיווח." : "לא ניתן לסגור את הדיווח.",
      });
      setTick((current) => current + 1);
      return SENTENCE.reportTriaged(report.publicId, REPORT_STATUS_LABEL[to] ?? to);
    });
  }
}

/* The two statuses the requester sees are the dangerous ones; everything
   else moves between internal states. */
function reportTone(status: ReportStatus): "ok" | "warn" | "danger" | "neutral" {
  if (status === "closed") return "ok";
  if (status === "rejected") return "danger";
  if (status === "received") return "warn";
  return "neutral";
}

/** The trail's latest entry, and how many entries it holds. A report that
 *  was never moved has none, which is its own state rather than a dash. */
function LatestTrailPill({ report }: { report: ConsoleReport }) {
  if (!report.latestTrail) {
    return <Pill tone="neutral">{T.none}</Pill>;
  }
  return (
    <>
      <Pill tone="neutral">{REPORT_STATUS_LABEL[report.latestTrail.toStatus] ?? report.latestTrail.toStatus}</Pill>
      <small className={styles.plainSmall}>
        {report.latestTrail.actorLabel} · {formatAgo(report.latestTrail.occurredAt)} · {report.trailCount} {T.trailCount}
      </small>
    </>
  );
}

/** The per-row actions, shared by the desktop table row and the narrow
 *  card: the internal moves a select offers, and the two decisions the
 *  requester sees as danger controls. */
function TriageActions({
  report,
  disabled,
  onTransfer,
  onRequestDecision,
}: {
  report: ConsoleReport;
  disabled: boolean;
  onTransfer: (report: ConsoleReport, to: ReportStatus) => void;
  onRequestDecision: (report: ConsoleReport, to: "closed" | "rejected") => void;
}) {
  const legal = LEGAL_REPORT_TRANSITIONS[report.status] as readonly ReportStatus[];
  /* The select offers only the moves this UI asks nothing for: the two
     decisions that need a note have their own controls, and the two that
     need an item link have none here yet. */
  const internal = legal.filter((to) => to === "triaged" || to === "investigating");
  const canClose = legal.includes("closed");
  const canReject = legal.includes("rejected");
  const [to, setTo] = useState("");
  const hasActions = internal.length > 0 || canClose || canReject;
  return (
    <div className={styles.cellActions}>
      {internal.length ? (
        <>
          <SelectField className={styles.editorField} label={T.nextStatus} value={to} onChange={(event) => setTo(event.target.value)}>
            <option value="">—</option>
            {internal.map((status) => (
              <option key={status} value={status}>
                {REPORT_STATUS_LABEL[status] ?? status}
              </option>
            ))}
          </SelectField>
          <Button variant="secondary" size="sm" type="button" disabled={disabled || !to} onClick={() => onTransfer(report, to as ReportStatus)}>
            {T.transfer}
          </Button>
        </>
      ) : null}
      {canClose ? (
        <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onRequestDecision(report, "closed")}>
          {T.closeReport}
        </Button>
      ) : null}
      {canReject ? (
        <Button variant="danger" size="sm" type="button" disabled={disabled} onClick={() => onRequestDecision(report, "rejected")}>
          {T.rejectReport}
        </Button>
      ) : null}
      {!hasActions ? "—" : null}
    </div>
  );
}

function ReportCard({
  report,
  disabled,
  onTransfer,
  onRequestDecision,
}: {
  report: ConsoleReport;
  disabled: boolean;
  onTransfer: (report: ConsoleReport, to: ReportStatus) => void;
  onRequestDecision: (report: ConsoleReport, to: "closed" | "rejected") => void;
}) {
  return (
    <article className={cmd.sourceCard} aria-label={report.publicId}>
      <div className={cmd.sourceCardHead}>
        <h3 className={cmd.sourceCardName}>
          <bdi>{report.publicId}</bdi>
        </h3>
        <Pill tone={reportTone(report.status)}>{REPORT_STATUS_LABEL[report.status] ?? report.status}</Pill>
      </div>
      <p className={cmd.sourceCardMeta}>
        {T.reporter}: {report.reporterEmail ?? "—"} · {formatDate(report.createdAt)}
      </p>
      {report.url ? (
        <p className={cmd.sourceCardId}>
          <bdi>{report.url}</bdi>
        </p>
      ) : report.body ? (
        <p className={cmd.sourceCardMeta}>{report.body.slice(0, 200)}</p>
      ) : null}
      <p className={cmd.sourceCardMeta}>
        <LatestTrailPill report={report} />
      </p>
      <div className={cmd.sourceCardActions}>
        <TriageActions report={report} disabled={disabled} onTransfer={onTransfer} onRequestDecision={onRequestDecision} />
      </div>
    </article>
  );
}
