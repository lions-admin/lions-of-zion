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
  ConsoleSystemInternals,
  ConsoleUsers,
  CostSurface,
  DrainOutboxResult,
  MaintenanceTickResult,
  PipelineJob,
  QuarantineOutcome,
  RetryJobResult,
} from "@/server/contracts/admin-console";
import { ENTITY_TYPES } from "@/server/contracts/enums";
import type { BriefingStatus, DeepHealth, Status, UserCount } from "./briefing-shapes";
import { ChatThreadsSection } from "./ChatThreadsSection";
import { LineageSection } from "./LineageSection";
import { PromptsSection } from "./PromptsSection";
import { ReportsSection } from "./ReportsSection";
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
import { AREA_LABEL, JOB_STATE_LABEL, SECTION_LABEL, SEVERITY_LABEL, SENTENCE, T } from "./lexicon";
import { AuthRequired } from "./auth-required";
import { AlertList, Stat, StatGrid } from "./_command/StatusCards";
import { RouteUnavailable, callConsole, readConsole, useConsoleRead, type ReadState } from "./useConsoleRead";
import cmd from "./command.module.css";
import styles from "./admin.module.css";

type SubArea = "users" | "costs" | "audit" | "incidents" | "security" | "settings" | "environment" | "reports" | "chat" | "prompts" | "lineage";

const SUB_AREAS: Array<{ key: SubArea; label: string }> = [
  { key: "users", label: "משתמשים והרשאות" },
  { key: "costs", label: "עלויות ושימוש" },
  { key: "audit", label: T.auditLog },
  { key: "incidents", label: "תקלות והתאוששות" },
  { key: "security", label: "אבטחה וחיבורים" },
  { key: "settings", label: "הגדרות" },
  { key: "environment", label: "סביבה" },
  { key: "reports", label: T.reportsTab },
  { key: "chat", label: T.chatTab },
  { key: "prompts", label: T.promptsTab },
  { key: "lineage", label: T.lineageTab },
];

const SURFACE_LABEL: Record<CostSurface, string> = {
  briefing: "בריף",
  chat: "צ׳אט ציבורי",
  ops_console: "קונסולת התפעול",
  embedding: "הטמעות",
  other: "אחר",
};

/**
 * System & Security — the sub-areas that are read rarely and matter when
 * they are: who can do what, what it costs, what happened, what is broken,
 * what is connected, how it is configured, and the environment panels the
 * old status section carried — then the final wave: the reports desk, the
 * public chat's moderation, the prompt registry, and the lineage lookups.
 * Each sub-area reads on first visit and stays mounted after, so switching
 * back does not re-read.
 */
