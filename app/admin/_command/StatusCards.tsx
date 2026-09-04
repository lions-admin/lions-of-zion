"use client";

import type { ReactNode } from "react";
import { Pill, type PillTone } from "../console-primitives";
import cmd from "../command.module.css";

/* Shared command-center primitives for the admin areas. All wording comes
 * from the caller (lexicon-driven); identifiers render inside `<bdi>` so
 * Latin values never disturb the RTL run. */

/* ── Verdict banner: is the system healthy? ─────────────────────── */

export function VerdictBanner({
  active,
  word,
  children,
}: {
  active: boolean;
  word: string;
  children: ReactNode;
}) {
  return (
    <div className={active ? cmd.verdict : `${cmd.verdict} ${cmd.verdictOff}`}>
      <p className={cmd.verdictWord}>
        <span className={active ? cmd.healthDot : `${cmd.healthDot} ${cmd.healthDotOff}`} aria-hidden="true" />
        {word}
      </p>
      <div className={cmd.verdictBody}>{children}</div>
    </div>
  );
}

/* ── Stat blocks ────────────────────────────────────────────────── */

export type StatTone = "ok" | "warn" | "danger";

export function Stat({ label, value, tone }: { label: string; value: string; tone?: StatTone }) {
  const toneClass = tone === "ok" ? cmd.statOk : tone === "warn" ? cmd.statWarn : tone === "danger" ? cmd.statDanger : "";
  return (
    <div className={toneClass ? `${cmd.stat} ${toneClass}` : cmd.stat}>
      <span className={cmd.statValue}>
        <bdi>{value}</bdi>
      </span>
      <span className={cmd.statLabel}>{label}</span>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={cmd.stats}>{children}</div>;
}

/* ── Command card ───────────────────────────────────────────────── */

export function CommandCard({
  label,
  title,
  tone,
  note,
  children,
}: {
  label: string;
  title: string;
  tone?: "accent" | "ok" | "warn" | "danger";
  note?: string;
  children?: ReactNode;
}) {
  const toneClass =
    tone === "ok" ? cmd.cardOk : tone === "warn" ? cmd.cardWarn : tone === "danger" ? cmd.cardDanger : cmd.cardAccent;
  return (
    <section className={`${cmd.card} ${toneClass}`}>
      <p className={cmd.cardLabel}>{label}</p>
      <h3 className={cmd.cardTitle}>{title}</h3>
      {note ? <p className={cmd.cardNote}>{note}</p> : null}
      {children}
    </section>
  );
}

export function CommandGrid({ children }: { children: ReactNode }) {
  return <div className={cmd.grid}>{children}</div>;
}

/* ── Alert items: severity-first, machine text isolated ─────────── */

export type AlertItem = {
  id: string;
  severity: "critical" | "warning" | string;
  kind: string;
  message: string;
  time?: string;
  extra?: string;
  /** Expandable machine-readable diagnostics, kept visually separate from
   *  the human-readable message above it. */
  details?: ReactNode;
  /** The available operator action (resolve, retry link, …). Rendered last
   *  so reading order stays severity → what → why → what-to-do. */
  action?: ReactNode;
};

export function AlertList({ items, severityWord }: { items: AlertItem[]; severityWord: (severity: string) => string }) {
  return (
    <ul className={cmd.alertList}>
      {items.map((item) => {
        const critical = item.severity === "critical";
        const tone: PillTone = critical ? "danger" : "warn";
        return (
          <li key={item.id} className={critical ? `${cmd.alert} ${cmd.alertCritical}` : `${cmd.alert} ${cmd.alertWarning}`}>
            <span>
              <Pill tone={tone}>{severityWord(item.severity)}</Pill>
            </span>
            <div className={cmd.alertHead}>
              <bdi className={cmd.alertKind}>{item.kind}</bdi>
              {item.time ? <span className={cmd.alertTime}>{item.time}</span> : null}
              {item.extra ? <span className={cmd.alertTime}>{item.extra}</span> : null}
            </div>
            <p className={cmd.alertMessage}>{item.message}</p>
            {item.details ? <div className={cmd.alertMessage}>{item.details}</div> : null}
            {item.action ? <div className={cmd.alertAction}>{item.action}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}
