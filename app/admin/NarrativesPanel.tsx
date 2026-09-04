"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import type { ConsoleNarratives } from "@/server/contracts/admin-console";
import { EmptyLine, Pill, ReadGate, formatDate, type PillTone } from "./console-primitives";
import { NARRATIVE_STATUS_LABEL, STATUS_LABEL, T, TREND_LABEL } from "./lexicon";
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
        <h3 id="console-narratives-heading">נרטיבים בתפוצה</h3>
        {narratives.value ? (
          <p className={styles.headNote}>
            {TREND_LABEL.new}: {narratives.value.counts.new} · {TREND_LABEL.rising}: {narratives.value.counts.rising} · {TREND_LABEL.declining}:{" "}
            {narratives.value.counts.declining}
          </p>
        ) : null}
      </div>
      <ReadGate state={narratives.state} what={`ה${T.narratives}`} reload={narratives.reload} skeleton={<Skeleton shape="block" height="12rem" />}>
        {(value) =>
          value.narratives.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{T.narrative}</th>
                    <th scope="col">מגמה</th>
                    <th scope="col">מצב</th>
                    <th scope="col">אזכורים השבוע</th>
                    <th scope="col">בשבוע הקודם</th>
                    <th scope="col">{T.evidence}</th>
                    <th scope="col">אוזכר לאחרונה</th>
                    <th scope="col">נענה על ידי</th>
                  </tr>
                </thead>
                <tbody>
                  {value.narratives.map((narrative) => (
                    <tr key={narrative.id}>
                      <th scope="row">
                        <strong>{narrative.title}</strong>
                        <small className={styles.plainSmall}>אוזכר לראשונה {formatDate(narrative.firstSeenAt)}</small>
                      </th>
                      <td>
                        <Pill tone={TREND_TONE[narrative.trend] ?? "neutral"}>{TREND_LABEL[narrative.trend] ?? narrative.trend}</Pill>
                      </td>
                      <td>{NARRATIVE_STATUS_LABEL[narrative.status] ?? narrative.status}</td>
                      <td>{narrative.observations7d}</td>
                      <td>{narrative.observationsPrior7d}</td>
                      <td>
                        {narrative.evidence.supporting} תומכות · {narrative.evidence.contradicting} סותרות
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
                          <Pill tone={narrative.trend === "rising" || narrative.trend === "new" ? "warn" : "neutral"}>טרם נענה</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyLine>לא מנוטרים נרטיבים. הקריאה הצליחה והרשימה באמת ריקה.</EmptyLine>
          )
        }
      </ReadGate>
    </section>
  );
}
