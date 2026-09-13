"use client";

/**
 * מדידה — ten live-SQL screens for first-party browsing measurement.
 * Empty states are honest: no fabricated history.
 */

import { useMemo, useRef, useState } from "react";
import type { MeasurementConsoleResponse, MeasurementScreen } from "@/server/contracts/measurement";
import { AreaHead, PanelTitle, ReadGate, formatDate } from "./console-primitives";
import { Stat, StatGrid } from "./_command/StatusCards";
import { useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

export type MeasureArea =
  | "measure-now"
  | "measure-today"
  | "measure-content"
  | "measure-home"
  | "measure-audience"
  | "measure-paths"
  | "measure-search"
  | "measure-ux"
  | "measure-errors"
  | "measure-insights";

const AREA_TO_SCREEN: Record<MeasureArea, MeasurementScreen> = {
  "measure-now": "now",
  "measure-today": "today",
  "measure-content": "content",
  "measure-home": "home",
  "measure-audience": "audience",
  "measure-paths": "paths",
  "measure-search": "search",
  "measure-ux": "ux",
  "measure-errors": "errors",
  "measure-insights": "insights",
};

const AREA_META: Record<MeasureArea, { label: string; title: string; note: string }> = {
  "measure-now": { label: "מצב עכשיו", title: "נוכחות פעילה", note: "ביקור פעיל = פעימת נוכחות ב־60 השניות האחרונות בעמוד גלוי." },
  "measure-today": { label: "תמונת היום", title: "סיכום היום", note: "השוואה ליום הקודם ולשבוע הקודם — רק מנתונים אמיתיים." },
  "measure-content": { label: "תוכן", title: "ביצועי תוכן", note: "צפיות, חשיפות, הקלקות וקריאה משוערת לפי פרסום." },
  "measure-home": { label: "דף הבית", title: "פסים וכרטיסים", note: "חשיפה והקלקה לפי מיקום בדף הבית." },
  "measure-audience": { label: "קהל והפצה", title: "מקורות וקהל", note: "מקור לא ידוע מסומן «לא ידוע» — לעולם לא «ישיר» בכפייה." },
  "measure-paths": { label: "מסלולי גלישה", title: "רצפי אירועים", note: "זוגות נתיבים נפוצים ושחזור ביקור לפי מזהה." },
  "measure-search": { label: "חיפוש והעוזר", title: "חיפוש ו־Ask", note: "שאילתות מצומצמות בלבד; עלויות Ask מהיומן הקיים." },
  "measure-ux": { label: "חוויית שימוש", title: "הקלקות וגלילה", note: "מפת חום מצטברת ושחזור כרונולוגי — בלי נתוני דמו." },
  "measure-errors": { label: "תקלות וביצועים", title: "תקלות ו־Web Vitals", note: "חריגות, שגיאות מדיה ו־404." },
  "measure-insights": { label: "תובנות", title: "תובנות מחושבות", note: "בלי טענת סיבתיות. מדגם קטן מסומן במפורש." },
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function labelSource(source: unknown): string {
  const s = String(source ?? "").trim();
  if (!s || s === "unknown") return "לא ידוע";
  return s;
}

export function MeasurementPanel({ signal, area }: { signal: number; area: MeasureArea }) {
  const screen = AREA_TO_SCREEN[area];
  const meta = AREA_META[area];
  const [includeStaff, setIncludeStaff] = useState(false);
  const [includeBots, setIncludeBots] = useState(false);
  const [visitId, setVisitId] = useState("");
  const areaRef = useRef<HTMLElement | null>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams({
      screen,
      includeStaff: String(includeStaff),
      includeBots: String(includeBots),
    });
    if (visitId.trim()) params.set("visitId", visitId.trim());
    return `admin/console/measurement?${params.toString()}`;
  }, [screen, includeStaff, includeBots, visitId]);

  const read = useConsoleRead<MeasurementConsoleResponse>(path, {
    signal,
    pollInterval: area === "measure-now" ? 15_000 : 60_000,
  });

  return (
    <section className={styles.area} id={`console-${area}`} aria-labelledby={`console-${area}-heading`} ref={areaRef} tabIndex={-1}>
      <AreaHead id={`console-${area}`} label={meta.label} title={meta.title} note={meta.note} />
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <label><input type="checkbox" checked={includeStaff} onChange={(e) => setIncludeStaff(e.target.checked)} /> כולל צוות</label>
        <label><input type="checkbox" checked={includeBots} onChange={(e) => setIncludeBots(e.target.checked)} /> כולל בוטים</label>
        {(area === "measure-paths" || area === "measure-ux") ? (
          <label>מזהה ביקור <input value={visitId} onChange={(e) => setVisitId(e.target.value)} placeholder="visit_id" dir="ltr" /></label>
        ) : null}
      </div>
      <ReadGate state={read.state} what={meta.label} reload={read.reload}>
        {(value) => {
          if (value.empty === "not_connected") {
            return <p className={styles.muted} role="status">{value.messageHe ?? "המדידה לא מחוברת"}</p>;
          }
          if (value.empty === "no_data_yet") {
            return <p className={styles.muted} role="status">{value.messageHe ?? "אין עדיין נתונים מאז הפעלת המדידה"}</p>;
          }
          return <ScreenBody area={area} value={value} />;
        }}
      </ReadGate>
    </section>
  );
}

