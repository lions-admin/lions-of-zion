"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/Tabs";
import { politeLive } from "@/components/ui/live-region";
import type {
  AuditEntry,
  AuditPage,
  ConsoleCosts,
  ConsoleIncidents,
  ConsoleSecurity,
  ConsoleSettings,
  ConsoleUsers,
  CostSurface,
  PipelineJob,
  RetryJobResult,
} from "@/server/contracts/admin-console";
import { ENTITY_TYPES } from "@/server/contracts/enums";
import type { BriefingStatus, DeepHealth, Status, UserCount } from "./briefing-shapes";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import {
  AreaHead,
  ConsoleNotices,
  EmptyLine,
  InlineAbsence,
  Metric,
  PanelTitle,
  Pill,
  ReadGate,
  formatAgo,
  formatDate,
  formatPercent,
  formatUsd,
  jobTone,
  stageLabel,
  useOperations,
  type PillTone,
} from "./console-primitives";
import { AuthRequired } from "./auth-required";
import { RouteUnavailable, callConsole, readConsole, useConsoleRead, type ReadState } from "./useConsoleRead";
import styles from "./admin.module.css";

type SubArea = "users" | "costs" | "audit" | "incidents" | "security" | "settings" | "environment";

const SUB_AREAS: Array<{ key: SubArea; label: string }> = [
  { key: "users", label: "Users & permissions" },
  { key: "costs", label: "Costs & usage" },
  { key: "audit", label: "Audit log" },
  { key: "incidents", label: "Incidents & recovery" },
  { key: "security", label: "Security & connections" },
  { key: "settings", label: "Settings" },
  { key: "environment", label: "Environment" },
];

const SURFACE_LABEL: Record<CostSurface, string> = {
  briefing: "Briefing",
  chat: "Public chat",
  ops_console: "Operations console",
  embedding: "Embeddings",
  other: "Other",
};

/**
 * System & Security — the seven sub-areas that are read rarely and matter
 * when they are: who can do what, what it costs, what happened, what is
 * broken, what is connected, how it is configured, and the environment
 * panels the old status section carried. Each sub-area reads on first
 * visit and stays mounted after, so switching back does not re-read.
 */
