"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CollectSweepResult, ConsoleCosts, ConsoleSource, ConsoleSourceFetches, ConsoleSources } from "@/server/contracts/admin-console";
import type { BriefingStatus } from "./briefing-shapes";
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
  formatDate,
  formatDuration,
  formatUsd,
  useOperations,
  type PillTone,
} from "./console-primitives";
import { AREA_LABEL, FETCH_STATUS_LABEL, SENTENCE, SOURCE_KIND_LABEL, T } from "./lexicon";
import { callConsole, useConsoleRead } from "./useConsoleRead";
import cmd from "./command.module.css";
import styles from "./admin.module.css";

/** Feed-backed kinds can be verified by a live fetch; the rest are enabled
 *  by hand with a reason. */
const VERIFIABLE_KINDS = new Set(["rss", "api", "agent_search"]);

const kindWord = (kind: string) => SOURCE_KIND_LABEL[kind] ?? kind;

const fetchTone = (status: string): PillTone => (status === "success" ? "ok" : status === "partial" ? "warn" : "danger");

/**
 * One source as a card: the narrow-screen replacement for a row of the
 * 13-column table. Same words, same facts, same actions — different IA.
 * Exported for visual QA previews; the panel is its only production user.
 */
export function SourceCard({
  source,
  disabled,
  onVerify,
  onToggle,
  onFetches,
}: {
  source: ConsoleSource;
  disabled: boolean;
  onVerify: (source: ConsoleSource) => void;
  onToggle: (source: ConsoleSource) => void;
  onFetches?: () => void;
}) {
  return (
    <article className={cmd.sourceCard} aria-label={source.name}>
      <div className={cmd.sourceCardHead}>
        <h3 className={cmd.sourceCardName}>{source.name}</h3>
        <Pill tone={source.active ? (source.consecutiveFailures ? "warn" : "ok") : "neutral"}>
          {source.active ? `${T.active} · ${source.consecutiveFailures} כשלים` : T.inactive}
        </Pill>
      </div>
      <p className={cmd.sourceCardId}>
        <bdi>{source.slug}</bdi>
        {source.language ? <> · <bdi>{source.language}</bdi></> : ""}
        {source.country ? <> · <bdi>{source.country}</bdi></> : ""}
        {` · ${kindWord(source.kind)}`}
        {source.family ? ` · ${source.family.label}` : ""}
      </p>
      <p className={cmd.sourceCardMeta}>
        {T.attempts} <bdi>{String(source.week.attempts)}</bdi> · {T.successes} <bdi>{String(source.week.successes)}</bdi> ·{" "}
        נראו <bdi>{String(source.week.itemsSeen)}</bdi> · חדשים <bdi>{String(source.week.itemsNew)}</bdi>
      </p>
      <p className={cmd.sourceCardMeta}>
        שליפה אחרונה {formatDate(source.lastFetchAt)} · הצלחה אחרונה {formatDate(source.lastSuccessfulFetchAt)}
      </p>
      {source.disabledReason || source.lastError ? (
        <p className={cmd.sourceCardError}>{source.disabledReason ?? source.lastError}</p>
      ) : null}
      <div className={cmd.sourceCardActions}>
        {onFetches ? (
          <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={onFetches}>
            {T.fetchLog}
          </Button>
        ) : null}
        {VERIFIABLE_KINDS.has(source.kind) && !source.active ? (
          <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onVerify(source)}>
            אימות והפעלה
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onToggle(source)}>
          {source.active ? T.disable : T.enable}
        </Button>
      </div>
    </article>
  );
}

/**
 * One source's fetch log, in an end-edge drawer — the same shape
 * `VersionsDrawer` uses on the editorial desk. The read is held until a
 * source is asked for; the log is append-only evidence, so everything here
 * is read-only: the per-attempt rows newest first, and the same day's
 * rollup, which is boundary-inclusive at Israel-local midnight.
 */
