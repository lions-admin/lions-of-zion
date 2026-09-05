"use client";

import { useEffect, useRef, useState } from "react";
import { useUnsavedChanges } from "./UnsavedChanges";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { SelectField } from "@/components/ui/SelectField";
import { assertiveLive } from "@/components/ui/live-region";
import type { ConsoleEditorial, PublicationVersion } from "@/server/contracts/admin-console";
import type { Publication, Traceability } from "./briefing-shapes";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import { AreaHead, ConsoleNotices, EmptyLine, InlineAbsence, PanelTitle, Pill, ReadGate, formatDate, formatUsd, publicationTone, useOperations } from "./console-primitives";
import { ABSENCE, SECTION_LABEL, STATUS_LABEL, T, TREND_LABEL } from "./lexicon";
import { NarrativesPanel } from "./NarrativesPanel";
import { callConsole, readConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";
import workspace from "./workspace.module.css";

export function EditorialDesk({ signal }: { signal: number }) {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const briefingOnly = params.get("briefingOnly") === "true";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = new URLSearchParams({ page: String(page), limit: "25", briefingOnly: String(briefingOnly), q: query });
  if (status) search.set("status", status);
  const editorial = useConsoleRead<ConsoleEditorial>(`admin/console/editorial?${search}`, { signal });
  const [selectedId, setSelectedId] = useState("");
  const selectedRead = useConsoleRead<Publication>(`publications/${selectedId}`, { signal, enabled: !!selectedId });
  const selected = selectedRead.value;
  const [versionsFor, setVersionsFor] = useState<Publication | null>(null);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  const [dirty, setDirty] = useState(false);
  const registerDirty = useUnsavedChanges();
  const deskRef = useRef<HTMLElement | null>(null);
  const ops = useOperations();
  const features = editorial.value?.homepageFeatures ?? [];
  const noticeId = ops.notice?.kind === "error" ? "console-editorial-error" : ops.notice?.kind === "ok" ? "console-editorial-notice" : undefined;

  useEffect(() => {
    registerDirty(dirty);
    return () => registerDirty(false);
  }, [dirty, registerDirty]);
  useEffect(() => {
    if (selectedId) window.dispatchEvent(new Event("loz:editor-open"));
  }, [selectedId]);
  useEffect(() => {
    const discard = () => { setDirty(false); setSelectedId(""); };
    window.addEventListener("loz:discard-editor", discard);
    return () => window.removeEventListener("loz:discard-editor", discard);
  }, []);

  function filter(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    next.set("area", "editorial"); next.delete("page");
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    router.push(`/admin?${next}`, { scroll: false });
  }
  function reloadAll() { editorial.reload(); selectedRead.reload(); }
  function closeEditor() {
    if (ops.disabled) return;
    if (!dirty) { setSelectedId(""); return; }
    setConfirmIntent({ action: "יציאה ללא שמירה", target: selected?.title ?? "הכתבה", consequence: "השינויים שטרם נשמרו יימחקו. הגרסה השמורה לא תשתנה.", confirmLabel: "יציאה ללא שמירה", tone: "danger", run: () => { setDirty(false); setSelectedId(""); } });
  }

  return (
    <section id="console-editorial" className={styles.area} aria-labelledby="console-editorial-heading" ref={deskRef} tabIndex={-1}>
      <AreaHead id="console-editorial" label="כתבות ופרסום" title="שולחן העריכה" note="חיפוש, בדיקה ועריכה של כלל הפרסומים. בחרו כתבה כדי לפתוח את העורך." />
      {!selectedId ? <ConsoleNotices busy={ops.busy} notice={ops.notice} idPrefix="console-editorial" /> : null}
      <form className={workspace.filters} onSubmit={(event) => { event.preventDefault(); filter({ q: String(new FormData(event.currentTarget).get("q") ?? "") }); }}>
        <Field key={query} type="search" name="q" label="חיפוש כותרת או מזהה" defaultValue={query} maxLength={200} />
        <Button variant="secondary" type="submit">חיפוש</Button>
        {query ? <Button variant="ghost" type="button" onClick={() => filter({ q: "" })}>ניקוי חיפוש</Button> : null}
        <SelectField label="מצב" value={status} onChange={(event) => filter({ status: event.target.value })}>
          <option value="">כל המצבים</option>
          {Object.entries(STATUS_LABEL).map(([key,label]) => <option value={key} key={key}>{label}{editorial.value ? ` · ${editorial.value.counts[key as keyof ConsoleEditorial["counts"]] ?? 0}` : ""}</option>)}
        </SelectField>
        <SelectField label="סוג פרסומים" value={String(briefingOnly)} onChange={(event) => filter({ briefingOnly: event.target.value })}>
          <option value="false">כל הפרסומים</option><option value="true">פרסומי הבריף בלבד</option>
        </SelectField>
      </form>
      <ReadGate state={editorial.state} what="רשימת הכתבות" reload={editorial.reload}>
        {(value) => value.page ? <>
          <p className={styles.headNote}>{value.page.total} תוצאות בסינון הנוכחי · עמוד {value.page.number} מתוך {value.page.pages}</p>
          {value.page.items.length ? <ul className={workspace.publicationList}>
            {value.page.items.map((card) => <li key={card.id}>
              <button className={workspace.publicationRow} type="button" onClick={() => { setDirty(false); setSelectedId(card.id); }}>
                <span><strong dir="auto">{card.title}</strong><small>{SECTION_LABEL[card.section]} · {card.evidenceCount} ראיות{card.homepageSlot ? ` · כותרת מובילה ${card.homepageSlot}` : ""}</small></span>
                <Pill tone={publicationTone(card.status)}>{STATUS_LABEL[card.status]}</Pill>
                <small>{formatDate(card.updatedAt)}</small>
              </button>
            </li>)}
          </ul> : <EmptyLine>לא נמצאו כתבות בסינון הנוכחי. ניתן לשנות את המסננים או לנקות את החיפוש.</EmptyLine>}
          <div className={workspace.pagination}>
            <Button variant="secondary" size="sm" disabled={value.page.number <= 1} onClick={() => filter({ page: String(value.page!.number - 1) })}>העמוד הקודם</Button>
            <span>{value.page.total ? `${(value.page.number - 1) * value.page.limit + 1}–${(value.page.number - 1) * value.page.limit + value.page.items.length} מתוך ${value.page.total}` : "אין תוצאות"}</span>
            <Button variant="secondary" size="sm" disabled={value.page.number >= value.page.pages} onClick={() => filter({ page: String(value.page!.number + 1) })}>העמוד הבא</Button>
          </div>
        </> : <p className={styles.error}>השרת אינו תומך עדיין ברשימת העריכה המעומדת. יש לעדכן את השרת והממשק יחד.</p>}
      </ReadGate>
      <details className={styles.panel}>
        <summary>כותרות מובילות בעמוד הבית</summary>
        <p className={styles.muted}>להצבת כתבה חדשה, פתחו אותה ובחרו מקום בעורך. מקום פנוי חוזר לבחירה אוטומטית.</p>
        {[1,2,3].map((slot) => <div key={slot} className={styles.actionRow}>
          <span>מקום {slot}: {features.some((feature) => feature.slot === slot) ? "נבחרה כתבה" : "בחירה אוטומטית"}</span>
          {features.find((feature) => feature.slot === slot) ? <>
            <Button size="sm" variant="secondary" onClick={() => setSelectedId(features.find((feature) => feature.slot === slot)!.publicationId)}>פתיחת הכתבה</Button>
            <Button size="sm" variant="ghost" disabled={ops.disabled} onClick={() => setSlot(slot, null)}>חזרה לבחירה אוטומטית</Button>
          </> : null}
        </div>)}
      </details>
      <details className={styles.panel}><summary>נרטיבים במעקב</summary><NarrativesPanel signal={signal} /></details>
      <Dialog open={!!selectedId} onClose={closeEditor} variant="drawer" size="wide" title="עריכת כתבה" closeLabel="סגירת העורך" dismissOnBackdrop={false} className={workspace.editorDrawer}>
        {selectedId ? <>
          <ConsoleNotices busy={ops.busy} notice={ops.notice} idPrefix="console-editorial" />
          {selectedRead.value ? <InlineAbsence state={selectedRead.state} what="הכתבה" reload={selectedRead.reload} /> : null}
          <ReadGate state={selectedRead.value ? { kind: "ready", value: selectedRead.value } : selectedRead.state} what="הכתבה" reload={selectedRead.reload}>
            {(publication) => <>
              <PublicationForm key={publication.id} publication={publication} noticeId={noticeId} busy={ops.disabled}
                onDirty={() => { registerDirty(true); setDirty(true); }} onSave={save} onTransition={requestTransition} onArchive={requestArchive}
                onDelete={requestDelete} onVersions={() => setVersionsFor(publication)} />
              {(publication.status === "published" || publication.status === "updated") && publication.briefingRunId !== null && publication.section !== "daily_brief" ? <div className={styles.panel}>
                <PanelTitle>הצבה בעמוד הבית</PanelTitle><p className={styles.muted}>בחירת מקום תחליף את הכותרת המובילה שמוצגת בו כרגע.</p>
                <div className={styles.actionRow}>{[1,2,3].map((slot) => <Button key={slot} size="sm" variant="secondary" disabled={ops.disabled} onClick={() => setSlot(slot, publication.id)}>הצבה במקום {slot}</Button>)}</div>
              </div> : null}
            </>}
          </ReadGate>
        </> : null}
      </Dialog>
      <VersionsDrawer publication={versionsFor} onClose={() => setVersionsFor(null)} onRollback={requestRollback} disabled={ops.disabled} />
      <ConfirmDialog intent={confirmIntent} onClose={() => setConfirmIntent(null)} fallbackFocusRef={deskRef} />
    </section>
  );

  function targetDetail(publication: Publication) {
    return `${publication.publicId} · ${SECTION_LABEL[publication.section]} · ${STATUS_LABEL[publication.status]}`;
  }

  /* The confirmation requests. Each one names the action, the exact
     publication, and what the operator cannot take back. */
  function requestArchive(publication: Publication) {
    setConfirmIntent({
      action: "הסרת הכתבה הזו מהאתר והעברתה לארכיון",
      target: publication.title,
      targetDetail: targetDetail(publication),
      consequence: "הכתבה מפסיקה להיות מוגשת בעמודים הציבוריים ובתוצאות החיפוש ברגע שהשינוי נכנס לתוקף. כתבה בארכיון אפשר להחזיר לטיוטה מתור העריכה הזה.",
      confirmLabel: "הסרה וארכוב",
      tone: "danger",
      run: () => archive(publication.id),
    });
  }

  function requestDelete(publication: Publication) {
    setConfirmIntent({
      action: "מחיקת הכתבה הזו לצמיתות",
      target: publication.title,
      targetDetail: targetDetail(publication),
      consequence: "הכתבה וכל היסטוריית הגרסאות שלה נמחקות, ואי אפשר לשחזר אותן מהקונסולה הזו. הראיות המקושרות ורשומת הבדיקה נשמרות.",
      confirmLabel: "מחיקה לצמיתות",
      tone: "danger",
      run: () => remove(publication.id),
    });
  }

  function requestTransition(publication: Publication, to: Publication["status"]) {
    if (dirty) { ops.setNotice({ kind: "error", text: "יש לשמור את שינויי התוכן לפני שינוי מצב הכתבה." }); return; }
    /* Publication is the one workflow step that reaches the public, so it is
       the one that asks. The rest move between internal states. */
    if (to !== "published") { void transition(publication.id, to); return; }
    setConfirmIntent({
      action: publication.status === "updated" ? "פרסום העדכון הזה עכשיו" : "פרסום הכתבה הזו עכשיו",
      target: publication.title,
      targetDetail: targetDetail(publication),
      consequence: "הכתבה הופכת מיד לקריאה בעמודים הציבוריים וזמינה למנועי חיפוש. הורדה שלה בהמשך פירושה ארכוב, וייתכן שקוראים כבר ראו אותה.",
      confirmLabel: publication.status === "updated" ? "פרסום העדכון" : "פרסום עכשיו",
      tone: "primary",
      run: () => transition(publication.id, to),
    });
  }

  function requestRollback(publication: Publication, version: PublicationVersion) {
    setConfirmIntent({
      action: `החזרת הכתבה הזו לגרסה ${version.versionNumber}`,
      target: publication.title,
      targetDetail: `${targetDetail(publication)} · ${T.version} ${version.versionNumber} מאת ${version.actorLabel}, ${formatDate(version.createdAt)}`,
      consequence: "הגרסה הנוכחית של הכתבה מוחלפת בתוכן של אותה גרסה, כגרסה חדשה. אם הכתבה מפורסמת, הקוראים רואים את הטקסט המוחזר ברגע שהשינוי נכנס לתוקף. שום דבר לא נמחק: כל הגרסאות נשארות בהיסטוריה.",
      confirmLabel: T.rollback,
      tone: "danger",
      run: () => rollback(publication, version),
    });
  }

  async function rollback(publication: Publication, version: PublicationVersion) {
    await ops.run("rollback", async () => {
      await callConsole(`admin/console/publications/${publication.id}/rollback`, {
        method: "POST",
        body: { versionId: version.versionId },
        failure: "החזרת הכתבה לגרסה קודמת נכשלה.",
      });
      setVersionsFor(null);
      setDirty(false);
      setSelectedId("");
      reloadAll();
      return `הכתבה הוחזרה לגרסה ${version.versionNumber}. השינוי נרשם כגרסה חדשה.`;
    });
  }

  async function save(id: string, form: HTMLFormElement) {
    const data = new FormData(form);
    const current = selected && selected.id === id ? selected : null;
    if (!current) return;
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
      featuredIsraelStory: data.get("featuredIsraelStory") === "on", changeSummary: "עדכון עריכה של מנהל המערכת",
      ...(narrativeWatchDetails ? { narrativeWatchDetails } : {}),
    };
    await ops.run("save", async () => {
      await callConsole(`publications/${id}`, { method: "PATCH", body, failure: "שמירת הכתבה נכשלה." });
      setDirty(false);
      reloadAll();
      return "הכתבה נשמרה.";
    });
  }

  async function archive(id: string) {
    await ops.run("archive", async () => {
      await callConsole(`publications/${id}/transition`, { method: "POST", body: { to: "archived" }, failure: "הארכוב נכשל." });
      reloadAll();
      return "הכתבה הוסרה מהאתר והועברה לארכיון.";
    });
  }

  async function transition(id: string, to: Publication["status"]) {
    await ops.run("transition", async () => {
      await callConsole(`publications/${id}/transition`, { method: "POST", body: { to }, failure: "עדכון מצב הכתבה נכשל." });
      reloadAll();
      return transitionMessage(to);
    });
  }

  async function setSlot(slot: number, publicationId: string | null) {
    await ops.run("slot", async () => {
      await callConsole("admin/homepage-features", { method: "PUT", body: { slot, publicationId }, failure: "עדכון הכותרת המובילה נכשל." });
      reloadAll();
      return "המיקום בעמוד הבית עודכן.";
    });
  }

  async function remove(id: string) {
    await ops.run("delete", async () => {
      await callConsole(`publications/${id}`, { method: "DELETE", failure: "מחיקת הכתבה נכשלה." });
      /* Clear the selection first so the reload does not leave the id of the
         row just deleted selected, with the editor asking for a selection
         beside lanes that still hold work. */
      setDirty(false);
      setSelectedId("");
      reloadAll();
      return "הכתבה נמחקה. הראיות והיסטוריית הבדיקה נשמרו.";
    });
  }
}

