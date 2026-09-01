"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";

type Publication = {
  id: string; publicId: string; title: string; summary: string | null; body: string;
  section: "daily_brief" | "israel_update" | "war_update" | "narrative_watch";
  status: "draft" | "under_review" | "approved" | "published" | "updated" | "archived";
  editorialTopic: string | null; primaryActor: string | null; arena: string | null; featuredIsraelStory: boolean;
  narrativeWatchDetails: {
    exactClaim: string; propagators: string[]; arenas: string[]; trendDirection: string;
    israeliPosition: string | null; securityContext: string | null;
    supportingEvidenceIds: string[]; contradictingEvidenceIds: string[];
    verificationState: string; knownUnknowns: string[];
    /* Optional on purpose. This panel reads the admin list, which serves the
       raw jsonb rather than the normalised public projection, so rows written
       before the field existed genuinely have no key. Declaring it required
       here would have TypeScript assert a value the row may not carry.
       Read it as `=== "analysis"` and never as the negation. */
    evidenceBasis?: "sourced" | "analysis";
  } | null;
  briefingRunId: string | null;
  createdAt: string;
};

export function PublicationManager() {
  const [items, setItems] = useState<Publication[]>([]);
  const [features, setFeatures] = useState<Array<{ slot: number; publicationId: string }>>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [publicationResponse, featureResponse] = await Promise.all([
      fetch("/api/v1/publications?limit=100&briefingOnly=true", { cache: "no-store" }),
      fetch("/api/v1/admin/homepage-features", { cache: "no-store" }),
    ]);
    if (!publicationResponse.ok || !featureResponse.ok) throw new Error("לא ניתן לטעון את הפרסומים.");
    const publicationPayload = await publicationResponse.json() as { publications: Publication[] };
    const featurePayload = await featureResponse.json() as { features: Array<{ slot: number; publicationId: string }> };
    setItems(publicationPayload.publications); setFeatures(featurePayload.features);
    setSelectedId((current) => current || publicationPayload.publications[0]?.id || "");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((cause: Error) => setMessage(cause.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const eligible = items.filter((item) =>
    (item.status === "published" || item.status === "updated")
    && item.briefingRunId !== null
    && item.section !== "daily_brief",
  );

  return (
    <section className={styles.editorPanel}>
      <div className={styles.panelHead}><div><p className={styles.sectionLabel}>מערכת</p><h2>עריכה ומיקום פרסומים</h2></div></div>
      {message ? <p className={styles.notice} role="status">{message}</p> : null}
      <div className={styles.featureSlots}>{[1, 2, 3].map((slot) => <label key={slot}><span>כותרת מובילה {slot}</span><select value={features.find((feature) => feature.slot === slot)?.publicationId ?? ""} onChange={(event) => setSlot(slot, event.target.value || null)} disabled={busy}><option value="">בחירה אוטומטית</option>{eligible.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>)}</div>
      <div className={styles.editorLayout}>
        <aside className={styles.draftQueue} aria-label="רשימת פרסומים">{items.map((item) => <button type="button" key={item.id} className={item.id === selectedId ? styles.selectedDraft : ""} onClick={() => setSelectedId(item.id)}><span>{item.status}</span><strong>{item.title}</strong><small>{item.section}</small></button>)}</aside>
        {selected ? <PublicationForm key={selected.id} publication={selected} busy={busy} onSave={save} onTransition={transition} onArchive={archive} onDelete={remove} /> : <p className={styles.muted}>אין פרסומים לעריכה.</p>}
      </div>
    </section>
  );

  async function save(id: string, form: HTMLFormElement) {
    setBusy(true); setMessage(null);
    const data = new FormData(form);
    const current = items.find((item) => item.id === id)!;
    const narrativeWatchDetails = current.narrativeWatchDetails ? {
      ...current.narrativeWatchDetails,
      exactClaim: String(data.get("exactClaim")),
      propagators: lines(data.get("propagators")),
      arenas: lines(data.get("narrativeArenas")),
      trendDirection: String(data.get("trendDirection")),
      israeliPosition: optional(data.get("israeliPosition")),
      securityContext: optional(data.get("securityContext")),
      knownUnknowns: lines(data.get("knownUnknowns")),
    } : undefined;
    const body = {
      title: String(data.get("title")), summary: String(data.get("summary")), body: String(data.get("body")),
      section: String(data.get("section")), editorialTopic: optional(data.get("editorialTopic")),
      primaryActor: optional(data.get("primaryActor")), arena: optional(data.get("arena")),
      featuredIsraelStory: data.get("featuredIsraelStory") === "on", changeSummary: "Administrator editorial update",
      ...(narrativeWatchDetails ? { narrativeWatchDetails } : {}),
    };
    try {
      const response = await fetch(`/api/v1/publications/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error("שמירת הפרסום נכשלה.");
      await load(); setMessage("הפרסום נשמר.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "הפעולה נכשלה."); } finally { setBusy(false); }
  }
  async function archive(id: string) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/publications/${id}/transition`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: "archived" }) });
      if (!response.ok) throw new Error("העברה לארכיון נכשלה.");
      await load(); setMessage("הפרסום הוסר מהאתר ונשמר בארכיון.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "הפעולה נכשלה."); } finally { setBusy(false); }
  }
  async function transition(id: string, to: Publication["status"]) {
    if (to === "published" && !window.confirm("לפרסם את הכתבה לציבור עכשיו? לאחר הפרסום היא תופיע בעמודים הציבוריים ובמנועי חיפוש.")) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/publications/${id}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
      });
      if (!response.ok) throw new Error("עדכון מצב הפרסום נכשל.");
      await load();
      setMessage(transitionMessage(to));
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "הפעולה נכשלה."); } finally { setBusy(false); }
  }
  async function setSlot(slot: number, publicationId: string | null) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/homepage-features", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ slot, publicationId }) });
      if (!response.ok) throw new Error("עדכון הכותרת המובילה נכשל.");
      await load(); setMessage("מיקום עמוד הבית עודכן.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "הפעולה נכשלה."); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("למחוק לצמיתות את הפרסום? הראיות והיסטוריית הביקורת יישמרו.")) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/publications/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("מחיקת הפרסום נכשלה.");
      await load(); setMessage("הפרסום נמחק. הראיות והיסטוריית הביקורת נשמרו.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "הפעולה נכשלה."); } finally { setBusy(false); }
  }
}