export function SystemPanel({ signal }: { signal: number }) {
  const [sub, setSub] = useState<SubArea>("users");
  const [visited, setVisited] = useState<Set<SubArea>>(() => new Set(["users"]));
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  /* STATE-004 — the focus fallback: the area itself. */
  const areaRef = useRef<HTMLElement | null>(null);
  const ops = useOperations();
  /* Incidents re-reads after a resolve or a retry through this local signal,
     added to the shell's. */
  const [incidentsTick, setIncidentsTick] = useState(0);

  function select(next: string) {
    const key = next as SubArea;
    setSub(key);
    setVisited((current) => (current.has(key) ? current : new Set(current).add(key)));
  }

  return (
    <section className={styles.area} id="console-system" aria-labelledby="console-system-heading" ref={areaRef} tabIndex={-1}>
      <AreaHead id="console-system" label="System & security" title="Who, what it costs, what happened, and what is connected" />
      <ConsoleNotices busy={ops.busy} notice={ops.notice} />

      <Tabs value={sub} onValueChange={select} activation="manual" className={styles.subTabs}>
        <TabList shape="segmented" label="System and security sub-areas">
          {SUB_AREAS.map((entry) => (
            <Tab key={entry.key} value={entry.key}>
              {entry.label}
            </Tab>
          ))}
        </TabList>
        <TabPanel value="users">{visited.has("users") ? <UsersSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="costs">{visited.has("costs") ? <CostsSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="audit">{visited.has("audit") ? <AuditSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="incidents">
          {visited.has("incidents") ? (
            <IncidentsSection signal={signal + incidentsTick} disabled={ops.disabled} onResolve={resolveAlert} onRetry={requestRetry} />
          ) : null}
        </TabPanel>
        <TabPanel value="security">{visited.has("security") ? <SecuritySection signal={signal} disabled={ops.disabled} run={ops.run} /> : null}</TabPanel>
        <TabPanel value="settings">{visited.has("settings") ? <SettingsSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="environment">{visited.has("environment") ? <EnvironmentSection signal={signal} /> : null}</TabPanel>
      </Tabs>

      <ConfirmDialog intent={confirmIntent} onClose={() => setConfirmIntent(null)} fallbackFocusRef={areaRef} />
    </section>
  );

  /* A plain retry re-queues and is asked for nothing. Resetting the attempt
     counter can loop a job that keeps failing, so that branch confirms. */
  function requestRetry(job: PipelineJob, resetAttempts: boolean) {
    if (!resetAttempts) {
      void retryJob(job, false);
      return;
    }
    setConfirmIntent({
      action: "Retry this job with its attempts reset",
      target: job.jobKey,
      targetDetail: `${stageLabel(job.stage)} · ${job.localDate} · ${job.attempts} of ${job.maxAttempts} attempts used`,
      consequence: "The attempt counter goes back to zero and the job runs again from its stage. A job that fails for the same reason will use its full attempt budget once more before it stops.",
      confirmLabel: "Reset and retry",
      tone: "danger",
      run: () => retryJob(job, true),
    });
  }

  async function retryJob(job: PipelineJob, resetAttempts: boolean) {
    await ops.run(`retry:${job.id}`, async () => {
      const result = await callConsole<RetryJobResult>(`admin/console/jobs/${job.id}/retry`, {
        method: "POST",
        body: { resetAttempts },
        failure: "Unable to retry the job.",
      });
      setIncidentsTick((current) => current + 1);
      return `Job ${job.jobKey} was re-queued (${result.previousState} → ${result.state})${result.dispatched ? " and dispatched." : "; it runs on the next tick."}`;
    });
  }

  async function resolveAlert(alertId: string, kind: string, note: string) {
    await ops.run(`resolve:${alertId}`, async () => {
      await callConsole(`admin/console/alerts/${alertId}/resolve`, {
        method: "POST",
        body: note.trim() ? { note: note.trim() } : {},
        failure: "Unable to resolve the alert.",
      });
      setIncidentsTick((current) => current + 1);
      return `Alert ${kind} was resolved.`;
    });
  }
}

/* ── Users & permissions ───────────────────────────────────────────────── */

function UsersSection({ signal }: { signal: number }) {
  const users = useConsoleRead<ConsoleUsers>("admin/console/users", { signal });
  return (
    <ReadGate state={users.state} what="users and permissions" reload={users.reload}>
      {(value) => (
        <>
          <div className={styles.compactMetrics}>
            <Metric label="Staff accounts" value={String(value.staff.length)} />
            <Metric label="Registered public users" value={String(value.registeredPublicUsers)} />
            <Metric
              label="Blocked sign-ins"
              value={value.blockedSignInAttempts === null ? "Not recorded" : String(value.blockedSignInAttempts)}
              tone={value.blockedSignInAttempts ? "warn" : undefined}
            />
            <Metric label="Generated" value={formatDate(value.generatedAt)} />
          </div>
          {value.blockedSignInAttempts === null ? (
            <p className={styles.muted}>Sign-in refusals are logged, not stored in the database, so there is no count to show. This is not zero.</p>
          ) : null}

          <div className={styles.panel}>
            <PanelTitle>Staff</PanelTitle>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Role</th>
                    <th scope="col">Capabilities</th>
                    <th scope="col">Last action</th>
                    <th scope="col">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {value.staff.map((user) => (
                    <tr key={user.id}>
                      <th scope="row">
                        <strong>{user.displayName}</strong>
                        <small className={styles.plainSmall}>{user.email ?? "no email"}</small>
                        {user.disabledAt ? <small>disabled {formatDate(user.disabledAt)}</small> : null}
                      </th>
                      <td>
                        {user.isAdmin ? <Pill tone="gold">admin</Pill> : null} {user.isAutomated ? <Pill tone="neutral">automated</Pill> : null}
                        {!user.isAdmin && !user.isAutomated ? <Pill tone="neutral">staff</Pill> : null}
                      </td>
                      <td>
                        {user.capabilities.length ? (
                          <ul className={styles.plainList}>
                            {user.capabilities.map((grant) => (
                              <li key={grant.capability}>
                                <strong>{grant.capability}</strong> · {grant.rationale} · {formatDate(grant.grantedAt)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "none"
                        )}
                      </td>
                      <td>{user.lastActionAt ? formatAgo(user.lastActionAt) : "never"}</td>
                      <td>{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.panel}>
            <PanelTitle>Recent admin actions</PanelTitle>
            {value.recentAdminActions.length ? (
              <ul className={styles.logList}>
                {value.recentAdminActions.map((entry) => (
                  <li key={entry.id}>
                    <span>
                      <Pill tone="neutral">{entry.entityType}</Pill>
                    </span>
                    <strong>{entry.action}</strong>
                    <small>
                      {entry.actorLabel} · {formatDate(entry.occurredAt)}
                      {entry.entityId ? ` · ${entry.entityId}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>No admin actions recorded.</EmptyLine>
            )}
          </div>
        </>
      )}
    </ReadGate>
  );
}

/* ── Costs & usage ─────────────────────────────────────────────────────── */

function Meter({ label, fraction, spent, budget, warnAt }: { label: string; fraction: number | null; spent: string; budget: string; warnAt: number }) {
  const tone: PillTone = fraction === null ? "neutral" : fraction >= 1 ? "danger" : fraction >= warnAt ? "warn" : "ok";
  const width = fraction === null ? 0 : Math.min(100, Math.round(fraction * 100));
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span>{label}</span>
        <Pill tone={tone}>{fraction === null ? "no budget" : formatPercent(fraction)}</Pill>
      </div>
      <div className={styles.meterTrack} role="img" aria-label={`${label}: ${spent} of ${budget}`}>
        <span className={`${styles.meterFill} ${styles[`meter${tone === "danger" ? "Danger" : tone === "warn" ? "Warn" : "Ok"}`]}`} style={{ width: `${width}%` }} />
      </div>
      <p className={styles.headNote}>
        {spent} of {budget}
      </p>
    </div>
  );
}

function CostTable<T extends Record<string, unknown>>({ caption, rows, columns }: { caption: string; rows: T[]; columns: Array<{ key: string; label: string; render: (row: T) => string }> }) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.tableCompact}`}>
        <caption className={styles.tableCaption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>Nothing recorded.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CostsSection({ signal }: { signal: number }) {
  const costs = useConsoleRead<ConsoleCosts>("admin/console/costs", { signal });
  return (
    <ReadGate state={costs.state} what="costs and usage" reload={costs.reload}>
      {(value) => (
        <>
          {value.warnings.length ? (
            <ul className={styles.warnList} {...politeLive}>
              {value.warnings.map((warning) => (
                <li key={warning} className={styles.warnNote}>
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
          <div className={styles.summary}>
            <Metric label="Today" value={formatUsd(value.spend.today)} />
            <Metric label="Last 24 hours" value={formatUsd(value.spend.last24HoursUsd)} />
            <Metric label="Month to date" value={formatUsd(value.spend.monthToDateUsd, 2)} />
            <Metric label="Last 30 days" value={formatUsd(value.spend.last30DaysUsd, 2)} />
          </div>

          <div className={styles.panel}>
            <PanelTitle note={`warning at ${formatPercent(value.warnAt)}`}>Budgets</PanelTitle>
            <div className={styles.meterGrid}>
              <Meter label="AI, daily" fraction={value.utilisation.aiDaily} spent={formatUsd(value.spend.today, 2)} budget={formatUsd(value.budgets.ai.dailyUsd, 2)} warnAt={value.warnAt} />
              <Meter label="AI, monthly" fraction={value.utilisation.aiMonthly} spent={formatUsd(value.spend.monthToDateUsd, 2)} budget={formatUsd(value.budgets.ai.monthlyUsd, 2)} warnAt={value.warnAt} />
              <Meter label="Briefing, monthly" fraction={value.utilisation.briefingMonthly} spent={formatUsd(value.spend.monthToDateUsd, 2)} budget={formatUsd(value.budgets.briefing.monthlyUsd, 2)} warnAt={value.warnAt} />
              <Meter
                label="Search, monthly"
                fraction={value.utilisation.searchMonthly}
                spent={`${value.search.successfulQueriesThisMonth} queries`}
                budget={value.budgets.search.monthlyQueries === null ? "no query budget" : `${value.budgets.search.monthlyQueries} queries`}
                warnAt={value.warnAt}
              />
            </div>
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>By surface</PanelTitle>
              <p className={styles.muted}>Public chat, the briefing, and this console spend from the same budget and are counted apart.</p>
              <CostTable
                caption="Spend by surface, last 30 days"
                rows={value.bySurface}
                columns={[
                  { key: "surface", label: "Surface", render: (row) => SURFACE_LABEL[row.surface] },
                  { key: "calls", label: "Calls", render: (row) => String(row.calls) },
                  { key: "cost", label: "Cost", render: (row) => formatUsd(row.costUsd) },
                ]}
              />
            </div>
            <div className={styles.panel}>
              <PanelTitle>By model</PanelTitle>
              <CostTable
                caption="Spend by model and profile, last 30 days"
                rows={value.byModel}
                columns={[
                  { key: "model", label: "Model", render: (row) => row.model },
                  { key: "profile", label: "Profile", render: (row) => row.profile },
                  { key: "calls", label: "Calls", render: (row) => String(row.calls) },
                  { key: "cost", label: "Cost", render: (row) => formatUsd(row.costUsd) },
                ]}
              />
            </div>
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>By kind</PanelTitle>
              <CostTable
                caption="Spend by run kind, last 30 days"
                rows={value.byKind}
                columns={[
                  { key: "kind", label: "Kind", render: (row) => row.kind },
                  { key: "calls", label: "Calls", render: (row) => String(row.calls) },
                  { key: "cost", label: "Cost", render: (row) => formatUsd(row.costUsd) },
                ]}
              />
            </div>
            <div className={styles.panel}>
              <PanelTitle>Search usage</PanelTitle>
              <div className={styles.compactMetrics}>
                <Metric label="Attempts this month" value={String(value.search.attemptsThisMonth)} />
                <Metric label="Successful queries" value={String(value.search.successfulQueriesThisMonth)} />
                <Metric label="Estimated spend" value={formatUsd(value.search.estimatedSpendUsd)} />
                <Metric label="Monthly cap" value={formatUsd(value.budgets.search.monthlyUsd, 2)} />
              </div>
            </div>
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>By day</PanelTitle>
              <CostTable
                caption="Daily spend"
                rows={value.byDay}
                columns={[
                  { key: "day", label: "Day", render: (row) => row.day },
                  { key: "calls", label: "Calls", render: (row) => String(row.calls) },
                  { key: "cost", label: "Cost", render: (row) => formatUsd(row.costUsd) },
                ]}
              />
            </div>
            <div className={styles.panel}>
              <PanelTitle>By month</PanelTitle>
              <CostTable
                caption="Monthly spend"
                rows={value.byMonth}
                columns={[
                  { key: "month", label: "Month", render: (row) => row.month },
                  { key: "calls", label: "Calls", render: (row) => String(row.calls) },
                  { key: "cost", label: "Cost", render: (row) => formatUsd(row.costUsd, 2) },
                ]}
              />
            </div>
          </div>
        </>
      )}
    </ReadGate>
  );
}

/* ── Audit log ─────────────────────────────────────────────────────────── */

type AuditFilters = { entityType: string; entityId: string; actor: string; action: string };

function auditQuery(filters: AuditFilters, before: string | null): string {
  const params = new URLSearchParams();
  params.set("limit", "50");
  if (before) params.set("before", before);
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.entityId.trim()) params.set("entityId", filters.entityId.trim());
  if (filters.actor.trim()) params.set("actor", filters.actor.trim());
  if (filters.action.trim()) params.set("action", filters.action.trim());
  return `admin/console/audit?${params.toString()}`;
}

/**
 * The audit log pages by keyset: each read carries `nextBefore`, the id of
 * the oldest entry seen, and "Load older" appends what follows. Filters
 * restart the list. A row expands to read its own entry, which is the only
 * read that carries the before and after states.
 */
function AuditSection({ signal }: { signal: number }) {
  const [filters, setFilters] = useState<AuditFilters>({ entityType: "", entityId: "", actor: "", action: "" });
  const [applied, setApplied] = useState<AuditFilters>(filters);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "auth-required" | "failed">("loading");
  const [failure, setFailure] = useState<string>("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    readConsole<AuditPage>(auditQuery(applied, null))
      .then((page) => {
        if (!live) return;
        setEntries(page.entries);
        setNextBefore(page.nextBefore);
        setState("ready");
      })
      .catch((cause: unknown) => {
        if (!live) return;
        if (cause instanceof AuthRequired) setState("auth-required");
        else if (cause instanceof RouteUnavailable) setState("unavailable");
        else {
          setFailure(cause instanceof Error ? cause.message : "Unable to read the audit log.");
          setState("failed");
        }
      });
    return () => {
      live = false;
    };
  }, [applied, signal, tick]);

  async function loadOlder() {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await readConsole<AuditPage>(auditQuery(applied, nextBefore));
      setEntries((current) => [...current, ...page.entries]);
      setNextBefore(page.nextBefore);
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : "Unable to read older entries.");
    } finally {
      setLoadingMore(false);
    }
  }

  /* Annotated rather than inferred: without it TypeScript widens the union
     across the four branches and the ready branch's value arrives as
     possibly undefined, which it never is. */
  const readState: ReadState<AuditEntry[]> =
    state === "loading"
      ? ({ kind: "loading" } as const)
      : state === "ready"
        ? ({ kind: "ready", value: entries } as const)
        : state === "failed"
          ? ({ kind: "failed", message: failure } as const)
          : ({ kind: state } as const);

  return (
    <>
      <form
        className={styles.filterRow}
        aria-label="Audit log filters"
        onSubmit={(event) => {
          event.preventDefault();
          setState("loading");
          setApplied(filters);
        }}
      >
        <SelectField className={styles.editorField} label="Entity type" value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}>
          <option value="">Any</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectField>
        <Field className={styles.editorField} label="Entity id" value={filters.entityId} onChange={(event) => setFilters({ ...filters, entityId: event.currentTarget.value })} placeholder="uuid" />
        <Field className={styles.editorField} label="Actor" value={filters.actor} onChange={(event) => setFilters({ ...filters, actor: event.currentTarget.value })} />
        <Field className={styles.editorField} label="Action prefix" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.currentTarget.value })} placeholder="publication." />
        <div className={styles.filterActions}>
          <Button variant="secondary" type="submit" disabled={state === "loading"}>
            Apply filters
          </Button>
        </div>
      </form>

      <ReadGate state={readState} what="the audit log" reload={() => { setState("loading"); setTick((current) => current + 1); }} skeleton={<Skeleton shape="block" height="20rem" />}>
        {(rows) =>
          rows.length ? (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className={styles.tableCaption}>Newest first. Expand a row to read what changed.</caption>
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Action</th>
                      <th scope="col">Entity</th>
                      <th scope="col">Request</th>
                      <th scope="col">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((entry) => (
                      <AuditRow key={entry.id} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.actionRow}>
                {nextBefore ? (
                  <Button variant="secondary" type="button" isLoading={loadingMore} onClick={loadOlder}>
                    Load older
                  </Button>
                ) : (
                  <p className={styles.muted}>This is the oldest entry the filter reaches.</p>
                )}
              </div>
            </>
          ) : (
            <EmptyLine>No audit entries match. The read succeeded; the filter excluded every row, or the log is empty.</EmptyLine>
          )
        }
      </ReadGate>
    </>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<{ kind: "idle" } | { kind: "loading" } | { kind: "ready"; value: AuditEntry } | { kind: "failed"; message: string }>({ kind: "idle" });

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || detail.kind === "ready" || detail.kind === "loading") return;
    setDetail({ kind: "loading" });
    try {
      setDetail({ kind: "ready", value: await readConsole<AuditEntry>(`admin/console/audit/${entry.id}`) });
    } catch (cause) {
      setDetail({ kind: "failed", message: cause instanceof Error ? cause.message : "Unable to read the entry." });
    }
  }

  return (
    <>
      <tr>
        <td>{formatDate(entry.occurredAt)}</td>
        <td>{entry.actorLabel}</td>
        <td>
          <strong>{entry.action}</strong>
        </td>
        <td>
          {entry.entityType}
          {entry.entityId ? <small className={styles.plainSmall}>{entry.entityId}</small> : null}
        </td>
        <td>{entry.requestId ?? "—"}</td>
        <td>
          {entry.hasBefore || entry.hasAfter ? (
            <Button variant="ghost" size="sm" type="button" aria-expanded={open} aria-controls={`audit-${entry.id}`} onClick={toggle}>
              {open ? "Hide" : "Show"} {entry.hasBefore && entry.hasAfter ? "before and after" : entry.hasBefore ? "before" : "after"}
            </Button>
          ) : (
            "—"
          )}
        </td>
      </tr>
      {open ? (
        <tr id={`audit-${entry.id}`} className={styles.auditDetail}>
          <td colSpan={6}>
            {detail.kind === "loading" ? <p className={styles.muted} aria-busy="true">Reading the entry…</p> : null}
            {detail.kind === "failed" ? <p className={styles.error}>{detail.message}</p> : null}
            {detail.kind === "ready" ? (
              <div className={styles.diffGrid}>
                <div>
                  <p className={styles.sectionLabel}>Before</p>
                  <pre className={styles.json}>{detail.value.beforeState === undefined ? "—" : JSON.stringify(detail.value.beforeState, null, 2)}</pre>
                </div>
                <div>
                  <p className={styles.sectionLabel}>After</p>
                  <pre className={styles.json}>{detail.value.afterState === undefined ? "—" : JSON.stringify(detail.value.afterState, null, 2)}</pre>
                </div>
              </div>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/* ── Incidents & recovery ──────────────────────────────────────────────── */

function IncidentsSection({
  signal,
  disabled,
  onResolve,
  onRetry,
}: {
  signal: number;
  disabled: boolean;
  onResolve: (alertId: string, kind: string, note: string) => void;
  onRetry: (job: PipelineJob, resetAttempts: boolean) => void;
}) {
  const incidents = useConsoleRead<ConsoleIncidents>("admin/console/incidents", { signal });
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <ReadGate state={incidents.state} what="incidents" reload={incidents.reload}>
      {(value) => (
        <>
          <div className={styles.compactMetrics}>
            <Metric label="Open alerts" value={String(value.openAlerts.length)} tone={value.openAlerts.some((alert) => alert.severity === "critical") ? "danger" : value.openAlerts.length ? "warn" : "ok"} />
            <Metric label="Stuck jobs" value={String(value.stuckJobs.length)} tone={value.stuckJobs.length ? "warn" : "ok"} />
            <Metric label="Quarantined jobs" value={String(value.quarantinedJobs.length)} tone={value.quarantinedJobs.length ? "warn" : "ok"} />
            <Metric label="Failed runs" value={String(value.failedRuns.length)} tone={value.failedRuns.length ? "danger" : "ok"} />
            <Metric label="Outbox undelivered" value={String(value.outbox.undelivered)} tone={value.outbox.undelivered ? "warn" : "ok"} />
            <Metric label="Outbox dead-lettered" value={String(value.outbox.deadLettered)} tone={value.outbox.deadLettered ? "danger" : "ok"} />
            <Metric label="Oldest undelivered" value={value.outbox.oldestAt ? formatAgo(value.outbox.oldestAt) : "none"} />
            <Metric label="Quarantine entries" value={String(value.quarantine.length)} />
          </div>

          <div className={styles.panel}>
            <PanelTitle note={`${value.openAlerts.length} open`}>Open alerts</PanelTitle>
            {value.openAlerts.length ? (
              <ul className={styles.alertList}>
                {value.openAlerts.map((alert) => (
                  <li key={alert.id} className={styles.alertRow}>
                    <div>
                      <p>
                        <Pill tone={alert.severity === "critical" ? "danger" : "warn"}>{alert.severity}</Pill> <strong>{alert.kind}</strong>
                      </p>
                      <p className={styles.alertMessage}>{alert.message}</p>
                      <p className={styles.headNote}>
                        raised {formatDate(alert.createdAt)} · {alert.notifiedAt ? "notification sent" : "notification pending"}
                      </p>
                      {alert.details ? (
                        <details className={styles.traceability}>
                          <summary>Details</summary>
                          <pre className={styles.json}>{JSON.stringify(alert.details, null, 2)}</pre>
                        </details>
                      ) : null}
                    </div>
                    <div className={styles.alertActions}>
                      <Field
                        className={styles.editorField}
                        label="Resolution note"
                        value={notes[alert.id] ?? ""}
                        maxLength={500}
                        onChange={(event) => setNotes({ ...notes, [alert.id]: event.currentTarget.value })}
                      />
                      <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onResolve(alert.id, alert.kind, notes[alert.id] ?? "")}>
                        Resolve
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>No open alerts. The read succeeded and the list is genuinely empty.</EmptyLine>
            )}
          </div>

          <div className={styles.panel}>
            <PanelTitle>Stuck and quarantined jobs</PanelTitle>
            {value.stuckJobs.length || value.quarantinedJobs.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Job</th>
                      <th scope="col">Stage</th>
                      <th scope="col">State</th>
                      <th scope="col">Attempts</th>
                      <th scope="col">Heartbeat</th>
                      <th scope="col">Last error</th>
                      <th scope="col">Recovery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...value.stuckJobs, ...value.quarantinedJobs].map((job) => (
                      <tr key={job.id}>
                        <th scope="row">
                          <strong>{job.jobKey}</strong>
                          <small className={styles.plainSmall}>{job.localDate}</small>
                        </th>
                        <td>{stageLabel(job.stage)}</td>
                        <td>
                          <Pill tone={jobTone(job.state)}>{job.state}</Pill>
                        </td>
                        <td>
                          {job.attempts} / {job.maxAttempts}
                        </td>
                        <td>{job.heartbeatAt ? formatAgo(job.heartbeatAt) : "none"}</td>
                        <td className={styles.errorCell}>{job.lastError ?? "—"}</td>
                        <td>
                          <div className={styles.cellActions}>
                            <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onRetry(job, false)}>
                              Retry
                            </Button>
                            {job.attempts >= job.maxAttempts ? (
                              <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onRetry(job, true)}>
                                Reset attempts and retry
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyLine>No stuck or quarantined jobs.</EmptyLine>
            )}
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>Failed runs</PanelTitle>
              {value.failedRuns.length ? (
                <ul className={styles.logList}>
                  {value.failedRuns.map((run) => (
                    <li key={run.id}>
                      <span>
                        <Pill tone="danger">failed</Pill>
                      </span>
                      <strong>
                        {run.localDate} · {stageLabel(run.stage)}
                      </strong>
                      <small>
                        {formatDate(run.startedAt)}
                        {run.error ? ` · ${run.error}` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>No failed runs.</EmptyLine>
              )}
            </div>
            <div className={styles.panel}>
              <PanelTitle>Quality quarantine</PanelTitle>
              {value.quarantine.length ? (
                <ul className={styles.logList}>
                  {value.quarantine.map((entry) => (
                    <li key={entry.id}>
                      <span>
                        <Pill tone="warn">{stageLabel(entry.stage)}</Pill>
                      </span>
                      <strong>{entry.candidateKey}</strong>
                      <small>
                        {entry.reason} · {formatDate(entry.createdAt)}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>No items in quarantine.</EmptyLine>
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <PanelTitle>Recently resolved</PanelTitle>
            {value.recentlyResolved.length ? (
              <ul className={styles.logList}>
                {value.recentlyResolved.map((alert) => (
                  <li key={alert.id}>
                    <span>
                      <Pill tone="ok">resolved</Pill>
                    </span>
                    <strong>{alert.kind}</strong>
                    <small>
                      {alert.message} · resolved {formatDate(alert.resolvedAt)}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>Nothing resolved recently.</EmptyLine>
            )}
          </div>
        </>
      )}
    </ReadGate>
  );
}

/* ── Security & connections ────────────────────────────────────────────── */

function SecuritySection({ signal, disabled, run }: { signal: number; disabled: boolean; run: (label: string, operation: () => Promise<string | null>) => Promise<void> }) {
  const security = useConsoleRead<ConsoleSecurity>("admin/console/security", { signal });
  const [probe, setProbe] = useState<DeepHealth | null>(null);

  async function runDeepHealth() {
    await run("health", async () => {
      setProbe(await readConsole<DeepHealth>("admin/health/deep"));
      return "The deep health check finished. Its result is shown under Connections.";
    });
  }

  return (
    <ReadGate state={security.state} what="security and connections" reload={security.reload}>
      {(value) => {
        const shown = probe ?? (value.lastProbe ? { status: value.lastProbe.status, checks: value.lastProbe.checks } : null);
        return (
          <>
            <div className={styles.twoColumns}>
              <div className={styles.panel}>
                <PanelTitle>Secrets</PanelTitle>
                <p className={styles.muted}>Configured or missing. Values are never shown here, and never sent to this page.</p>
                <ul className={styles.secretList}>
                  {value.secrets.map((secret) => (
                    <li key={secret.name}>
                      <Pill tone={secret.configured ? "ok" : "danger"}>{secret.configured ? "configured" : "missing"}</Pill>
                      <strong>{secret.name}</strong>
                      <small>{secret.purpose}</small>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.panel}>
                <PanelTitle>Connections</PanelTitle>
                <div className={styles.grid}>
                  {Object.entries(value.integrations).map(([name, active]) => (
                    <article className={styles.service} key={name}>
                      <Pill tone={active ? "ok" : "warn"}>{active ? "ready" : "waiting"}</Pill>
                      <h4>{name}</h4>
                    </article>
                  ))}
                </div>
                <div className={styles.actionRow}>
                  <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={runDeepHealth}>
                    Run deep health check
                  </Button>
                  {value.lastProbe && !probe ? <p className={styles.headNote}>last probe {formatAgo(value.lastProbe.at)}</p> : null}
                </div>
                {shown ? (
                  <div className={styles.healthStrip} aria-label="Health check result">
                    <span>
                      <Pill tone={shown.status === "ok" ? "ok" : "danger"}>overall {shown.status}</Pill>
                    </span>
                    {Object.entries(shown.checks).map(([name, check]) => (
                      <span key={name}>
                        {name} · <Pill tone={check.status === "ok" ? "ok" : "danger"}>{check.status}</Pill> · {check.latencyMs} ms
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className={styles.panel}>
              <PanelTitle>Resource identity</PanelTitle>
              <p className={styles.muted}>One-way fingerprints only, for comparing environments. Secrets and full identifiers are never shown here.</p>
              <div className={styles.compactMetrics}>
                {Object.entries(value.resourceFingerprints).map(([name, fingerprint]) => (
                  <Metric key={name} label={name} value={fingerprint ?? "Not set"} />
                ))}
              </div>
            </div>

            <div className={styles.twoColumns}>
              <div className={styles.panel}>
                <PanelTitle>Recent security events</PanelTitle>
                {value.recentSecurityEvents.length ? (
                  <ul className={styles.logList}>
                    {value.recentSecurityEvents.map((event) => (
                      <li key={event.id}>
                        <span>
                          <Pill tone="neutral">event</Pill>
                        </span>
                        <strong>{event.action}</strong>
                        <small>
                          {event.actorLabel} · {formatDate(event.occurredAt)}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>No security events recorded.</EmptyLine>
                )}
              </div>
              <div className={styles.panel}>
                <PanelTitle>Capability changes</PanelTitle>
                {value.capabilityChanges.length ? (
                  <ul className={styles.logList}>
                    {value.capabilityChanges.map((change) => (
                      <li key={change.id}>
                        <span>
                          <Pill tone="gold">grant</Pill>
                        </span>
                        <strong>{change.action}</strong>
                        <small>
                          {change.actorLabel} · {formatDate(change.occurredAt)}
                          {change.entityId ? ` · ${change.entityId}` : ""}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>No capability changes recorded.</EmptyLine>
                )}
              </div>
            </div>
          </>
        );
      }}
    </ReadGate>
  );
}

/* ── Settings ──────────────────────────────────────────────────────────── */

function SettingsSection({ signal }: { signal: number }) {
  const settings = useConsoleRead<ConsoleSettings>("admin/console/settings", { signal });
  return (
    <ReadGate state={settings.state} what="settings" reload={settings.reload}>
      {(value) => (
        <>
          <p className={styles.warnNote}>Read-only. {value.source}</p>
          <div className={styles.compactMetrics}>
            <Metric label="Environment" value={value.environment} />
            <Metric label="Region" value={value.region} />
            <Metric label="Site URL" value={value.siteUrl} />
            <Metric label="AI budget, daily" value={formatUsd(value.budgets.ai.dailyUsd, 2)} />
            <Metric label="AI budget, monthly" value={formatUsd(value.budgets.ai.monthlyUsd, 2)} />
            <Metric label="Briefing budget, daily" value={formatUsd(value.budgets.briefing.dailyUsd, 2)} />
            <Metric label="Briefing budget, monthly" value={formatUsd(value.budgets.briefing.monthlyUsd, 2)} />
            <Metric label="Search queries, monthly" value={value.budgets.search.monthlyQueries === null ? "Not set" : String(value.budgets.search.monthlyQueries)} />
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>Schedules</PanelTitle>
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.tableCompact}`}>
                  <thead>
                    <tr>
                      <th scope="col">Path</th>
                      <th scope="col">Schedule</th>
                      <th scope="col">What it does</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.schedules.map((schedule) => (
                      <tr key={schedule.path}>
                        <td>{schedule.path}</td>
                        <td>{schedule.schedule}</td>
                        <td>{schedule.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={styles.panel}>
              <PanelTitle>Models</PanelTitle>
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.tableCompact}`}>
                  <thead>
                    <tr>
                      <th scope="col">Profile</th>
                      <th scope="col">Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.models.map((model) => (
                      <tr key={model.profile}>
                        <td>{model.profile}</td>
                        <td>{model.slug}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>Sections in production</PanelTitle>
              <div className={styles.queueRow}>
                {value.sections.map((section) => (
                  <span key={section}>{section}</span>
                ))}
              </div>
            </div>
            <div className={styles.panel}>
              <PanelTitle>Search groups</PanelTitle>
              <div className={styles.queueRow}>
                {value.searchGroups.map((group) => (
                  <span key={group.group}>
                    <strong>{group.queries}</strong> {group.group}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </ReadGate>
  );
}

/* ── Environment — the old status section's panels ─────────────────────── */

function EnvironmentSection({ signal }: { signal: number }) {
  const status = useConsoleRead<Status>("admin/status", { signal });
  const userCount = useConsoleRead<UserCount>("admin/user-count", { signal });
  const briefing = useConsoleRead<BriefingStatus>("admin/briefing", { signal });
  return (
    <ReadGate state={status.state} what="the deployment status" reload={status.reload}>
      {(value) => {
        const migration = briefing.value?.migration;
        const migrationStatus = !migration
          ? null
          : migration.available
            ? `${migration.applied} migrations applied · latest version ${migration.latestId ?? "unknown"}${migration.latestAppliedAt ? ` · ${formatDate(migration.latestAppliedAt)}` : ""}`
            : "Migration status is not available in this environment.";
        return (
          <>
            <div className={styles.summary}>
              <Metric label="Environment" value={value.environment} />
              <Metric label="Queue region" value={value.region} />
              <Metric label="Monthly briefing cap" value={formatUsd(value.aiBudgetUsd, 2)} />
              <Metric label="Registered users" value={userCount.value ? String(userCount.value.registeredUsers) : "—"} />
              <Metric
                label="Public cache hits"
                value={value.publicReadCache.hitRatio === null ? "No data" : `${(value.publicReadCache.hitRatio * 100).toFixed(1)}% · ${value.publicReadCache.averageLoadMs ?? 0} ms`}
              />
              <Metric label="Sign-in" value="Google identity active" />
            </div>

            <div className={styles.grid}>
              {Object.entries(value.integrations).map(([name, active]) => (
                <article className={styles.service} key={name}>
                  <Pill tone={active ? "ok" : "warn"}>{active ? "ready" : "waiting"}</Pill>
                  <h4>{name}</h4>
                </article>
              ))}
            </div>

            <div className={styles.twoColumns}>
              <div className={styles.panel}>
                <PanelTitle>Resource identity</PanelTitle>
                <p className={styles.muted}>One-way fingerprints only, for comparing environments. Secrets and full identifiers are never shown here.</p>
                <div className={styles.compactMetrics}>
                  {Object.entries(value.resourceFingerprints ?? {}).map(([name, fingerprint]) => (
                    <Metric key={name} label={name} value={fingerprint ?? "Not set"} />
                  ))}
                </div>
              </div>
              <div className={styles.panel}>
                <PanelTitle>Database schema</PanelTitle>
                <InlineAbsence state={briefing.state} what="the briefing summary" reload={briefing.reload} />
                {migrationStatus ? <p className={styles.muted}>{migrationStatus}</p> : null}
              </div>
            </div>
          </>
        );
      }}
    </ReadGate>
  );
}