function PublicationForm({ publication, busy, noticeId, onSave, onTransition, onArchive, onDelete, onVersions, onDirty }: { onDirty: () => void; publication: Publication; busy: boolean; noticeId?: string; onSave: (id: string, form: HTMLFormElement) => void; onTransition: (publication: Publication, to: Publication["status"]) => void; onArchive: (publication: Publication) => void; onDelete: (publication: Publication) => void; onVersions: () => void }) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState({ title: publication.title, summary: publication.summary ?? "", body: publication.body });
  const canArchive = publication.status !== "archived";
  const canDelete = publication.status === "archived" || publication.status === "draft";

  /* A11Y-007: the form's result is reported in the desk notice above the
     panel, so the form is described by it. `aria-busy` states the pending
     save on the element that is actually pending. */
  return <div className={workspace.editorColumns}><form noValidate onChange={(event) => { onDirty(); if (event.target instanceof HTMLTextAreaElement) { event.target.style.height = "auto"; event.target.style.height = `${Math.min(900, Math.max(120, event.target.scrollHeight))}px`; } const data = new FormData(event.currentTarget); setPreview({ title: String(data.get("title") ?? ""), summary: String(data.get("summary") ?? ""), body: String(data.get("body") ?? "") }); }} className={styles.editorForm} id="console-editor" aria-label={`עריכת ${publication.title}`} aria-describedby={noticeId} aria-busy={busy || undefined} onSubmit={(event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errors: Record<string, string> = {};
    let first: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue;
      if (element.disabled || !element.name) continue;
      if ((element.required && !element.value.trim()) || !element.validity.valid) {
        errors[element.name] = element.validity.tooLong ? "הטקסט ארוך מדי. יש לקצר אותו." : "יש למלא ערך תקין בשדה הזה.";
        first ??= element;
      }
    }
    setFieldErrors(errors);
    if (first) { first.focus(); return; }
    onSave(publication.id, form);
  }}>
    <fieldset disabled={busy} className={workspace.editorFields}>
    {Object.keys(fieldErrors).length ? <p className={styles.error} role="alert">יש לתקן את השדות המסומנים לפני השמירה.</p> : null}
    <div className={styles.editorStatus}>
      <span>
        <Pill tone={publicationTone(publication.status)}>{STATUS_LABEL[publication.status]}</Pill> · {SECTION_LABEL[publication.section]}
      </span>
      <span>{publication.publicId}</span>
    </div>
    <div className={styles.actionRow}>
      <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={onVersions}>
        {T.versions}
      </Button>
    </div>
    <Field className={styles.editorField} name="title" error={fieldErrors.title} maxLength={300} label="כותרת" defaultValue={publication.title} required />
    <Field className={styles.editorField} name="summary" error={fieldErrors.summary} maxLength={4000} label="תקציר" defaultValue={publication.summary ?? ""} multiline rows={4} />
    <Field className={styles.editorField} name="body" error={fieldErrors.body} maxLength={200000} label="גוף הכתבה" defaultValue={publication.body} multiline rows={18} required />
    <div className={styles.formGrid}>
      <SelectField className={styles.editorField} name="section" error={fieldErrors.section} label="מדור" defaultValue={publication.section}>
        {publication.section === "narrative_watch"
          ? <option value="narrative_watch">{SECTION_LABEL.narrative_watch}</option>
          : <>
            <option value="daily_brief">{SECTION_LABEL.daily_brief}</option>
            <option value="israel_update">{SECTION_LABEL.israel_update}</option>
            <option value="war_update">{SECTION_LABEL.war_update}</option>
          </>}
      </SelectField>
      <Field className={styles.editorField} name="editorialTopic" error={fieldErrors.editorialTopic} label="נושא" defaultValue={publication.editorialTopic ?? ""} />
      <Field className={styles.editorField} name="primaryActor" error={fieldErrors.primaryActor} label="שחקן מרכזי" defaultValue={publication.primaryActor ?? ""} />
      <Field className={styles.editorField} name="arena" error={fieldErrors.arena} label="זירה" defaultValue={publication.arena ?? ""} />
    </div>
    {publication.narrativeWatchDetails ? <FieldGroup legend={`פרטי ${SECTION_LABEL.narrative_watch}`} className={styles.narrativeFields}>
      {/* Read-only on purpose: the basis is derived from whether the article
          cites anything, never chosen. A form control here would let an editor
          relabel a sourced piece as analysis — or, worse, strip the disclosure
          off an unsourced one — with no change to the evidence underneath. */}
      <div className={styles.editorStatus}>
        <span>בסיס הראיות</span>
        <span>{publication.narrativeWatchDetails.evidenceBasis === "analysis" ? "ניתוח · ללא ציטוט מקור" : "מבוסס מקורות"}</span>
      </div>
      <p className={styles.muted}>בסיס הראיות נגזר מכך שהכתבה מצטטת ראיות, ואי אפשר לבחור אותו בטופס הזה. כדי לשנות אותו יש לשנות את הראיות המקושרות לכתבה.</p>
      <Field className={styles.editorField} name="exactClaim" error={fieldErrors.exactClaim} label="הטענה המדויקת" defaultValue={publication.narrativeWatchDetails.exactClaim} multiline rows={4} required />
      <div className={styles.formGrid}>
        <Field className={styles.editorField} name="propagators" error={fieldErrors.propagators} label="מפיצים — אחד בכל שורה" defaultValue={publication.narrativeWatchDetails.propagators.join("\n")} multiline rows={4} />
        <Field className={styles.editorField} name="narrativeArenas" error={fieldErrors.narrativeArenas} label="זירות — אחת בכל שורה" defaultValue={publication.narrativeWatchDetails.arenas.join("\n")} multiline rows={4} required />
        <SelectField className={styles.editorField} name="trendDirection" error={fieldErrors.trendDirection} label="מגמה" defaultValue={publication.narrativeWatchDetails.trendDirection}>
          <option value="new">{TREND_LABEL.new}</option>
          <option value="rising">{TREND_LABEL.rising}</option>
          <option value="stable">{TREND_LABEL.stable}</option>
          <option value="declining">{TREND_LABEL.declining}</option>
          <option value="unclear">לא ברור</option>
        </SelectField>
        <Field className={styles.editorField} name="knownUnknowns" error={fieldErrors.knownUnknowns} label="נעלמים ידועים — אחד בכל שורה" defaultValue={publication.narrativeWatchDetails.knownUnknowns.join("\n")} multiline rows={4} />
      </div>
      <Field className={styles.editorField} name="israeliPosition" error={fieldErrors.israeliPosition} label="העמדה הישראלית" defaultValue={publication.narrativeWatchDetails.israeliPosition ?? ""} multiline rows={5} />
      <Field className={styles.editorField} name="securityContext" error={fieldErrors.securityContext} label="הקשר ביטחוני" defaultValue={publication.narrativeWatchDetails.securityContext ?? ""} multiline rows={5} />
    </FieldGroup> : null}
    <CheckboxField
      className={styles.editorField}
      name="featuredIsraelStory"
      label="סיפור ישראלי יומי מוצג"
      defaultChecked={publication.featuredIsraelStory}
    />
    <PublicationTrace publicationId={publication.id} />
    <div className={styles.actionRow}>
      <Button variant="primary" type="submit" disabled={busy}>שמירת שינויים</Button>
      {publicationActions(publication.status).map((action) => (
        <Button
          key={action.to}
          variant={action.primary ? "primary" : "secondary"}
          type="button"
          disabled={busy}
          onClick={() => onTransition(publication, action.to)}
        >
          {action.label}
        </Button>
      ))}
    </div>
    {canArchive || canDelete ? (
      /* ADMIN-002: destructive actions are their own zone, last in reading
         order and last in tab order, so nothing irreversible sits beside
         Save. Each one opens the shared confirmation. */
      <div className={styles.dangerZone}>
        <p className={styles.dangerLabel}>פעולות בלתי הפיכות</p>
        <p className={styles.muted}>כל אחת מהן מציינת את היעד שלה ואת התוצאה שלה לפני שהיא רצה.</p>
        <div className={styles.actionRow}>
          {canArchive ? (
            <Button variant="danger" type="button" disabled={busy} onClick={() => onArchive(publication)}>
              הסרה מהאתר וארכוב
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="danger" type="button" disabled={busy} onClick={() => onDelete(publication)}>
              מחיקה לצמיתות
            </Button>
          ) : null}
        </div>
      </div>
    ) : null}
    </fieldset>
  </form><aside className={workspace.preview}><p className={workspace.previewLabel}>תצוגת טקסט מקדימה · השינויים עדיין לא נשמרו עד ללחיצה על שמירה</p><article dir="auto"><h3>{preview.title}</h3><p>{preview.summary}</p><div>{preview.body}</div></article></aside></div>;
}