function PublicationForm({ publication, busy, onSave, onTransition, onArchive, onDelete }: { publication: Publication; busy: boolean; onSave: (id: string, form: HTMLFormElement) => void; onTransition: (id: string, to: Publication["status"]) => void; onArchive: (id: string) => void; onDelete: (id: string) => void }) {
  return <form className={styles.editorForm} onSubmit={(event) => { event.preventDefault(); onSave(publication.id, event.currentTarget); }}>
    <div className={styles.editorStatus}><span>{publication.status}</span><span>{publication.publicId}</span></div>
    <label><span>כותרת</span><input name="title" defaultValue={publication.title} required /></label>
    <label><span>תקציר</span><textarea name="summary" defaultValue={publication.summary ?? ""} rows={4} /></label>
    <label><span>גוף הכתבה</span><textarea name="body" defaultValue={publication.body} rows={18} required /></label>
    <div className={styles.formGrid}>
      <label><span>מדור</span><select name="section" defaultValue={publication.section}>{publication.section === "narrative_watch" ? <option value="narrative_watch">מעקב נרטיבים</option> : <><option value="daily_brief">בריף יומי</option><option value="israel_update">עדכון ישראל</option><option value="war_update">עדכון מלחמה</option></>}</select></label>
      <label><span>נושא</span><input name="editorialTopic" defaultValue={publication.editorialTopic ?? ""} /></label>
      <label><span>שחקן מרכזי</span><input name="primaryActor" defaultValue={publication.primaryActor ?? ""} /></label>
      <label><span>זירה</span><input name="arena" defaultValue={publication.arena ?? ""} /></label>
    </div>
    {publication.narrativeWatchDetails ? <fieldset className={styles.narrativeFields}><legend>פרטי מעקב נרטיב</legend>
      {/* Read-only on purpose: the basis is derived from whether the article
          cites anything, never chosen. A form control here would let an editor
          relabel a sourced piece as analysis — or, worse, strip the disclosure
          off an unsourced one — with no change to the evidence underneath. */}
      <div className={styles.editorStatus}>
        <span>evidence basis</span>
        <span>{publication.narrativeWatchDetails.evidenceBasis === "analysis" ? "analysis · no source cited" : "sourced"}</span>
      </div>
      <p className={styles.muted}>בסיס הראיות נגזר מכך שהכתבה מצטטת ראיות, ואינו ניתן לבחירה בטופס. כדי לשנותו יש לשנות את הראיות המקושרות לכתבה.</p>
      <label><span>הטענה המדויקת</span><textarea name="exactClaim" defaultValue={publication.narrativeWatchDetails.exactClaim} rows={4} required /></label>
      <div className={styles.formGrid}>
        <label><span>מפיצים — שורה לכל גורם</span><textarea name="propagators" defaultValue={publication.narrativeWatchDetails.propagators.join("\n")} rows={4} /></label>
        <label><span>זירות — שורה לכל זירה</span><textarea name="narrativeArenas" defaultValue={publication.narrativeWatchDetails.arenas.join("\n")} rows={4} required /></label>
        <label><span>מגמה</span><select name="trendDirection" defaultValue={publication.narrativeWatchDetails.trendDirection}><option value="new">חדשה</option><option value="rising">עולה</option><option value="stable">יציבה</option><option value="declining">יורדת</option><option value="unclear">לא ברורה</option></select></label>
        <label><span>לא ידוע — שורה לכל נקודה</span><textarea name="knownUnknowns" defaultValue={publication.narrativeWatchDetails.knownUnknowns.join("\n")} rows={4} /></label>
      </div>
      <label><span>העמדה הישראלית</span><textarea name="israeliPosition" defaultValue={publication.narrativeWatchDetails.israeliPosition ?? ""} rows={5} /></label>
      <label><span>הקשר ביטחוני</span><textarea name="securityContext" defaultValue={publication.narrativeWatchDetails.securityContext ?? ""} rows={5} /></label>
    </fieldset> : null}
    <PublicationTrace publicationId={publication.id} />
    <label className={styles.checkbox}><input type="checkbox" name="featuredIsraelStory" defaultChecked={publication.featuredIsraelStory} /><span>כתבה ישראלית יומית מובילה</span></label>
    <div className={styles.actionRow}>
      <button className={styles.primary} type="submit" disabled={busy}>שמור שינויים</button>
      {publicationActions(publication.status).map((action) => <button key={action.to} className={action.primary ? styles.primary : styles.secondary} type="button" disabled={busy} onClick={() => onTransition(publication.id, action.to)}>{action.label}</button>)}
      {publication.status !== "archived" ? <button className={styles.danger} type="button" disabled={busy} onClick={() => onArchive(publication.id)}>הסר מהאתר והעבר לארכיון</button> : null}
      {(publication.status === "archived" || publication.status === "draft") ? <button className={styles.danger} type="button" disabled={busy} onClick={() => onDelete(publication.id)}>מחיקה לצמיתות</button> : null}
    </div>
  </form>;
}

