"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import type { ConsoleNarratives } from "@/server/contracts/admin-console";
import { EmptyLine, Pill, ReadGate, STATUS_LABEL, formatDate, type PillTone } from "./console-primitives";
import { useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

const TREND_TONE: Record<string, PillTone> = { new: "gold", rising: "warn", stable: "neutral", declining: "ok" };

/**
 * Narratives — the claims in circulation the desk is watching, ordered by
 * what is moving: new, rising, then the rest. Each row carries its evidence
 * state and the publications that answer it, so an operator can see a rising
 * narrative with nothing published against it at a glance.
 */
export function NarrativesPanel({ signal }: { signal: number }) {
  const narratives = useConsoleRead<ConsoleNarratives>("admin/console/narratives", { signal });
  return (
    <section className={styles.subArea} id="console-narratives" aria-labelledby="console-narratives-heading">
      <div className={styles.panelTitle}>
        <h3 id="console-narratives-heading">Narratives in circulation</h3>
        {narratives.value ? (
          <p className={styles.headNote}>
            {narratives.value.counts.new} new · {narratives.value.counts.rising} rising · {narratives.value.counts.declining} declining
          </p>
        ) : null}
      </div>
      <ReadGate state={narratives.state} what="the narratives" reload={narratives.reload} skeleton={<Skeleton shape="block" height="12rem" />}>
        {(value) =>
          value.narratives.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Narrative</th>
                    <th scope="col">Trend</th>
                    <th scope="col">Status</th>
                    <th scope="col">Seen this week</th>
                    <th scope="col">Prior week</th>
                    <th scope="col">Evidence</th>
                    <th scope="col">Last seen</th>
                    <th scope="col">Answered by</th>
                  </tr>
                </thead>
                <tbody>
                  {value.narratives.map((narrative) => (
                    <tr key={narrative.id}>
                      <th scope="row">
                        <strong>{narrative.title}</strong>
                        <small className={styles.plainSmall}>first seen {formatDate(narrative.firstSeenAt)}</small>
                      </th>
                      <td>
                        <Pill tone={TREND_TONE[narrative.trend] ?? "neutral"}>{narrative.trend}</Pill>
                      </td>
                      <td>{narrative.status}</td>
                      <td>{narrative.observations7d}</td>
                      <td>{narrative.observationsPrior7d}</td>
                      <td>
                        {narrative.evidence.supporting} for · {narrative.evidence.contradicting} against
                        {narrative.evidence.verificationState ? <small className={styles.plainSmall}>{narrative.evidence.verificationState}</small> : null}
                      </td>
                      <td>{formatDate(narrative.lastSeenAt)}</td>
                      <td>
                        {narrative.linkedPublications.length ? (
                          <ul className={styles.plainList}>
                            {narrative.linkedPublications.map((publication) => (
                              <li key={publication.id}>
                                {publication.title} <Pill tone={publication.status === "published" ? "ok" : "neutral"}>{STATUS_LABEL[publication.status]}</Pill>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <Pill tone={narrative.trend === "rising" || narrative.trend === "new" ? "warn" : "neutral"}>nothing yet</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyLine>No narratives are being tracked. The read succeeded and the list is genuinely empty.</EmptyLine>
          )
        }
      </ReadGate>
    </section>
  );
}