function FetchesDrawer({ source, onClose }: { source: ConsoleSource | null; onClose: () => void }) {
  const fetches = useConsoleRead<ConsoleSourceFetches>(
    source ? `admin/console/sources/${source.id}/fetches?limit=50` : "",
    { enabled: source !== null },
  );
  return (
    <Dialog
      open={source !== null}
      onClose={onClose}
      variant="drawer"
      size="wide"
      title={T.fetchLog}
      description={source?.name}
      closeLabel={T.fetchLogClose}
    >
      {source ? (
        <>
          <InlineAbsence state={fetches.state} what={T.fetchWhat} reload={fetches.reload} />
          {fetches.state.kind === "ready" && fetches.value ? (
            <>
              {/* The "today" block: the same payload's rollup for the day
                  that began at `boundaryAt`. A failed fetch contributes its
                  attempt and its error but no items. */}
              <div className={styles.panel}>
                <PanelTitle note={`${T.todayBlock} · ${T.boundaryAt} ${formatDate(fetches.value.today.boundaryAt)}`}>{T.todayBlock}</PanelTitle>
                <div className={styles.compactMetrics}>
                  <Metric label={T.attempts} value={String(fetches.value.today.attempts)} />
                  <Metric label={T.successes} value={String(fetches.value.today.successes)} />
                  <Metric label={T.fetchesPartial} value={String(fetches.value.today.partial)} tone={fetches.value.today.partial ? "warn" : undefined} />
                  <Metric label={T.fetchesFailed} value={String(fetches.value.today.failed)} tone={fetches.value.today.failed ? "danger" : undefined} />
                  <Metric label={T.itemsSeen} value={String(fetches.value.today.itemsSeen)} />
                  <Metric label={T.itemsNew} value={String(fetches.value.today.itemsNew)} />
                </div>
                {fetches.value.today.lastError ? <p className={styles.error}>{fetches.value.today.lastError}</p> : null}
              </div>

              <div className={styles.panel}>
                <PanelTitle>{T.fetchLog}</PanelTitle>
                {fetches.value.fetches.length ? (
                  <div className={styles.tableWrap}>
                    <table className={`${styles.table} ${styles.tableCompact}`}>
                      <thead>
                        <tr>
                          <th scope="col">{T.colStatus}</th>
                          <th scope="col">{T.started}</th>
                          <th scope="col">{T.duration}</th>
                          <th scope="col">{T.itemsSeen}</th>
                          <th scope="col">{T.itemsNew}</th>
                          <th scope="col">{T.httpStatus}</th>
                          <th scope="col">{T.bytes}</th>
                          <th scope="col">{T.lastError}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fetches.value.fetches.map((fetch) => (
                          <tr key={fetch.id}>
                            <td>
                              <Pill tone={fetchTone(fetch.status)}>{FETCH_STATUS_LABEL[fetch.status] ?? fetch.status}</Pill>
                            </td>
                            <td>
                              {formatDate(fetch.startedAt)}
                              <small className={styles.plainSmall}>{`${T.finished} ${formatDate(fetch.finishedAt)}`}</small>
                            </td>
                            <td>{formatDuration(new Date(fetch.finishedAt).getTime() - new Date(fetch.startedAt).getTime())}</td>
                            <td>{fetch.itemsSeen}</td>
                            <td>{fetch.itemsNew}</td>
                            <td>{fetch.httpStatus ?? "—"}</td>
                            <td>{fetch.rawByteSize === null ? "—" : `${(fetch.rawByteSize / 1024).toFixed(1)} KB`}</td>
                            <td className={styles.errorCell}>{fetch.errorMessage ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyLine>עדיין לא נרשמו שליפות למקור הזה.</EmptyLine>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}

/**
 * Sources — collection health and throughput, one row per source, and the
 * two per-row recoveries: a live verification fetch that re-enables a
 * feed-backed source, and a manual enable or disable with a reason that is
 * written to the audit trail.
 */
export function SourcesPanel({ signal }: { signal: number }) {
  const sources = useConsoleRead<ConsoleSources>("admin/console/sources", { signal });
  const briefing = useConsoleRead<BriefingStatus>("admin/briefing", { signal });
  /* The costs read exists for one additive figure the briefing summary does
     not carry: Agent Search's recorded spend beside its estimate. */
  const costs = useConsoleRead<ConsoleCosts>("admin/console/costs", { signal });
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  /* The fetch log is opened per source row, in a drawer that holds its own
     read the same way the quality matrix holds its date-gated one. */
  const [fetchesFor, setFetchesFor] = useState<ConsoleSource | null>(null);
  const [familyFilter, setFamilyFilter] = useState<string>("");
  /* STATE-004 — the focus fallback, on the area itself. */
  const areaRef = useRef<HTMLElement | null>(null);
  /* The reason is typed inside the confirmation; it lives in a ref so the
     dialog does not re-render its opener on every keystroke. */
  const reasonRef = useRef<string>("");
  const ops = useOperations();

  function reloadAll() {
    sources.reload();
    briefing.reload();
  }

  return (
    <section className={styles.area} id="console-sources" aria-labelledby="console-sources-heading" ref={areaRef} tabIndex={-1}>
      <AreaHead id="console-sources" label={AREA_LABEL.sources} title="תקינות האיסוף והתפוקה">
        <div className={styles.actionRow}>
          <Button variant="secondary" type="button" disabled={ops.disabled} onClick={syncSourceCatalog}>
            סנכרון כתובות המקורות
          </Button>
        </div>
      </AreaHead>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} />

      <InlineAbsence state={briefing.state} what="סיכום הבריף" reload={briefing.reload} />
      {briefing.value ? (
        <div className={styles.compactMetrics}>
          <Metric label={`ניסיונות איסוף ${T.last7d}`} value={String(briefing.value.sources.reduce((sum, source) => sum + source.attempts, 0))} />
          <Metric label={`איסופים שהצליחו ${T.last7d}`} value={String(briefing.value.sources.reduce((sum, source) => sum + source.successfulAttempts, 0))} />
          <Metric label={`ניסיונות חיפוש ${T.thisMonth}`} value={String(briefing.value.googleUsage.attemptsThisMonth)} />
          <Metric label={`חיפושים שהצליחו ${T.thisMonth}`} value={String(briefing.value.googleUsage.successfulQueriesThisMonth)} />
          <Metric
            label="עלות חיפוש משוערת"
            value={
              briefing.value.googleUsage.estimatedSpendUsd === null
                ? "לא הוגדר"
                : `${formatUsd(briefing.value.googleUsage.estimatedSpendUsd)}${briefing.value.googleUsage.monthlyBudgetUsd === null ? "" : ` / ${formatUsd(briefing.value.googleUsage.monthlyBudgetUsd, 2)}`}`
            }
          />
          {/* The estimate beside what the fetches actually recorded. Absent
              means nothing reported a cost — not zero. */}
          {costs.value ? (
            <Metric
              label={T.actualSearchSpend}
              value={costs.value.search.actualSpendUsd === undefined ? T.notRecorded : formatUsd(costs.value.search.actualSpendUsd)}
            />
          ) : null}
          <Metric label="מקורות מוגדרים" value={String(briefing.value.sources.length)} />
        </div>
      ) : null}

      <ReadGate
        state={sources.state}
        what="טבלת המקורות"
        reload={sources.reload}
        skeleton={
          <>
            <Skeleton shape="block" height="3rem" />
            <Skeleton shape="block" height="24rem" />
          </>
        }
      >
        {(value) => {
          const rows = familyFilter ? value.sources.filter((source) => (source.family?.id ?? "none") === familyFilter) : value.sources;
          return (
            <>
              <div className={styles.chipRow} role="group" aria-label="סינון לפי משפחה">
                <Button variant="ghost" size="sm" type="button" isActive={familyFilter === ""} onClick={() => setFamilyFilter("")}>
                  הכול · {value.sources.length}
                </Button>
                {value.families.map((family) => (
                  <Button
                    key={family.id}
                    variant="ghost"
                    size="sm"
                    type="button"
                    isActive={familyFilter === family.id}
                    onClick={() => setFamilyFilter(family.id)}
                  >
                    {family.label} · {family.sourceCount}
                  </Button>
                ))}
                <span className={styles.chipNote}>
                  <Pill tone="ok">{value.totals.active} פעילים</Pill> <Pill tone="neutral">{value.totals.disabled} מושבתים</Pill>{" "}
                  <Pill tone={value.totals.failing ? "danger" : "ok"}>{value.totals.failing} כושלים</Pill>
                </span>
              </div>

              {rows.length === 0 ? (
                <EmptyLine>אין מקורות במשפחה הזו. הקריאה הצליחה והסינון הוציא כל שורה.</EmptyLine>
              ) : (
                <>
                <div className={`${styles.tableWrap} ${cmd.desktopOnly}`}>
                  <table className={`${styles.table} ${styles.tableWide}`}>
                    <caption className={styles.tableCaption}>
                      תקינות ותפוקה בשבעת הימים האחרונים. מקור מושבת נשאר מושבת עד שבדיקה חיה מחזירה פיד תקין, או עד שאדם מפעיל אותו עם סיבה.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{T.source}</th>
                        <th scope="col">משפחה</th>
                        <th scope="col">סוג</th>
                        <th scope="col">מצב</th>
                        <th scope="col">{T.verify}</th>
                        <th scope="col">שליפה אחרונה</th>
                        <th scope="col">הצלחה אחרונה</th>
                        <th scope="col">{T.attempts}</th>
                        <th scope="col">{T.successes}</th>
                        <th scope="col">נראו</th>
                        <th scope="col">חדשים</th>
                        <th scope="col">{T.duplicates}</th>
                        <th scope="col">{T.fetchLog}</th>
                        <th scope="col">{T.colRecovery}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((source) => (
                        <tr key={source.id}>
                          <th scope="row">
                            <strong>{source.name}</strong>
                            {/* The slug, language and country codes are the source's identity in the database. */}
                            <small className={styles.plainSmall}><bdi>{source.slug}</bdi>{source.language ? ` · ${source.language}` : ""}{source.country ? ` · ${source.country}` : ""}</small>
                            {source.disabledReason || source.lastError ? <small>{source.disabledReason ?? source.lastError}</small> : null}
                          </th>
                          <td>{source.family?.label ?? "—"}</td>
                          <td>{kindWord(source.kind)}</td>
                          <td>
                            <Pill tone={source.active ? (source.consecutiveFailures ? "warn" : "ok") : "neutral"}>
                              {source.active ? `${T.active} · ${source.consecutiveFailures} כשלים` : T.inactive}
                            </Pill>
                          </td>
                          <td>
                            {/* The verification state is a free-form config value written by the
                                fetch route, so it is shown exactly as it is stored. */}
                            {source.verificationState ?? "—"}
                            {source.verificationError ? <small>{source.verificationError}</small> : null}
                          </td>
                          <td>{formatDate(source.lastFetchAt)}</td>
                          <td>{formatDate(source.lastSuccessfulFetchAt)}</td>
                          <td>{source.week.attempts}</td>
                          <td>{source.week.successes}</td>
                          <td>{source.week.itemsSeen}</td>
                          <td>{source.week.itemsNew}</td>
                          <td>{source.week.duplicates}</td>
                          <td>
                            <div className={styles.cellActions}>
                              <Button variant="secondary" size="sm" type="button" disabled={ops.disabled} onClick={() => setFetchesFor(source)}>
                                {T.fetchLog}
                              </Button>
                              {VERIFIABLE_KINDS.has(source.kind) && !source.active ? (
                                <Button variant="secondary" size="sm" type="button" disabled={ops.disabled} onClick={() => verifySource(source)}>
                                  אימות והפעלה
                                </Button>
                              ) : null}
                              <Button variant="secondary" size="sm" type="button" disabled={ops.disabled} onClick={() => requestSourceActive(source, !source.active)}>
                                {source.active ? T.disable : T.enable}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Narrow screens get cards, not a shrunken 13-column table:
                    same rows, same words, same actions — different IA. */}
                <div className={cmd.sourceCards}>
                  {rows.map((source) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      disabled={ops.disabled}
                      onVerify={verifySource}
                      onToggle={(item) => requestSourceActive(item, !item.active)}
                      onFetches={() => setFetchesFor(source)}
                    />
                  ))}
                </div>
                </>
              )}
            </>
          );
        }}
      </ReadGate>

      {/* The sweep spends the search and processing budgets outside the
          scheduled cadence, so it confirms through the shared dialog and
          sits in a zone of its own — last in this area's reading and tab
          order, the way the pipeline's forced rerun is. */}
      <div className={styles.dangerZone}>
        <p className={styles.dangerLabel}>{T.sweepPanelLabel}</p>
        <p className={styles.muted}>{T.sweepNote}</p>
        <div className={styles.actionRow}>
          <Button variant="danger" type="button" disabled={ops.disabled} onClick={() => requestSweep()}>
            {T.collectNow}
          </Button>
        </div>
      </div>

      <ConfirmDialog intent={confirmIntent} onClose={() => setConfirmIntent(null)} fallbackFocusRef={areaRef} />
      <FetchesDrawer source={fetchesFor} onClose={() => setFetchesFor(null)} />
    </section>
  );

  /* Enabling or disabling a source changes what is collected from tomorrow
     on, and the reason is written to the audit trail — so the confirmation
     asks for the reason as well as stating the consequence. */
  function requestSourceActive(source: ConsoleSource, active: boolean) {
    reasonRef.current = "";
    setConfirmIntent({
      action: active ? "הפעלת המקור הזה" : "השבתת המקור הזה",
      target: source.name,
      /* The slug and kind are the row's identity, and stay in the wire form. */
      targetDetail: `${source.slug} · ${source.kind}${source.family ? ` · ${source.family.label}` : ""}`,
      consequence: active
        ? `האיסוף מהמקור הזה מתחדש בסבב הבא. השרת מסרב להפעיל מקור מבוסס־פיד בלי שליפת אימות; עבור מקורות כאלה יש להשתמש בפעולת אימות והפעלה. הסיבה נרשמת ב${T.auditLog}.`
        : `האיסוף מהמקור הזה נפסק עד שאדם יפעיל אותו שוב. פריטים שכבר נאספו נשמרים. הסיבה נרשמת ב${T.auditLog}.`,
      confirmLabel: active ? "הפעלת המקור" : "השבתת המקור",
      tone: active ? "primary" : "danger",
      run: () => setSourceActive(source, active),
      body: (
        <Field
          className={styles.editorField}
          name="reason"
          label="סיבה"
          description={`שורה אחת, ל${T.auditLog}. חובה.`}
          required
          maxLength={500}
          onChange={(event) => {
            reasonRef.current = event.currentTarget.value;
          }}
        />
      ),
    });
  }

  async function setSourceActive(source: ConsoleSource, active: boolean) {
    const reason = reasonRef.current.trim();
    await ops.run(`active:${source.id}`, async () => {
      if (!reason) throw new Error("נדרשת סיבה כדי להפעיל או להשבית מקור. שום דבר לא שונה.");
      await callConsole(`admin/console/sources/${source.id}/active`, {
        method: "PATCH",
        body: { active, reason },
        failure: active ? "לא ניתן להפעיל את המקור." : "לא ניתן להשבית את המקור.",
      });
      reloadAll();
      return active ? `המקור ${source.name} מופעל.` : `המקור ${source.name} מושבת.`;
    });
  }

  async function verifySource(source: ConsoleSource) {
    await ops.run(`source:${source.id}`, async () => {
      const result = await callConsole<{ fetch?: { status?: string; itemsSeen?: number; errorMessage?: string | null }; evidenceCreated?: number; message?: string }>(
        `sources/${source.id}/fetch`,
        { method: "POST", failure: "אימות המקור נכשל." },
      );
      if (result.fetch?.status !== "success" || !result.fetch.itemsSeen) {
        throw new Error(result.message || result.fetch?.errorMessage || "המקור לא החזיר פיד תקין ונשאר מושבת.");
      }
      reloadAll();
      return `המקור ${source.name} אומת והופעל עם ${result.fetch.itemsSeen} פריטים.`;
    });
  }

  async function syncSourceCatalog() {
    await ops.run("sync-source-catalog", async () => {
      const result = await callConsole<{ created?: number; updated?: number }>("admin/briefing/sources/sync", {
        method: "POST",
        failure: "לא ניתן לעדכן את כתובות המקורות.",
      });
      reloadAll();
      const changed = (result.created ?? 0) + (result.updated ?? 0);
      return changed
        ? `נוספו ${result.created ?? 0} מקורות ועודכנו ${result.updated ?? 0}; כולם נשארים מושבתים עד לבדיקה חיה.`
        : "כתובות המקורות כבר מעודכנות.";
    });
  }

  /* The sweep is reversible — the jobs it enqueues are the cron's own
     cadence decisions — but it spends the budget outside the cadence, so it
     is confirmed and stated like an irreversible one. */
  function requestSweep() {
    setConfirmIntent({
      action: T.collectNow,
      target: T.sweepTarget,
      consequence: T.sweepConsequence,
      confirmLabel: T.collectNow,
      tone: "danger",
      run: () => runSweep(),
    });
  }

  async function runSweep() {
    await ops.run("collect-sweep", async () => {
      const result = await callConsole<CollectSweepResult>("admin/console/sources/collect-sweep", {
        method: "POST",
        failure: T.sweepFailure,
      });
      reloadAll();
      return result.status === "ran"
        ? SENTENCE.swept(result.enqueued, result.alreadyCompleted, result.dispatchFailed)
        : SENTENCE.sweepPaused();
    });
  }
}