export function SystemPanel({ signal }: { signal: number }) {
  const [sub, setSub] = useState<SubArea>("users");
  const [visited, setVisited] = useState<Set<SubArea>>(() => new Set(["users"]));
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  /* STATE-004 — the focus fallback: the area itself. */
  const areaRef = useRef<HTMLElement | null>(null);
  /* The discard note is typed inside the confirmation; it lives in a ref so
     the dialog does not re-render its opener on every keystroke — the same
     pattern the source enable/disable reason uses. */
  const noteRef = useRef<string>("");
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
      <AreaHead id="console-system" label={AREA_LABEL.system} title="מי, כמה זה עולה, מה קרה, ומה מחובר" />
      <ConsoleNotices busy={ops.busy} notice={ops.notice} />

      <Tabs value={sub} onValueChange={select} activation="manual" className={styles.subTabs}>
        <div className={cmd.consoleNav}>
        <TabList shape="segmented" label="תת-אזורים של מערכת ואבטחה">
          {SUB_AREAS.map((entry) => (
            <Tab key={entry.key} value={entry.key}>
              {entry.label}
            </Tab>
          ))}
        </TabList>
        </div>
        <TabPanel value="users">{visited.has("users") ? <UsersSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="costs">{visited.has("costs") ? <CostsSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="audit">{visited.has("audit") ? <AuditSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="incidents">
          {visited.has("incidents") ? (
            <IncidentsSection
              signal={signal + incidentsTick}
              disabled={ops.disabled}
              onResolve={resolveAlert}
              onRetry={requestRetry}
              onDrain={drainOutboxNow}
              onMaintenance={runMaintenanceTick}
              onQuarantineResolve={resolveQuarantine}
              onDiscard={requestDiscard}
            />
          ) : null}
        </TabPanel>
        <TabPanel value="security">{visited.has("security") ? <SecuritySection signal={signal} disabled={ops.disabled} run={ops.run} /> : null}</TabPanel>
        <TabPanel value="settings">{visited.has("settings") ? <SettingsSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="environment">{visited.has("environment") ? <EnvironmentSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="reports">{visited.has("reports") ? <ReportsSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="chat">{visited.has("chat") ? <ChatThreadsSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="prompts">{visited.has("prompts") ? <PromptsSection signal={signal} /> : null}</TabPanel>
        <TabPanel value="lineage">{visited.has("lineage") ? <LineageSection /> : null}</TabPanel>
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
      action: "הרצת המשימה הזו מחדש עם איפוס הניסיונות",
      target: job.jobKey,
      targetDetail: `${stageLabel(job.stage)} · ${job.localDate} · נוצלו ${job.attempts} מתוך ${job.maxAttempts} ניסיונות`,
      consequence: "מונה הניסיונות חוזר לאפס והמשימה רצה שוב מהשלב שלה. משימה שנכשלת מאותה סיבה תנצל שוב את מלוא מכסת הניסיונות שלה לפני שתיעצר.",
      confirmLabel: "איפוס והרצה מחדש",
      tone: "danger",
      run: () => retryJob(job, true),
    });
  }

  async function retryJob(job: PipelineJob, resetAttempts: boolean) {
    await ops.run(`retry:${job.id}`, async () => {
      const result = await callConsole<RetryJobResult>(`admin/console/jobs/${job.id}/retry`, {
        method: "POST",
        body: { resetAttempts },
        failure: "לא ניתן להריץ את המשימה מחדש.",
      });
      setIncidentsTick((current) => current + 1);
      return `המשימה ${job.jobKey} הוחזרה לתור (${result.previousState} → ${result.state})${result.dispatched ? " ונשלחה לביצוע." : "; היא תרוץ בטיק הבא."}`;
    });
  }

  async function resolveAlert(alertId: string, kind: string, note: string) {
    await ops.run(`resolve:${alertId}`, async () => {
      await callConsole(`admin/console/alerts/${alertId}/resolve`, {
        method: "POST",
        body: note.trim() ? { note: note.trim() } : {},
        failure: "לא ניתן לסמן את ההתראה כטופלה.",
      });
      setIncidentsTick((current) => current + 1);
      return `ההתראה ${kind} סומנה כטופלה.`;
    });
  }

  /* The outbox drain is reversible — whatever is not delivered stays in the
     queue — so it is asked for nothing. The route's body is optional; a bare
     POST drains with the drain's own default ceiling. */
  async function drainOutboxNow() {
    await ops.run("outbox-drain", async () => {
      const result = await callConsole<DrainOutboxResult>("admin/console/outbox/drain", {
        method: "POST",
        failure: T.drainFailure,
      });
      setIncidentsTick((current) => current + 1);
      return SENTENCE.drained(result.attempted, result.dispatched, result.failed);
    });
  }

  /* The maintenance tick is the same run the cron does every minute. The
     runners bind the database internally, so a real call outside production
     can answer problem+json — `callConsole` turns that into a thrown Error
     with the problem's detail, and `ops.run` surfaces it as the area's error
     notice like any other failure. */
  async function runMaintenanceTick() {
    await ops.run("maintenance-tick", async () => {
      const result = await callConsole<MaintenanceTickResult>("admin/console/maintenance/tick", {
        method: "POST",
        failure: T.maintenanceFailure,
      });
      setIncidentsTick((current) => current + 1);
      return SENTENCE.maintenanceDone(result.briefingJobs.recovered, result.briefingAlerts.evaluated, result.briefingAlerts.created);
    });
  }

  /* Resolving a quarantined candidate is asked for nothing: it records that
     the candidate was handled. Discarding removes it from the recovery
     queue with no re-run, so that goes through the shared confirmation and
     the note the route requires. */
  async function resolveQuarantine(entry: ConsoleIncidents["quarantine"][number]) {
    await ops.run(`quarantine:${entry.id}`, async () => {
      await callConsole<QuarantineOutcome>(`admin/console/quarantine/${entry.id}/resolve`, {
        method: "POST",
        body: {},
        failure: T.quarantineResolveFailure,
      });
      setIncidentsTick((current) => current + 1);
      return SENTENCE.quarantineResolved(entry.candidateKey);
    });
  }

  function requestDiscard(entry: ConsoleIncidents["quarantine"][number]) {
    noteRef.current = "";
    setConfirmIntent({
      action: T.discardAction,
      target: entry.candidateKey,
      targetDetail: `${stageLabel(entry.stage)} · ${formatDate(entry.createdAt)}`,
      consequence: T.discardConsequence,
      confirmLabel: T.discard,
      tone: "danger",
      run: () => discardQuarantine(entry),
      body: (
        <Field
          className={styles.editorField}
          name="note"
          label={T.reason}
          description={T.reasonNote}
          required
          maxLength={500}
          onChange={(event) => {
            noteRef.current = event.currentTarget.value;
          }}
        />
      ),
    });
  }

  async function discardQuarantine(entry: ConsoleIncidents["quarantine"][number]) {
    const note = noteRef.current.trim();
    await ops.run(`discard:${entry.id}`, async () => {
      if (!note) throw new Error(SENTENCE.needReason());
      await callConsole<QuarantineOutcome>(`admin/console/quarantine/${entry.id}/discard`, {
        method: "POST",
        body: { note },
        failure: T.discardFailure,
      });
      setIncidentsTick((current) => current + 1);
      return SENTENCE.quarantineDiscarded(entry.candidateKey);
    });
  }
}

/* ── Users & permissions ───────────────────────────────────────────────── */

function UsersSection({ signal }: { signal: number }) {
  const users = useConsoleRead<ConsoleUsers>("admin/console/users", { signal });
  return (
    <ReadGate state={users.state} what="המשתמשים וההרשאות" reload={users.reload}>
      {(value) => (
        <>
          <StatGrid>
            <Stat label="חשבונות צוות" value={String(value.staff.length)} />
            <Stat label="משתמשים ציבוריים רשומים" value={String(value.registeredPublicUsers)} />
            <Stat
              label="התחברויות שנחסמו"
              /* `null` means the count was never recorded, which is not the
                 same fact as a count of zero. The two must not share a word. */
              value={value.blockedSignInAttempts === null ? "לא נרשם" : String(value.blockedSignInAttempts)}
              tone={value.blockedSignInAttempts ? "warn" : undefined}
            />
            <Stat label="נוצר" value={formatDate(value.generatedAt)} />
          </StatGrid>
          {value.blockedSignInAttempts === null ? (
            <p className={styles.muted}>סירובי התחברות נרשמים ביומן ואינם נשמרים במסד הנתונים, ולכן אין מונה להציג. זה אינו אפס.</p>
          ) : null}

          <div className={styles.panel}>
            <PanelTitle>צוות</PanelTitle>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">חשבון</th>
                    <th scope="col">תפקיד</th>
                    <th scope="col">{T.capabilities}</th>
                    <th scope="col">פעולה אחרונה</th>
                    <th scope="col">נוצר</th>
                  </tr>
                </thead>
                <tbody>
                  {value.staff.map((user) => (
                    <tr key={user.id}>
                      <th scope="row">
                        <strong>{user.displayName}</strong>
                        <small className={styles.plainSmall}>{user.email ?? "ללא דוא״ל"}</small>
                        {user.disabledAt ? <small>הושבת {formatDate(user.disabledAt)}</small> : null}
                      </th>
                      <td>
                        {user.isAdmin ? <Pill tone="gold">מנהל</Pill> : null} {user.isAutomated ? <Pill tone="neutral">אוטומטי</Pill> : null}
                        {!user.isAdmin && !user.isAutomated ? <Pill tone="neutral">צוות</Pill> : null}
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
                          T.none
                        )}
                      </td>
                      <td>{user.lastActionAt ? formatAgo(user.lastActionAt) : T.never}</td>
                      <td>{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.panel}>
            <PanelTitle>פעולות ניהול אחרונות</PanelTitle>
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
              <EmptyLine>לא נרשמו פעולות ניהול.</EmptyLine>
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
        <Pill tone={tone}>{fraction === null ? "אין תקציב" : formatPercent(fraction)}</Pill>
      </div>
      <div className={styles.meterTrack} role="img" aria-label={`${label}: ${spent} מתוך ${budget}`}>
        <span className={`${styles.meterFill} ${styles[`meter${tone === "danger" ? "Danger" : tone === "warn" ? "Warn" : "Ok"}`]}`} style={{ width: `${width}%` }} />
      </div>
      <p className={styles.headNote}>
        {spent} מתוך {budget}
      </p>
    </div>
  );
}

function CostTable<T extends Record<string, unknown>>({ caption, rows, columns }: { caption: string; rows: T[]; columns: Array<{ key: string; label: string; render: (row: T) => string }> }) {
  const [titleColumn, ...factColumns] = columns;
  return (
    <>
      <div className={`${styles.tableWrap} ${cmd.desktopOnly}`}>
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
                <td colSpan={columns.length}>לא נרשם דבר.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Narrow screens get cards: the first column names the row, the rest
          become labelled facts. Same strings, no separate data path. */}
      <div className={cmd.sourceCards} aria-label={caption}>
        {rows.length ? (
          rows.map((row, index) => (
            <article key={index} className={cmd.sourceCard}>
              <div className={cmd.sourceCardHead}>
                <h3 className={cmd.sourceCardName}>
                  <bdi>{titleColumn.render(row)}</bdi>
                </h3>
              </div>
              {factColumns.map((column) => (
                <p key={column.key} className={cmd.sourceCardMeta}>
                  {column.label} <bdi>{column.render(row)}</bdi>
                </p>
              ))}
            </article>
          ))
        ) : (
          <p className={cmd.sourceCardMeta}>לא נרשם דבר.</p>
        )}
      </div>
    </>
  );
}

function CostsSection({ signal }: { signal: number }) {
  const costs = useConsoleRead<ConsoleCosts>("admin/console/costs", { signal });
  return (
    <ReadGate state={costs.state} what="העלויות והשימוש" reload={costs.reload}>
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
          <StatGrid>
            <Stat label="היום" value={formatUsd(value.spend.today)} />
            <Stat label={T.last24h} value={formatUsd(value.spend.last24HoursUsd)} />
            <Stat label="מתחילת החודש" value={formatUsd(value.spend.monthToDateUsd, 2)} />
            <Stat label={T.last30d} value={formatUsd(value.spend.last30DaysUsd, 2)} />
          </StatGrid>

          <div className={styles.panel}>
            <PanelTitle note={`אזהרה ב-${formatPercent(value.warnAt)}`}>תקציבים</PanelTitle>
            <div className={styles.meterGrid}>
              <Meter label="AI, יומי" fraction={value.utilisation.aiDaily} spent={formatUsd(value.spend.today, 2)} budget={formatUsd(value.budgets.ai.dailyUsd, 2)} warnAt={value.warnAt} />
              <Meter label="AI, חודשי" fraction={value.utilisation.aiMonthly} spent={formatUsd(value.spend.monthToDateUsd, 2)} budget={formatUsd(value.budgets.ai.monthlyUsd, 2)} warnAt={value.warnAt} />
              <Meter label="בריף, חודשי" fraction={value.utilisation.briefingMonthly} spent={formatUsd(value.spend.monthToDateUsd, 2)} budget={formatUsd(value.budgets.briefing.monthlyUsd, 2)} warnAt={value.warnAt} />
              <Meter
                label="חיפוש, חודשי"
                fraction={value.utilisation.searchMonthly}
                spent={`${value.search.successfulQueriesThisMonth} שאילתות`}
                budget={value.budgets.search.monthlyQueries === null ? "אין תקציב שאילתות" : `${value.budgets.search.monthlyQueries} שאילתות`}
                warnAt={value.warnAt}
              />
            </div>
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>לפי אזור שימוש</PanelTitle>
              <p className={styles.muted}>הצ׳אט הציבורי, הבריף והקונסולה הזו מוציאים מאותו תקציב ונספרים בנפרד.</p>
              <CostTable
                caption={`הוצאה לפי אזור שימוש, ${T.last30d}`}
                rows={value.bySurface}
                columns={[
                  { key: "surface", label: "אזור שימוש", render: (row) => SURFACE_LABEL[row.surface] },
                  { key: "calls", label: "קריאות", render: (row) => String(row.calls) },
                  { key: "cost", label: T.cost, render: (row) => formatUsd(row.costUsd) },
                ]}
              />
            </div>
            <div className={styles.panel}>
              <PanelTitle>לפי מודל</PanelTitle>
              <CostTable
                caption={`הוצאה לפי מודל ופרופיל, ${T.last30d}`}
                rows={value.byModel}
                columns={[
                  { key: "model", label: "מודל", render: (row) => row.model },
                  { key: "profile", label: "פרופיל", render: (row) => row.profile },
                  { key: "calls", label: "קריאות", render: (row) => String(row.calls) },
                  { key: "cost", label: T.cost, render: (row) => formatUsd(row.costUsd) },
                ]}
              />
            </div>
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>לפי סוג</PanelTitle>
              <CostTable
                caption={`הוצאה לפי סוג ${T.run}, ${T.last30d}`}
                rows={value.byKind}
                columns={[
                  { key: "kind", label: "סוג", render: (row) => row.kind },
                  { key: "calls", label: "קריאות", render: (row) => String(row.calls) },
                  { key: "cost", label: T.cost, render: (row) => formatUsd(row.costUsd) },
                ]}
              />
            </div>
            <div className={styles.panel}>
              <PanelTitle>שימוש בחיפוש</PanelTitle>
              <StatGrid>
                <Stat label={`${T.attempts} ${T.thisMonth}`} value={String(value.search.attemptsThisMonth)} />
                <Stat label="שאילתות מוצלחות" value={String(value.search.successfulQueriesThisMonth)} />
                <Stat label="הוצאה משוערת" value={formatUsd(value.search.estimatedSpendUsd)} />
                <Stat
                  label={T.actualSearchSpend}
                  /* Additive and optional: absent means nothing reported a
                     cost, which is a fact about the ledger, not a zero. */
                  value={value.search.actualSpendUsd === undefined ? T.notRecorded : formatUsd(value.search.actualSpendUsd)}
                />
                <Stat label="תקרה חודשית" value={formatUsd(value.budgets.search.monthlyUsd, 2)} />
              </StatGrid>
            </div>
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>לפי יום</PanelTitle>
              <CostTable
                caption="הוצאה יומית"
                rows={value.byDay}
                columns={[
                  { key: "day", label: "יום", render: (row) => row.day },
                  { key: "calls", label: "קריאות", render: (row) => String(row.calls) },
                  { key: "cost", label: T.cost, render: (row) => formatUsd(row.costUsd) },
                ]}
              />
            </div>
            <div className={styles.panel}>
              <PanelTitle>לפי חודש</PanelTitle>
              <CostTable
                caption="הוצאה חודשית"
                rows={value.byMonth}
                columns={[
                  { key: "month", label: "חודש", render: (row) => row.month },
                  { key: "calls", label: "קריאות", render: (row) => String(row.calls) },
                  { key: "cost", label: T.cost, render: (row) => formatUsd(row.costUsd, 2) },
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
 * the oldest entry seen, and the load-older control appends what follows. Filters
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
          setFailure(cause instanceof Error ? cause.message : `לא ניתן לקרוא את ${T.auditLog}.`);
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
      setFailure(cause instanceof Error ? cause.message : "לא ניתן לקרוא רשומות ישנות יותר.");
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
        aria-label={`סינון ${T.auditLog}`}
        onSubmit={(event) => {
          event.preventDefault();
          setState("loading");
          setApplied(filters);
        }}
      >
        <SelectField className={styles.editorField} label="סוג ישות" value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })}>
          <option value="">הכול</option>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectField>
        <Field className={styles.editorField} label="מזהה ישות" value={filters.entityId} onChange={(event) => setFilters({ ...filters, entityId: event.currentTarget.value })} placeholder="uuid" />
        <Field className={styles.editorField} label="מבצע" value={filters.actor} onChange={(event) => setFilters({ ...filters, actor: event.currentTarget.value })} />
        <Field className={styles.editorField} label="תחילית פעולה" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.currentTarget.value })} placeholder="publication." />
        <div className={styles.filterActions}>
          <Button variant="secondary" type="submit" disabled={state === "loading"}>
            {T.applyFilters}
          </Button>
        </div>
      </form>

      <ReadGate state={readState} what={T.auditLog} reload={() => { setState("loading"); setTick((current) => current + 1); }} skeleton={<Skeleton shape="block" height="20rem" />}>
        {(rows) =>
          rows.length ? (
            <>
              <div className={`${styles.tableWrap} ${cmd.desktopOnly}`}>
                <table className={styles.table}>
                  <caption className={styles.tableCaption}>החדשות ביותר בראש. יש להרחיב שורה כדי לקרוא מה השתנה.</caption>
                  <thead>
                    <tr>
                      <th scope="col">מתי</th>
                      <th scope="col">מבצע</th>
                      {/* The header is Hebrew; the values under it stay Latin.
                          An audit action is what you grep the log for. */}
                      <th scope="col">פעולה</th>
                      <th scope="col">ישות</th>
                      <th scope="col">בקשה</th>
                      <th scope="col">שינוי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((entry) => (
                      <AuditRow key={entry.id} entry={entry} />
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Narrow screens get cards, not a shrunken six-column table. */}
              <div className={cmd.sourceCards} aria-label="רשומות ביקורת">
                {rows.map((entry) => (
                  <AuditCard key={entry.id} entry={entry} />
                ))}
              </div>
              <div className={styles.actionRow}>
                {nextBefore ? (
                  <Button variant="secondary" type="button" isLoading={loadingMore} onClick={loadOlder}>
                    {T.loadOlder}
                  </Button>
                ) : (
                  <p className={styles.muted}>זו הרשומה הישנה ביותר שהסינון מגיע אליה.</p>
                )}
              </div>
            </>
          ) : (
            <EmptyLine>אין רשומות ביקורת תואמות. הקריאה הצליחה; הסינון הוציא כל שורה, או שהיומן ריק.</EmptyLine>
          )
        }
      </ReadGate>
    </>
  );
}

type AuditDetail = { kind: "idle" } | { kind: "loading" } | { kind: "ready"; value: AuditEntry } | { kind: "failed"; message: string };

/** One audit entry's expandable before/after read, shared by the desktop
 *  table row and the narrow-screen card — one fetch path, two layouts. */
function useAuditDetail(entry: AuditEntry) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AuditDetail>({ kind: "idle" });

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || detail.kind === "ready" || detail.kind === "loading") return;
    setDetail({ kind: "loading" });
    try {
      setDetail({ kind: "ready", value: await readConsole<AuditEntry>(`admin/console/audit/${entry.id}`) });
    } catch (cause) {
      setDetail({ kind: "failed", message: cause instanceof Error ? cause.message : "לא ניתן לקרוא את הרשומה." });
    }
  }

  return { open, toggle, detail };
}

