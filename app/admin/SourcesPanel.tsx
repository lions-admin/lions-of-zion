"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ConsoleSource, ConsoleSources } from "@/server/contracts/admin-console";
import type { BriefingStatus } from "./briefing-shapes";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import {
  AreaHead,
  ConsoleNotices,
  EmptyLine,
  InlineAbsence,
  Metric,
  Pill,
  ReadGate,
  formatDate,
  formatUsd,
  useOperations,
} from "./console-primitives";
import { callConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

/** Feed-backed kinds can be verified by a live fetch; the rest are enabled
 *  by hand with a reason. */
const VERIFIABLE_KINDS = new Set(["rss", "api", "agent_search"]);

/**
 * Sources — collection health and throughput, one row per source, and the
 * two per-row recoveries: a live verification fetch that re-enables a
 * feed-backed source, and a manual enable or disable with a reason that is
 * written to the audit trail.
 */
export function SourcesPanel({ signal }: { signal: number }) {
  const sources = useConsoleRead<ConsoleSources>("admin/console/sources", { signal });
  const briefing = useConsoleRead<BriefingStatus>("admin/briefing", { signal });
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
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
      <AreaHead id="console-sources" label="Sources" title="Collection health and throughput">
        <div className={styles.actionRow}>
          <Button variant="secondary" type="button" disabled={ops.disabled} onClick={syncSourceCatalog}>
            Sync source URLs
          </Button>
        </div>
      </AreaHead>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} />

      <InlineAbsence state={briefing.state} what="the briefing summary" reload={briefing.reload} />
      {briefing.value ? (
        <div className={styles.compactMetrics}>
          <Metric label="Collection attempts this week" value={String(briefing.value.sources.reduce((sum, source) => sum + source.attempts, 0))} />
          <Metric label="Successful collections this week" value={String(briefing.value.sources.reduce((sum, source) => sum + source.successfulAttempts, 0))} />
          <Metric label="Search attempts this month" value={String(briefing.value.googleUsage.attemptsThisMonth)} />
          <Metric label="Successful searches this month" value={String(briefing.value.googleUsage.successfulQueriesThisMonth)} />
          <Metric
            label="Estimated search cost"
            value={
              briefing.value.googleUsage.estimatedSpendUsd === null
                ? "Not set"
                : `${formatUsd(briefing.value.googleUsage.estimatedSpendUsd)}${briefing.value.googleUsage.monthlyBudgetUsd === null ? "" : ` / ${formatUsd(briefing.value.googleUsage.monthlyBudgetUsd, 2)}`}`
            }
          />
          <Metric label="Sources configured" value={String(briefing.value.sources.length)} />
        </div>
      ) : null}

      <ReadGate
        state={sources.state}
        what="the source table"
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
              <div className={styles.chipRow} role="group" aria-label="Filter by family">
                <Button variant="ghost" size="sm" type="button" isActive={familyFilter === ""} onClick={() => setFamilyFilter("")}>
                  All · {value.sources.length}
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
                  <Pill tone="ok">{value.totals.active} active</Pill> <Pill tone="neutral">{value.totals.disabled} disabled</Pill>{" "}
                  <Pill tone={value.totals.failing ? "danger" : "ok"}>{value.totals.failing} failing</Pill>
                </span>
              </div>

              {rows.length === 0 ? (
                <EmptyLine>No sources in this family. The read succeeded and the filter excluded every row.</EmptyLine>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.tableCaption}>
                      Health and throughput over the last seven days. A disabled source stays disabled until a live check returns a valid feed or a person enables it with a reason.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Source</th>
                        <th scope="col">Family</th>
                        <th scope="col">Kind</th>
                        <th scope="col">Status</th>
                        <th scope="col">Verification</th>
                        <th scope="col">Last fetch</th>
                        <th scope="col">Last success</th>
                        <th scope="col">Attempts</th>
                        <th scope="col">Successes</th>
                        <th scope="col">Seen</th>
                        <th scope="col">New</th>
                        <th scope="col">Duplicates</th>
                        <th scope="col">Recovery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((source) => (
                        <tr key={source.id}>
                          <th scope="row">
                            <strong>{source.name}</strong>
                            <small className={styles.plainSmall}>{source.slug}{source.language ? ` · ${source.language}` : ""}{source.country ? ` · ${source.country}` : ""}</small>
                            {source.disabledReason || source.lastError ? <small>{source.disabledReason ?? source.lastError}</small> : null}
                          </th>
                          <td>{source.family?.label ?? "—"}</td>
                          <td>{source.kind}</td>
                          <td>
                            <Pill tone={source.active ? (source.consecutiveFailures ? "warn" : "ok") : "neutral"}>
                              {source.active ? `active · ${source.consecutiveFailures} failures` : "disabled"}
                            </Pill>
                          </td>
                          <td>
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
                              {VERIFIABLE_KINDS.has(source.kind) && !source.active ? (
                                <Button variant="secondary" size="sm" type="button" disabled={ops.disabled} onClick={() => verifySource(source)}>
                                  Verify and enable
                                </Button>
                              ) : null}
                              <Button variant="secondary" size="sm" type="button" disabled={ops.disabled} onClick={() => requestSourceActive(source, !source.active)}>
                                {source.active ? "Disable" : "Enable"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        }}
      </ReadGate>

      <ConfirmDialog intent={confirmIntent} onClose={() => setConfirmIntent(null)} fallbackFocusRef={areaRef} />
    </section>
  );

  /* Enabling or disabling a source changes what is collected from tomorrow
     on, and the reason is written to the audit trail — so the confirmation
     asks for the reason as well as stating the consequence. */
  function requestSourceActive(source: ConsoleSource, active: boolean) {
    reasonRef.current = "";
    setConfirmIntent({
      action: active ? "Enable this source" : "Disable this source",
      target: source.name,
      targetDetail: `${source.slug} · ${source.kind}${source.family ? ` · ${source.family.label}` : ""}`,
      consequence: active
        ? "Collection resumes from this source on the next tick. Enabling a feed-backed source without a verification fetch is refused by the server; use Verify and enable for those. The reason is recorded in the audit log."
        : "Collection from this source stops until a person enables it again. Items already collected are kept. The reason is recorded in the audit log.",
      confirmLabel: active ? "Enable source" : "Disable source",
      tone: active ? "primary" : "danger",
      run: () => setSourceActive(source, active),
      body: (
        <Field
          className={styles.editorField}
          name="reason"
          label="Reason"
          description="One line, for the audit log. Required."
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
      if (!reason) throw new Error("A reason is required to enable or disable a source. Nothing was changed.");
      await callConsole(`admin/console/sources/${source.id}/active`, {
        method: "PATCH",
        body: { active, reason },
        failure: active ? "Unable to enable the source." : "Unable to disable the source.",
      });
      reloadAll();
      return active ? `Source ${source.name} is enabled.` : `Source ${source.name} is disabled.`;
    });
  }

  async function verifySource(source: ConsoleSource) {
    await ops.run(`source:${source.id}`, async () => {
      const result = await callConsole<{ fetch?: { status?: string; itemsSeen?: number; errorMessage?: string | null }; evidenceCreated?: number; message?: string }>(
        `sources/${source.id}/fetch`,
        { method: "POST", failure: "Source verification failed." },
      );
      if (result.fetch?.status !== "success" || !result.fetch.itemsSeen) {
        throw new Error(result.message || result.fetch?.errorMessage || "The source did not return a valid feed and remains disabled.");
      }
      reloadAll();
      return `Source ${source.name} was verified and enabled with ${result.fetch.itemsSeen} items.`;
    });
  }

  async function syncSourceCatalog() {
    await ops.run("sync-source-catalog", async () => {
      const result = await callConsole<{ created?: number; updated?: number }>("admin/briefing/sources/sync", {
        method: "POST",
        failure: "Unable to update source URLs.",
      });
      reloadAll();
      const changed = (result.created ?? 0) + (result.updated ?? 0);
      return changed
        ? `Added ${result.created ?? 0} sources and updated ${result.updated ?? 0}; all remain disabled until a live check.`
        : "Source URLs are already up to date.";
    });
  }
}