function publicationActions(status: Publication["status"]): Array<{ to: Publication["status"]; label: string; primary?: boolean }> {
  switch (status) {
    case "draft": return [{ to: "under_review", label: "העבר לבדיקה" }];
    case "under_review": return [{ to: "approved", label: "אשר לפרסום", primary: true }, { to: "draft", label: "החזר לטיוטה" }];
    case "approved": return [{ to: "published", label: "פרסם עכשיו", primary: true }, { to: "draft", label: "החזר לטיוטה" }];
    case "updated": return [{ to: "published", label: "פרסם עדכון", primary: true }];
    case "archived": return [{ to: "draft", label: "שחזר לטיוטה" }];
    default: return [];
  }
}

function transitionMessage(to: Publication["status"]): string {
  return ({
    draft: "הפרסום הוחזר לטיוטה.",
    under_review: "הפרסום הועבר לבדיקה.",
    approved: "הפרסום אושר ומוכן לפרסום.",
    published: "הפרסום עלה לאתר.",
    updated: "הפרסום סומן כמעודכן.",
    archived: "הפרסום הועבר לארכיון.",
  } as const)[to];
}

function optional(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || null; }
function lines(value: FormDataEntryValue | null) { return String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }

type Traceability = {
  briefingRun: { id: string; localDate: string; stage: string; status: string } | null;
  edition: { id: string; contractVersion: string; promptVersion: string; status: string } | null;
  modelRuns: Array<{ id: string; model: string; profile: string; stage: string; costUsd: number }>;
  claims: Array<{ id: string; title: string; assessment: string; aiRunId: string | null; evidenceCount: number }>;
  sources: Array<{ id: string; title: string; publisher: string; url: string | null; retrievalStatus: string }>;
};

function PublicationTrace({ publicationId }: { publicationId: string }) {
  const [trace, setTrace] = useState<Traceability | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/v1/publications/${publicationId}/traceability`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("trace unavailable")))
      .then((payload: Traceability) => { if (live) setTrace(payload); })
      .catch(() => { if (live) setTrace(null); });
    return () => { live = false; };
  }, [publicationId]);
  if (!trace) return <p className={styles.muted}>טוען עקיבות…</p>;
  return <details className={styles.traceability}><summary>עקיבות: ריצה, דגם ומקורות</summary>
    <p>{trace.briefingRun ? `${trace.briefingRun.localDate} · ${trace.briefingRun.stage} · ${trace.briefingRun.status} · ${trace.briefingRun.id}` : "פרסום ידני ללא ריצת מערכת."}</p>
    {trace.edition ? <p>{`מהדורה ${trace.edition.id} · חוזה ${trace.edition.contractVersion} · הנחיה ${trace.edition.promptVersion} · ${trace.edition.status}`}</p> : null}
    <ul>{trace.modelRuns.map((run) => <li key={run.id}>{run.model} · {run.stage} · ${run.costUsd.toFixed(4)}</li>)}</ul>
    <ul>{trace.claims.map((claim) => <li key={claim.id}>{claim.title} · {claim.assessment} · {claim.evidenceCount} ראיות · {claim.aiRunId ?? "ללא ריצת דגם"}</li>)}</ul>
    <ul>{trace.sources.map((source) => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title} · {source.publisher} · {source.retrievalStatus}</li>)}</ul>
  </details>;
}