function publicationActions(status: Publication["status"]): Array<{ to: Publication["status"]; label: string; primary?: boolean }> {
  switch (status) {
    case "draft": return [{ to: "under_review", label: "שליחה לבדיקה" }];
    case "under_review": return [{ to: "approved", label: "אישור לפרסום", primary: true }, { to: "draft", label: "החזרה לטיוטה" }];
    case "approved": return [{ to: "published", label: "פרסום עכשיו", primary: true }, { to: "draft", label: "החזרה לטיוטה" }];
    case "updated": return [{ to: "published", label: "פרסום העדכון", primary: true }];
    case "archived": return [{ to: "draft", label: "שחזור לטיוטה" }];
    default: return [];
  }
}

function transitionMessage(to: Publication["status"]): string {
  return ({
    draft: "הכתבה הוחזרה לטיוטה.",
    under_review: "הכתבה נשלחה לבדיקה.",
    approved: "הכתבה אושרה ומוכנה לפרסום.",
    published: "הכתבה מפורסמת.",
    updated: "הכתבה סומנה כמעודכנת.",
    archived: "הכתבה הועברה לארכיון.",
  } as const)[to];
}

function optional(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || null; }
function lines(value: FormDataEntryValue | null) { return String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }

function PublicationTrace({ publicationId }: { publicationId: string }) {
  /**
   * STATE-005. Three states, and they used to be one: the catch set `trace`
   * back to `null`, which is also the initial value, so a failed read rendered
   * "Loading traceability…" for as long as the panel stayed open. An operator
   * waiting on a spinner that will never resolve is worse off than one told
   * the read failed, because only the second one knows to reload.
   */
  const [trace, setTrace] = useState<{ kind: "loading" } | { kind: "unavailable" } | { kind: "ready"; value: Traceability }>({ kind: "loading" });
  useEffect(() => {
    /* No reset to `loading` here: `PublicationForm` carries `key={selected.id}`,
       so a different publication remounts this component rather than changing
       its prop, and a synchronous `setState` in an effect is what
       `react-hooks/set-state-in-effect` refuses. */
    let live = true;
    readConsole<Traceability>(`publications/${publicationId}/traceability`)
      .then((payload) => { if (live) setTrace({ kind: "ready", value: payload }); })
      .catch(() => { if (live) setTrace({ kind: "unavailable" }); });
    return () => { live = false; };
  }, [publicationId]);
  if (trace.kind === "loading") return <p className={styles.muted} aria-busy="true">{ABSENCE.loading("את רשומת העקיבות")}…</p>;
  if (trace.kind === "unavailable") {
    return (
      <p className={styles.error} {...assertiveLive}>
        לא ניתן לקרוא את רשומת העקיבות. זו קריאה שנכשלה, לא כתבה בלי ריצה — יש לטעון את הקונסולה מחדש
        כדי לנסות שוב.
      </p>
    );
  }
  const record = trace.value;
  return <details className={styles.traceability}><summary>{`עקיבות: ${T.run}, מודל ומקורות`}</summary>
    <p>{record.briefingRun ? `${record.briefingRun.localDate} · ${record.briefingRun.stage} · ${record.briefingRun.status} · ${record.briefingRun.id}` : "כתבה ידנית ללא ריצת מערכת."}</p>
    {record.edition ? <p>{`${T.edition} ${record.edition.id} · חוזה ${record.edition.contractVersion} · פרומפט ${record.edition.promptVersion} · ${record.edition.status}`}</p> : null}
    <ul>{record.modelRuns.map((run) => <li key={run.id}>{run.model} · {run.stage} · {formatUsd(run.costUsd)}</li>)}</ul>
    <ul>{record.claims.map((claim) => <li key={claim.id}>{claim.title} · {claim.assessment} · {claim.evidenceCount} {T.evidence} · {claim.aiRunId ?? "אין ריצת מודל"}</li>)}</ul>
    <ul>{record.sources.map((source) => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title} · {source.publisher} · {source.retrievalStatus}</li>)}</ul>
  </details>;
}