function ScreenBody({ area, value }: { area: MeasureArea; value: MeasurementConsoleResponse }) {
  const data = value.data as Record<string, unknown> | null;
  if (!data) return <p className={styles.muted}>אין נתונים להצגה.</p>;

  if (area === "measure-now") {
    const visits = (data.visits as Array<Record<string, unknown>>) ?? [];
    const topPaths = (data.topPaths as Array<[string, number]>) ?? [];
    const topSources = (data.topSources as Array<[string, number]>) ?? [];
    return (
      <>
        <StatGrid>
          <Stat label="ביקורים פעילים" value={String(data.activeCount ?? 0)} />
          <Stat label="חלון פעילות (שניות)" value={String(data.activeWindowSeconds ?? 60)} />
        </StatGrid>
        <section className={styles.panel}><PanelTitle>נתיבים עכשיו</PanelTitle>
          <ul>{topPaths.map(([path, n]) => <li key={path}><bdi>{path}</bdi> — {n}</li>)}</ul>
          {topPaths.length === 0 ? <p className={styles.muted}>אין נוכחות פעילה כרגע.</p> : null}
        </section>
        <section className={styles.panel}><PanelTitle>מקורות מובילים</PanelTitle>
          <ul>{topSources.map(([source, n]) => <li key={source}>{labelSource(source)} — {n}</li>)}</ul>
        </section>
        <details className={styles.traceability}><summary>רשימת ביקורים ({visits.length})</summary>
          <ul>{visits.map((v) => <li key={String(v.visit_id)}><bdi>{String(v.visit_id)}</bdi> · <bdi>{String(v.path)}</bdi> · {labelSource(v.source)}</li>)}</ul>
        </details>
      </>
    );
  }

  if (area === "measure-today") {
    return (
      <StatGrid>
        <Stat label="מבקרים היום" value={String(num(data.visitors_today))} />
        <Stat label="ביקורים היום" value={String(num(data.visits_today))} />
        <Stat label="צפיות עמוד היום" value={String(num(data.pageviews_today))} />
        <Stat label="מבקרים אתמול" value={String(num(data.visitors_yesterday))} />
        <Stat label="ביקורים אתמול" value={String(num(data.visits_yesterday))} />
        <Stat label="צפיות אתמול" value={String(num(data.pageviews_yesterday))} />
        <Stat label="מבקרים 7 ימים קודמים" value={String(num(data.visitors_prev_week))} />
        <Stat label="ביקורים 7 ימים קודמים" value={String(num(data.visits_prev_week))} />
      </StatGrid>
    );
  }

  if (area === "measure-content" || area === "measure-home" || area === "measure-audience" || area === "measure-errors") {
    const rows = (data.rows as Array<Record<string, unknown>>) ?? [];
    return (
      <section className={styles.panel}>
        <PanelTitle>שורות ({rows.length})</PanelTitle>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {rows[0] ? Object.keys(rows[0]).map((k) => <th key={k} style={{ textAlign: "right", padding: "0.25rem" }}>{k}</th>) : <th>אין שורות</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {Object.entries(row).map(([k, v]) => (
                    <td key={k} style={{ padding: "0.25rem" }}><bdi>{k === "source" ? labelSource(v) : String(v ?? "")}</bdi></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <p className={styles.muted}>אין שורות לתקופה שנבחרה.</p> : null}
      </section>
    );
  }

  if (area === "measure-paths") {
    const pairs = (data.pairs as Array<Record<string, unknown>>) ?? [];
    const sequence = (data.sequence as Array<Record<string, unknown>>) ?? [];
    return (
      <>
        <section className={styles.panel}><PanelTitle>זוגות נתיבים</PanelTitle>
          <ul>{pairs.map((p, i) => <li key={i}><bdi>{String(p.from_path)}</bdi> → <bdi>{String(p.to_path)}</bdi> ({String(p.transitions)})</li>)}</ul>
          {pairs.length === 0 ? <p className={styles.muted}>אין מעברים עדיין.</p> : null}
        </section>
        <section className={styles.panel}><PanelTitle>שחזור ביקור</PanelTitle>
          {sequence.length === 0 ? <p className={styles.muted}>הזינו visit_id כדי לראות רצף.</p> : (
            <ol>{sequence.map((e, i) => <li key={i}>{formatDate(String(e.occurred_at))} · {String(e.name)} · <bdi>{String(e.page_path ?? "")}</bdi></li>)}</ol>
          )}
        </section>
      </>
    );
  }

  if (area === "measure-search") {
    const search = (data.search as Array<Record<string, unknown>>) ?? [];
    const ask = (data.ask as Array<Record<string, unknown>>) ?? [];
    const chatCosts = (data.chatCosts as Array<Record<string, unknown>>) ?? [];
    return (
      <>
        <section className={styles.panel}><PanelTitle>חיפוש (מצומצם)</PanelTitle>
          <ul>{search.map((r, i) => <li key={i}><bdi>{String(r.query_redacted ?? "—")}</bdi> · {String(r.name)} · {String(r.n)}</li>)}</ul>
          {search.length === 0 ? <p className={styles.muted}>אין שאילתות עדיין.</p> : null}
        </section>
        <section className={styles.panel}><PanelTitle>Ask</PanelTitle>
          <ul>{ask.map((r, i) => <li key={i}>{String(r.name)} · {String(r.n)} · latency {String(r.avg_latency_ms ?? "—")} · cost {String(r.sum_cost_usd ?? "—")}</li>)}</ul>
        </section>
        <section className={styles.panel}><PanelTitle>עלויות צ׳אט (יומן קיים)</PanelTitle>
          <ul>{chatCosts.map((r, i) => <li key={i}>{formatDate(String(r.day))} · {String(r.runs)} · ${String(r.cost_usd)}</li>)}</ul>
          {chatCosts.length === 0 ? <p className={styles.muted}>אין רשומות עלות צ׳אט לתקופה, או שהיומן אינו זמין.</p> : null}
        </section>
      </>
    );
  }

  if (area === "measure-ux") {
    const heatmap = (data.heatmap as Array<Record<string, unknown>>) ?? [];
    const scrolls = (data.scrolls as Array<Record<string, unknown>>) ?? [];
    const reconstruction = (data.reconstruction as Array<Record<string, unknown>>) ?? [];
    return (
      <>
        <section className={styles.panel}><PanelTitle>מפת חום (מצטבר)</PanelTitle>
          <p className={styles.muted}>{heatmap.length} תאים עם הקלקות. אין שכבת צילום מדומה.</p>
          <ul>{heatmap.slice(0, 50).map((c, i) => <li key={i}>bucket ({String(c.bx)},{String(c.by)}) — {String(c.n)}</li>)}</ul>
        </section>
        <section className={styles.panel}><PanelTitle>גלילה</PanelTitle>
          <ul>{scrolls.map((s, i) => <li key={i}>{String(s.scroll_pct)}% — {String(s.n)}</li>)}</ul>
        </section>
        <section className={styles.panel}><PanelTitle>שחזור ביקור</PanelTitle>
          {reconstruction.length === 0 ? <p className={styles.muted}>הזינו visit_id.</p> : (
            <ol>{reconstruction.map((e, i) => <li key={i}>{formatDate(String(e.occurredAt ?? e.occurred_at))} · {String(e.name)} · <bdi>{String(e.pagePath ?? e.page_path ?? "")}</bdi></li>)}</ol>
          )}
        </section>
      </>
    );
  }

  if (area === "measure-insights") {
    const cards = (data.cards as Array<Record<string, unknown>>) ?? [];
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        {cards.map((card) => (
          <section className={styles.panel} key={String(card.id)}>
            <PanelTitle>{String(card.metric)}</PanelTitle>
            <p>תקופה: {String(card.period)} · n={String(card.n)}</p>
            {card.noteHe ? <p className={styles.muted}>{String(card.noteHe)}</p> : null}
            <details className={styles.traceability}><summary>פרטים</summary><pre dir="ltr" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(card, null, 2)}</pre></details>
          </section>
        ))}
        {cards.length === 0 ? <p className={styles.muted}>אין תובנות לחישוב עדיין.</p> : null}
      </div>
    );
  }

  return <p className={styles.muted}>מסך לא מוכר.</p>;
}