function AuditDetailBody({ detail, entryId }: { detail: AuditDetail; entryId: string }) {
  /* The id stays mounted in every state so the expander's `aria-controls`
     always points at a live element. */
  return (
    <div id={`audit-${entryId}`}>
      {detail.kind === "loading" ? <p className={styles.muted} aria-busy="true">קורא את הרשומה…</p> : null}
      {detail.kind === "failed" ? <p className={styles.error}>{detail.message}</p> : null}
      {detail.kind === "ready" ? (
        <div className={styles.diffGrid}>
          <div>
            <p className={styles.sectionLabel}>לפני</p>
            <pre className={styles.json}>{detail.value.beforeState === undefined ? "—" : JSON.stringify(detail.value.beforeState, null, 2)}</pre>
          </div>
          <div>
            <p className={styles.sectionLabel}>אחרי</p>
            <pre className={styles.json}>{detail.value.afterState === undefined ? "—" : JSON.stringify(detail.value.afterState, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * One audit entry as a card: the narrow-screen replacement for a table row.
 * Exported for visual QA previews; the audit section is its only production user.
 */
export function AuditCard({ entry }: { entry: AuditEntry }) {
  const { open, toggle, detail } = useAuditDetail(entry);
  const canExpand = entry.hasBefore || entry.hasAfter;
  return (
    <article className={cmd.sourceCard} aria-label={`${entry.action} · ${entry.id}`}>
      <div className={cmd.sourceCardHead}>
        <h3 className={cmd.sourceCardName}>
          <bdi>{entry.action}</bdi>
        </h3>
        <Pill tone="neutral">{entry.entityType}</Pill>
      </div>
      <p className={cmd.sourceCardMeta}>
        {entry.actorLabel} · {formatDate(entry.occurredAt)}
      </p>
      {entry.entityId ? (
        <p className={cmd.sourceCardId}>
          <bdi>{entry.entityId}</bdi>
        </p>
      ) : null}
      <p className={cmd.sourceCardMeta}>בקשה <bdi>{entry.requestId ?? "—"}</bdi></p>
      <div className={cmd.sourceCardActions}>
        {canExpand ? (
          <Button variant="ghost" size="sm" type="button" aria-expanded={open} aria-controls={`audit-${entry.id}`} onClick={toggle}>
            {open ? "הסתרת" : "הצגת"} {entry.hasBefore && entry.hasAfter ? "לפני ואחרי" : entry.hasBefore ? "לפני" : "אחרי"}
          </Button>
        ) : null}
      </div>
      {open ? <AuditDetailBody detail={detail} entryId={entry.id} /> : null}
    </article>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const { open, toggle, detail } = useAuditDetail(entry);

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
              {open ? "הסתרת" : "הצגת"} {entry.hasBefore && entry.hasAfter ? "לפני ואחרי" : entry.hasBefore ? "לפני" : "אחרי"}
            </Button>
          ) : (
            "—"
          )}
        </td>
      </tr>
      {open ? (
        <tr className={styles.auditDetail}>
          <td colSpan={6}>
            <AuditDetailBody detail={detail} entryId={entry.id} />
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
  onDrain,
  onMaintenance,
  onQuarantineResolve,
  onDiscard,
}: {
  signal: number;
  disabled: boolean;
  onResolve: (alertId: string, kind: string, note: string) => void;
  onRetry: (job: PipelineJob, resetAttempts: boolean) => void;
  onDrain: () => void;
  onMaintenance: () => void;
  onQuarantineResolve: (entry: ConsoleIncidents["quarantine"][number]) => void;
  onDiscard: (entry: ConsoleIncidents["quarantine"][number]) => void;
}) {
  const incidents = useConsoleRead<ConsoleIncidents>("admin/console/incidents", { signal });
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <ReadGate state={incidents.state} what="התקלות" reload={incidents.reload}>
      {(value) => (
        <>
          <StatGrid>
            <Stat label="התראות פתוחות" value={String(value.openAlerts.length)} tone={value.openAlerts.some((alert) => alert.severity === "critical") ? "danger" : value.openAlerts.length ? "warn" : "ok"} />
            <Stat label="משימות תקועות" value={String(value.stuckJobs.length)} tone={value.stuckJobs.length ? "warn" : "ok"} />
            <Stat label="משימות בבידוד" value={String(value.quarantinedJobs.length)} tone={value.quarantinedJobs.length ? "warn" : "ok"} />
            <Stat label="ריצות שנכשלו" value={String(value.failedRuns.length)} tone={value.failedRuns.length ? "danger" : "ok"} />
            <Stat label="Outbox — לא נמסרו" value={String(value.outbox.undelivered)} tone={value.outbox.undelivered ? "warn" : "ok"} />
            <Stat label="Outbox — נזנחו" value={String(value.outbox.deadLettered)} tone={value.outbox.deadLettered ? "danger" : "ok"} />
            <Stat label="הישן ביותר שלא נמסר" value={value.outbox.oldestAt ? formatAgo(value.outbox.oldestAt) : T.none} />
            <Stat label="רשומות בבידוד" value={String(value.quarantine.length)} />
          </StatGrid>

          <div className={styles.panel}>
            <PanelTitle note={`${value.openAlerts.length} פתוחות`}>התראות פתוחות</PanelTitle>
            {value.openAlerts.length ? (
              <AlertList
                severityWord={(severity) => SEVERITY_LABEL[severity] ?? severity}
                items={value.openAlerts.map((alert) => ({
                  id: alert.id,
                  severity: alert.severity,
                  kind: alert.kind,
                  message: alert.message,
                  time: `נפתחה ${formatDate(alert.createdAt)}`,
                  extra: alert.notifiedAt ? "נשלחה התראה" : "התראה ממתינה",
                  details: alert.details ? (
                    <details className={styles.traceability}>
                      <summary>פרטים</summary>
                      <pre className={styles.json}>{JSON.stringify(alert.details, null, 2)}</pre>
                    </details>
                  ) : undefined,
                  action: (
                    <>
                      <Field
                        className={styles.editorField}
                        label="הערת טיפול"
                        value={notes[alert.id] ?? ""}
                        maxLength={500}
                        onChange={(event) => setNotes({ ...notes, [alert.id]: event.currentTarget.value })}
                      />
                      <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onResolve(alert.id, alert.kind, notes[alert.id] ?? "")}>
                        {T.resolve}
                      </Button>
                    </>
                  ),
                }))}
              />
            ) : (
              <EmptyLine>אין התראות פתוחות. הקריאה הצליחה והרשימה באמת ריקה.</EmptyLine>
            )}
          </div>

          <div className={styles.panel}>
            <PanelTitle>משימות תקועות ובבידוד</PanelTitle>
            {value.stuckJobs.length || value.quarantinedJobs.length ? (
              <>
                <div className={`${styles.tableWrap} ${cmd.desktopOnly}`}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th scope="col">{T.job}</th>
                        <th scope="col">שלב</th>
                        <th scope="col">מצב</th>
                        <th scope="col">{T.attempts}</th>
                        <th scope="col">פעימת לב</th>
                        <th scope="col">{T.lastError}</th>
                        <th scope="col">התאוששות</th>
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
                            <Pill tone={jobTone(job.state)}>{JOB_STATE_LABEL[job.state] ?? job.state}</Pill>
                          </td>
                          <td>
                            {job.attempts} / {job.maxAttempts}
                          </td>
                          <td>{job.heartbeatAt ? formatAgo(job.heartbeatAt) : T.none}</td>
                          <td className={styles.errorCell}>{job.lastError ?? "—"}</td>
                          <td>
                            <div className={styles.cellActions}>
                              <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onRetry(job, false)}>
                                {T.retry}
                              </Button>
                              {job.attempts >= job.maxAttempts ? (
                                <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onRetry(job, true)}>
                                  איפוס ניסיונות והרצה מחדש
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={cmd.sourceCards} aria-label="משימות תקועות ובבידוד">
                  {[...value.stuckJobs, ...value.quarantinedJobs].map((job) => (
                    <article key={job.id} className={cmd.sourceCard} aria-label={job.jobKey}>
                      <div className={cmd.sourceCardHead}>
                        <h3 className={cmd.sourceCardName}>
                          <bdi>{job.jobKey}</bdi>
                        </h3>
                        <Pill tone={jobTone(job.state)}>{JOB_STATE_LABEL[job.state] ?? job.state}</Pill>
                      </div>
                      <p className={cmd.sourceCardMeta}>
                        {stageLabel(job.stage)} · <bdi>{job.localDate}</bdi> · {T.attempts}{" "}
                        <bdi>{job.attempts} / {job.maxAttempts}</bdi>
                      </p>
                      <p className={cmd.sourceCardMeta}>פעימת לב {job.heartbeatAt ? formatAgo(job.heartbeatAt) : T.none}</p>
                      {job.lastError ? <p className={cmd.sourceCardError}>{job.lastError}</p> : null}
                      <div className={cmd.sourceCardActions}>
                        <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onRetry(job, false)}>
                          {T.retry}
                        </Button>
                        {job.attempts >= job.maxAttempts ? (
                          <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onRetry(job, true)}>
                            איפוס ניסיונות והרצה מחדש
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <EmptyLine>אין משימות תקועות או בבידוד.</EmptyLine>
            )}
          </div>

          <div className={styles.panel}>
            <PanelTitle note={`${value.outbox.undelivered} ${T.outboxUndelivered}`}>{T.outboxPanel}</PanelTitle>
            <p className={styles.muted}>{T.outboxDrainNote}</p>
            <div className={styles.compactMetrics}>
              <Metric label={T.outboxUndelivered} value={String(value.outbox.undelivered)} tone={value.outbox.undelivered ? "warn" : "ok"} />
              <Metric label={T.outboxDeadLettered} value={String(value.outbox.deadLettered)} tone={value.outbox.deadLettered ? "danger" : "ok"} />
              <Metric label={T.outboxOldest} value={value.outbox.oldestAt ? formatAgo(value.outbox.oldestAt) : T.none} />
            </div>
            <div className={styles.actionRow}>
              <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={onDrain}>
                {T.drainNow}
              </Button>
            </div>
          </div>

          <div className={styles.panel}>
            <PanelTitle>{T.maintenancePanel}</PanelTitle>
            <p className={styles.muted}>{T.maintenanceNote}</p>
            <div className={styles.actionRow}>
              <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={onMaintenance}>
                {T.runMaintenance}
              </Button>
            </div>
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>ריצות שנכשלו</PanelTitle>
              {value.failedRuns.length ? (
                <ul className={styles.logList}>
                  {value.failedRuns.map((run) => (
                    <li key={run.id}>
                      <span>
                        <Pill tone="danger">{T.failed}</Pill>
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
                <EmptyLine>אין ריצות שנכשלו.</EmptyLine>
              )}
            </div>
            <div className={styles.panel}>
              <PanelTitle>טופלו לאחרונה</PanelTitle>
              {value.recentlyResolved.length ? (
                <ul className={styles.logList}>
                  {value.recentlyResolved.map((alert) => (
                    <li key={alert.id}>
                      <span>
                        <Pill tone="ok">טופלה</Pill>
                      </span>
                      <strong>{alert.kind}</strong>
                      <small>
                        {alert.message} · טופלה {formatDate(alert.resolvedAt)}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>לא טופל דבר לאחרונה.</EmptyLine>
              )}
            </div>
          </div>

          {/* The quarantine decisions are this sub-area's last region and its
              only dangerous one: resolve is asked for nothing, discard removes
              the candidate from the recovery queue for good and goes through
              the shared confirmation with a required note. */}
          <div className={styles.panel}>
            <PanelTitle note={`${value.quarantine.length} ${T.pendingDecision}`}>{T.qualityQuarantine}</PanelTitle>
            <p className={styles.muted}>{T.quarantineDecisionNote}</p>
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
                    <div className={styles.cellActions}>
                      <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onQuarantineResolve(entry)}>
                        {T.resolve}
                      </Button>
                      <Button variant="danger" size="sm" type="button" disabled={disabled} onClick={() => onDiscard(entry)}>
                        {T.discard}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>אין פריטים בבידוד.</EmptyLine>
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
      return "בדיקת הבריאות המעמיקה הסתיימה. התוצאה שלה מוצגת תחת חיבורים.";
    });
  }

  return (
    <ReadGate state={security.state} what="האבטחה והחיבורים" reload={security.reload}>
      {(value) => {
        const shown = probe ?? (value.lastProbe ? { status: value.lastProbe.status, checks: value.lastProbe.checks } : null);
        return (
          <>
            <div className={styles.twoColumns}>
              <div className={styles.panel}>
                <PanelTitle>סודות</PanelTitle>
                {/* The promise this panel makes: it reports presence, never a
                    value. Any wording that could be read as showing a secret
                    would be a lie about what the endpoint sends. */}
                <p className={styles.muted}>מוגדר או חסר, ותו לא. ערכים אינם מוצגים כאן לעולם, ואינם נשלחים לעמוד הזה מלכתחילה.</p>
                <ul className={styles.secretList}>
                  {value.secrets.map((secret) => (
                    <li key={secret.name}>
                      <Pill tone={secret.configured ? "ok" : "danger"}>{secret.configured ? "מוגדר" : "חסר"}</Pill>
                      <strong>{secret.name}</strong>
                      <small>{secret.purpose}</small>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.panel}>
                <PanelTitle>חיבורים</PanelTitle>
                <div className={styles.grid}>
                  {Object.entries(value.integrations).map(([name, active]) => (
                    <article className={styles.service} key={name}>
                      <Pill tone={active ? "ok" : "warn"}>{active ? "מוכן" : "ממתין"}</Pill>
                      <h4>{name}</h4>
                    </article>
                  ))}
                </div>
                <div className={styles.actionRow}>
                  <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={runDeepHealth}>
                    הרצת בדיקת בריאות מעמיקה
                  </Button>
                  {value.lastProbe && !probe ? <p className={styles.headNote}>בדיקה אחרונה {formatAgo(value.lastProbe.at)}</p> : null}
                </div>
                {shown ? (
                  <div className={styles.healthStrip} aria-label="תוצאת בדיקת הבריאות">
                    <span>
                      <Pill tone={shown.status === "ok" ? "ok" : "danger"}>כללי {shown.status}</Pill>
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
              <PanelTitle>זהות משאבים</PanelTitle>
              <p className={styles.muted}>טביעות אצבע חד-כיווניות בלבד, להשוואה בין סביבות. סודות ומזהים מלאים אינם מוצגים כאן לעולם.</p>
              <StatGrid>
                {Object.entries(value.resourceFingerprints).map(([name, fingerprint]) => (
                  <Stat key={name} label={name} value={fingerprint ?? "לא מוגדר"} />
                ))}
              </StatGrid>
            </div>

            <div className={styles.twoColumns}>
              <div className={styles.panel}>
                <PanelTitle>אירועי אבטחה אחרונים</PanelTitle>
                {value.recentSecurityEvents.length ? (
                  <ul className={styles.logList}>
                    {value.recentSecurityEvents.map((event) => (
                      <li key={event.id}>
                        <span>
                          <Pill tone="neutral">אירוע</Pill>
                        </span>
                        <strong>{event.action}</strong>
                        <small>
                          {event.actorLabel} · {formatDate(event.occurredAt)}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>לא נרשמו אירועי אבטחה.</EmptyLine>
                )}
              </div>
              <div className={styles.panel}>
                <PanelTitle>{`שינויי ${T.capabilities}`}</PanelTitle>
                {value.capabilityChanges.length ? (
                  <ul className={styles.logList}>
                    {value.capabilityChanges.map((change) => (
                      <li key={change.id}>
                        <span>
                          <Pill tone="gold">הענקה</Pill>
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
                  <EmptyLine>לא נרשמו שינויי הרשאות.</EmptyLine>
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
    <ReadGate state={settings.state} what="ההגדרות" reload={settings.reload}>
      {(value) => (
        <>
          <p className={styles.warnNote}>לקריאה בלבד. {value.source}</p>
          <StatGrid>
            <Stat label="סביבה" value={value.environment} />
            <Stat label="אזור" value={value.region} />
            <Stat label="כתובת האתר" value={value.siteUrl} />
            <Stat label="תקציב AI, יומי" value={formatUsd(value.budgets.ai.dailyUsd, 2)} />
            <Stat label="תקציב AI, חודשי" value={formatUsd(value.budgets.ai.monthlyUsd, 2)} />
            <Stat label="תקציב בריף, יומי" value={formatUsd(value.budgets.briefing.dailyUsd, 2)} />
            <Stat label="תקציב בריף, חודשי" value={formatUsd(value.budgets.briefing.monthlyUsd, 2)} />
            <Stat label="שאילתות חיפוש, חודשי" value={value.budgets.search.monthlyQueries === null ? "לא מוגדר" : String(value.budgets.search.monthlyQueries)} />
          </StatGrid>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>תזמונים</PanelTitle>
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.tableCompact}`}>
                  <thead>
                    <tr>
                      <th scope="col">מסלול</th>
                      <th scope="col">תזמון</th>
                      <th scope="col">מה זה עושה</th>
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
              <PanelTitle>מודלים</PanelTitle>
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.tableCompact}`}>
                  <thead>
                    <tr>
                      <th scope="col">פרופיל</th>
                      <th scope="col">מודל</th>
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
              <PanelTitle>מדורים בייצור</PanelTitle>
              <div className={styles.queueRow}>
                {/* The contract types these as plain strings, so the lookup
                    falls back to the wire value rather than rendering blank. */}
                {value.sections.map((section) => (
                  <span key={section}>{(SECTION_LABEL as Record<string, string>)[section] ?? section}</span>
                ))}
              </div>
            </div>
            <div className={styles.panel}>
              <PanelTitle>קבוצות חיפוש</PanelTitle>
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
  /* R6 — the read-only internals figures, held behind the same inline
     absence the schema panel uses. */
  const internals = useConsoleRead<ConsoleSystemInternals>("admin/console/system-internals", { signal });
  return (
    <ReadGate state={status.state} what="מצב הפריסה" reload={status.reload}>
      {(value) => {
        const migration = briefing.value?.migration;
        const migrationStatus = !migration
          ? null
          : migration.available
            ? `הוחלו ${migration.applied} מיגרציות · הגרסה האחרונה ${migration.latestId ?? "לא ידועה"}${migration.latestAppliedAt ? ` · ${formatDate(migration.latestAppliedAt)}` : ""}`
            : "מצב המיגרציות אינו זמין בסביבה הזו.";
        return (
          <>
            <StatGrid>
              <Stat label="סביבה" value={value.environment} />
              <Stat label="אזור התור" value={value.region} />
              <Stat label="תקרת בריף חודשית" value={formatUsd(value.aiBudgetUsd, 2)} />
              <Stat label="משתמשים רשומים" value={userCount.value ? String(userCount.value.registeredUsers) : "—"} />
              <Stat
                label="פגיעות במטמון הציבורי"
                value={value.publicReadCache.hitRatio === null ? "אין נתונים" : `${(value.publicReadCache.hitRatio * 100).toFixed(1)}% · ${value.publicReadCache.averageLoadMs ?? 0} ms`}
              />
              <Stat label="התחברות" value="זהות Google פעילה" />
            </StatGrid>

            <div className={styles.grid}>
              {Object.entries(value.integrations).map(([name, active]) => (
                <article className={styles.service} key={name}>
                  <Pill tone={active ? "ok" : "warn"}>{active ? "מוכן" : "ממתין"}</Pill>
                  <h4>{name}</h4>
                </article>
              ))}
            </div>

            <div className={styles.twoColumns}>
              <div className={styles.panel}>
                <PanelTitle>זהות משאבים</PanelTitle>
                <p className={styles.muted}>טביעות אצבע חד-כיווניות בלבד, להשוואה בין סביבות. סודות ומזהים מלאים אינם מוצגים כאן לעולם.</p>
                <StatGrid>
                  {Object.entries(value.resourceFingerprints ?? {}).map(([name, fingerprint]) => (
                    <Stat key={name} label={name} value={fingerprint ?? "לא מוגדר"} />
                  ))}
                </StatGrid>
              </div>
              <div className={styles.panel}>
                <PanelTitle>סכמת מסד הנתונים</PanelTitle>
                <InlineAbsence state={briefing.state} what="סיכום הבריף" reload={briefing.reload} />
                {migrationStatus ? <p className={styles.muted}>{migrationStatus}</p> : null}
              </div>
            </div>

            {/* The internals panel sits last in the sub-area: it is the
                machine's own figures, read after everything an operator
                checks about the deployment itself. */}
            <div className={styles.panel}>
              <PanelTitle>{T.internalsPanel}</PanelTitle>
              <InlineAbsence state={internals.state} what={T.internalsPanel} reload={internals.reload} />
              {internals.value ? (
                <>
                  <StatGrid>
                    <Stat label={T.embedIndexed} value={String(internals.value.embeddingBacklog.indexed)} />
                    <Stat label={T.embedStale} value={String(internals.value.embeddingBacklog.stale)} tone={internals.value.embeddingBacklog.stale ? "warn" : "ok"} />
                    <Stat label={`${T.embedRuns} ${T.last24h}`} value={String(internals.value.embeddingRuns.last24h)} />
                    <Stat label="הטמעה אחרונה" value={formatAgo(internals.value.embeddingRuns.lastRunAt)} />
                    <Stat
                      label="פגיעות במטמון הציבורי"
                      value={internals.value.publicReadCache.hitRatio === null ? "אין נתונים" : `${(internals.value.publicReadCache.hitRatio * 100).toFixed(1)}% · ${internals.value.publicReadCache.averageLoadMs ?? 0} ms`}
                    />
                  </StatGrid>
                  <p className={styles.chipRow}>
                    {/* The SQL function's own answer, verbatim — never
                        inferred from the backlog or the runs. */}
                    {T.semanticArm}:{" "}
                    <Pill tone={internals.value.semanticArm ? "ok" : "neutral"}>
                      {internals.value.semanticArm ? T.semanticEngaged : T.lexicalOnly}
                    </Pill>
                  </p>
                </>
              ) : null}
            </div>
          </>
        );
      }}
    </ReadGate>
  );
}