/**
 * The version history of one publication, in an end-edge drawer. Every
 * version is listed with who made it and when; the head is marked; every
 * other version offers a roll-back, which goes through the shared
 * confirmation before it lands.
 */
function VersionsDrawer({
  publication,
  onClose,
  onRollback,
  disabled,
}: {
  publication: Publication | null;
  onClose: () => void;
  onRollback: (publication: Publication, version: PublicationVersion) => void;
  disabled: boolean;
}) {
  const versions = useConsoleRead<PublicationVersion[] | { versions: PublicationVersion[] }>(
    `admin/console/publications/${publication?.id ?? "none"}/versions`,
    { enabled: publication !== null },
  );
  const rows = versions.value ? (Array.isArray(versions.value) ? versions.value : versions.value.versions) : [];
  return (
    <Dialog
      open={publication !== null}
      onClose={onClose}
      variant="drawer"
      size="wide"
      title={T.versions}
      description={publication ? publication.title : undefined}
      closeLabel="סגירת היסטוריית הגרסאות"
    >
      {publication ? (
        <>
          <InlineAbsence state={versions.state} what="היסטוריית הגרסאות" reload={versions.reload} />
          {versions.state.kind === "ready" ? (
            rows.length ? (
              <ol className={styles.versionList}>
                {rows.map((version) => (
                  <li key={version.versionId}>
                    <div>
                      <strong>{T.version} {version.versionNumber}</strong>
                      {version.isHead ? <Pill tone="gold">נוכחית</Pill> : null}
                      <small>
                        {version.actorLabel} · {formatDate(version.createdAt)}
                        {version.changeSummary ? ` · ${version.changeSummary}` : ""}
                      </small>
                    </div>
                    {!version.isHead ? (
                      <Button variant="danger" size="sm" type="button" disabled={disabled} onClick={() => onRollback(publication, version)}>
                        {T.rollback}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyLine>לא נרשמו גרסאות. הקריאה הצליחה וההיסטוריה באמת ריקה.</EmptyLine>
            )
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}
