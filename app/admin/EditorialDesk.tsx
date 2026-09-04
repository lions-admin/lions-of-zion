"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { SelectField } from "@/components/ui/SelectField";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";
import { assertiveLive } from "@/components/ui/live-region";
import type { ConsoleEditorial, EditorialCard, PublicationVersion } from "@/server/contracts/admin-console";
import type { PublicationStatus } from "@/server/contracts/enums";
import type { Publication, Traceability } from "./briefing-shapes";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import {
  AreaHead,
  ConsoleNotices,
  EmptyLine,
  InlineAbsence,
  PanelTitle,
  Pill,
  formatDate,
  formatUsd,
  publicationTone,
  useOperations,
} from "./console-primitives";
import { ABSENCE, AREA_LABEL, SECTION_LABEL, STATUS_LABEL, T, TREND_LABEL } from "./lexicon";
import { NarrativesPanel } from "./NarrativesPanel";
import { callConsole, readConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

type Lane = keyof ConsoleEditorial["lanes"];

const LANES: Array<{ key: Lane; title: string; statuses: PublicationStatus[] }> = [
  { key: "drafts", title: "טיוטות חדשות", statuses: ["draft"] },
  { key: "inReview", title: STATUS_LABEL.under_review, statuses: ["under_review"] },
  { key: "ready", title: "מוכנות לפרסום", statuses: ["approved"] },
  { key: "published", title: "פורסמו", statuses: ["published", "updated"] },
  { key: "archived", title: STATUS_LABEL.archived, statuses: ["archived"] },
];

/** A lane card, from the editorial read when it is served, or built from the
 *  publications list when it is not — evidence count unknown in that case. */
type LaneCard = Omit<EditorialCard, "evidenceCount" | "briefingRunId" | "createdAt" | "summary"> & { evidenceCount: number | null };

function cardFromPublication(publication: Publication, features: Array<{ slot: number; publicationId: string }>): LaneCard {
  return {
    id: publication.id,
    publicId: publication.publicId,
    title: publication.title,
    section: publication.section,
    status: publication.status,
    featuredIsraelStory: publication.featuredIsraelStory,
    homepageSlot: features.find((feature) => feature.publicationId === publication.id)?.slot ?? null,
    evidenceCount: null,
    updatedAt: publication.createdAt,
    publishedAt: null,
  };
}

/**
 * Editorial desk — five lanes from draft to archive, and the editor.
 *
 * The lanes come from `console/editorial`; when that route is not served the
 * desk builds them from the publications list it has always read, so the
 * editor never disappears with the summary. Selecting a card opens the
 * editor beside the lanes — the same form the publication queue had, moved
 * here rather than rewritten — with a Versions drawer and a roll-back that
 * goes through the shared confirmation like every other irreversible act.
 */
export function EditorialDesk({ signal }: { signal: number }) {
  const editorial = useConsoleRead<ConsoleEditorial>("admin/console/editorial", { signal });
  const list = useConsoleRead<{ publications: Publication[] }>("publications?limit=100&briefingOnly=true", { signal });
  const featureRead = useConsoleRead<{ features: Array<{ slot: number; publicationId: string }> }>("admin/homepage-features", { signal });
  const [selectedId, setSelectedId] = useState<string>("");
  /* A card that is in a lane but outside the list's window is read on its
     own; this holds it. */
  const [fetched, setFetched] = useState<Publication | null>(null);
  const [versionsFor, setVersionsFor] = useState<Publication | null>(null);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  /* Where focus lands when the control that opened a confirmation no longer
     exists — a deleted publication takes its own action row with it. */
  const deskRef = useRef<HTMLElement | null>(null);
  const ops = useOperations();

  const publications = useMemo(() => list.value?.publications ?? [], [list.value]);
  const features = useMemo(() => featureRead.value?.features ?? editorial.value?.homepageFeatures ?? [], [featureRead.value, editorial.value]);

  const lanes = useMemo<Record<Lane, LaneCard[]>>(() => {
    if (editorial.value) {
      const value = editorial.value;
      return {
        drafts: value.lanes.drafts,
        inReview: value.lanes.inReview,
        ready: value.lanes.ready,
        published: value.lanes.published,
        archived: value.lanes.archived,
      };
    }
    const built: Record<Lane, LaneCard[]> = { drafts: [], inReview: [], ready: [], published: [], archived: [] };
    for (const publication of publications) {
      const lane = LANES.find((entry) => entry.statuses.includes(publication.status));
      if (lane) built[lane.key].push(cardFromPublication(publication, features));
    }
    return built;
  }, [editorial.value, publications, features]);

  const selected = useMemo<Publication | null>(() => {
    if (!selectedId) return null;
    return publications.find((item) => item.id === selectedId) ?? (fetched?.id === selectedId ? fetched : null);
  }, [publications, selectedId, fetched]);

  /* A selected card outside the list window is read on its own. The list is
     the source of truth once it holds the row. */
  useEffect(() => {
    if (!selectedId || publications.some((item) => item.id === selectedId) || fetched?.id === selectedId) return;
    let live = true;
    readConsole<Publication>(`publications/${selectedId}`)
      .then((publication) => {
        if (live) setFetched(publication);
      })
      .catch(() => {
        /* The editor falls back to asking for a selection, and the operator
           can retry by selecting again; the lane card is still there. */
      });
    return () => {
      live = false;
    };
  }, [selectedId, publications, fetched]);

  const eligible = publications.filter(
    (item) => (item.status === "published" || item.status === "updated") && item.briefingRunId !== null && item.section !== "daily_brief",
  );
  const noticeId = ops.notice?.kind === "error" ? "console-editorial-error" : ops.notice?.kind === "ok" ? "console-editorial-notice" : undefined;

  function reloadAll() {
    editorial.reload();
    list.reload();
    featureRead.reload();
    setFetched(null);
  }

  return (
    <section className={styles.area} id="console-editorial" aria-labelledby="console-editorial-heading" ref={deskRef} tabIndex={-1}>
      <AreaHead
        id="console-editorial"
        label={AREA_LABEL.editorial}
        title="בדיקה, מיקום ועריכה של כתבות"
        note={editorial.value ? `${Object.values(editorial.value.counts).reduce((sum, count) => sum + count, 0)} על השולחן · ${eligible.length} מתאימות לעמוד הבית` : `${publications.length} ברשימה · ${eligible.length} מתאימות לעמוד הבית`}
      />
      {/* A11Y-007 — the desk's one notice line is the validation summary for
          every form below it: a save that the API refuses is reported here,
          not on the field it came from. The ids let the editor form and the
          placement selects point at it with `aria-describedby`. */}
      <ConsoleNotices busy={ops.busy} notice={ops.notice} idPrefix="console-editorial" />

      <InlineAbsence state={editorial.state} what="סיכום העריכה" reload={editorial.reload} />
      {editorial.state.kind === "unavailable" ? (
        <p className={styles.muted}>התורים שלמטה נבנים מרשימת הכתבות במקום, ומספרי הראיות אינם מוצגים.</p>
      ) : null}

      {/* ── Lanes ─────────────────────────────────────────────────────── */}
      {list.state.kind === "loading" && editorial.state.kind === "loading" ? (
        <div className={styles.laneSkeleton} role="status" aria-busy="true">
          <span className={styles.consolePending}>{ABSENCE.loading(AREA_LABEL.editorial)}</span>
          {LANES.map((lane) => (
            <Skeleton key={lane.key} shape="block" height="18rem" />
          ))}
        </div>
      ) : list.state.kind === "auth-required" ? (
        <StatusState
          status={absenceStatus("auth-required")}
          eyebrow="סשן"
          title="יש להתחבר כדי לראות את תור העריכה"
          description="תור העריכה קיים ולא השתנה; הסשן הזה אינו מחובר, ולכן ה-API מסרב להגיש אותו."
          actionText={ABSENCE.authAction}
          actionHref="/admin/login"
        />
      ) : list.state.kind === "failed" || list.state.kind === "unavailable" ? (
        <StatusState
          status={absenceStatus("unavailable")}
          eyebrow="מצב תור העריכה"
          title="לא ניתן לקרוא את תור העריכה"
          description="זו קריאה שנכשלה, לא תור ריק. שום דבר לא נמחק; יש לקרוא שוב לפני שמסיקים שאין עבודה ממתינה."
          actionText={T.tryAgain}
          onAction={reloadAll}
        />
      ) : (
        <div className={styles.laneWrap}>
          <div className={styles.lanes}>
            {LANES.map((lane) => (
              <section key={lane.key} className={styles.lane} aria-labelledby={`lane-${lane.key}`}>
                <header className={styles.laneHead}>
                  <h3 id={`lane-${lane.key}`}>{lane.title}</h3>
                  <span className={styles.headNote}>{lanes[lane.key].length}</span>
                </header>
                {lanes[lane.key].length === 0 ? (
                  <p className={styles.queueEmpty}>אין כאן כלום. הקריאה הצליחה והתור באמת ריק.</p>
                ) : (
                  lanes[lane.key].map((card) => (
                    <Button
                      type="button"
                      key={card.id}
                      variant="ghost"
                      size="md"
                      isActive={card.id === selectedId}
                      className={card.id === selectedId ? `${styles.laneCard} ${styles.selectedDraft}` : styles.laneCard}
                      onClick={() => setSelectedId(card.id)}
                    >
                      <strong>{card.title}</strong>
                      <span>
                        {SECTION_LABEL[card.section]}
                        {card.status === "updated" ? ` · ${STATUS_LABEL.updated}` : ""}
                      </span>
                      <small>
                        {card.evidenceCount === null ? `${T.evidence} —` : `${card.evidenceCount} ${T.evidence}`}
                        {card.homepageSlot ? ` · עמוד הבית ${card.homepageSlot}` : ""}
                        {card.featuredIsraelStory ? " · מוצגת" : ""}
                        {` · ${formatDate(card.publishedAt ?? card.updatedAt)}`}
                      </small>
                    </Button>
                  ))
                )}
              </section>
            ))}
          </div>
        </div>
      )}

      {/* ── Homepage placement ────────────────────────────────────────── */}
      <div className={styles.panel}>
        <PanelTitle>מיקום בעמוד הבית</PanelTitle>
        <p className={styles.muted}>שלושה מקומות לכותרת מובילה. מקום ריק חוזר לבחירה אוטומטית. רק כתבות בריף שפורסמו ואינן הבריף היומי מתאימות.</p>
        <div className={styles.featureSlots}>
          {[1, 2, 3].map((slot) => (
            <SelectField
              key={slot}
              className={styles.editorField}
              label={`כותרת מובילה ${slot}`}
              value={features.find((feature) => feature.slot === slot)?.publicationId ?? ""}
              onChange={(event) => setSlot(slot, event.target.value || null)}
              disabled={ops.disabled}
              aria-describedby={noticeId}
            >
              <option value="">בחירה אוטומטית</option>
              {eligible.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </SelectField>
          ))}
        </div>
      </div>

      {/* ── The editor ────────────────────────────────────────────────── */}
      {selected ? (
        <PublicationForm
          key={selected.id}
          publication={selected}
          noticeId={noticeId}
          busy={ops.disabled}
          onSave={save}
          onTransition={requestTransition}
          onArchive={requestArchive}
          onDelete={requestDelete}
          onVersions={() => setVersionsFor(selected)}
        />
      ) : selectedId ? (
        <p className={styles.muted} aria-busy="true">
          קורא את ה{T.publication}…
        </p>
      ) : (
        <p className={styles.muted}>יש לבחור כרטיס כדי לערוך אותו.</p>
      )}

      <NarrativesPanel signal={signal} />

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
      setSelectedId("");
      reloadAll();
      return "הכתבה נמחקה. הראיות והיסטוריית הבדיקה נשמרו.";
    });
  }
}

function PublicationForm({ publication, busy, noticeId, onSave, onTransition, onArchive, onDelete, onVersions }: { publication: Publication; busy: boolean; noticeId?: string; onSave: (id: string, form: HTMLFormElement) => void; onTransition: (publication: Publication, to: Publication["status"]) => void; onArchive: (publication: Publication) => void; onDelete: (publication: Publication) => void; onVersions: () => void }) {
  const canArchive = publication.status !== "archived";
  const canDelete = publication.status === "archived" || publication.status === "draft";

  /* A11Y-007: the form's result is reported in the desk notice above the
     panel, so the form is described by it. `aria-busy` states the pending
     save on the element that is actually pending. */
  return <form className={styles.editorForm} id="console-editor" aria-label={`עריכת ${publication.title}`} aria-describedby={noticeId} aria-busy={busy || undefined} onSubmit={(event) => { event.preventDefault(); onSave(publication.id, event.currentTarget); }}>
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
    <Field className={styles.editorField} name="title" label="כותרת" defaultValue={publication.title} required />
    <Field className={styles.editorField} name="summary" label="תקציר" defaultValue={publication.summary ?? ""} multiline rows={4} />
    <Field className={styles.editorField} name="body" label="גוף הכתבה" defaultValue={publication.body} multiline rows={18} required />
    <div className={styles.formGrid}>
      <SelectField className={styles.editorField} name="section" label="מדור" defaultValue={publication.section}>
        {publication.section === "narrative_watch"
          ? <option value="narrative_watch">{SECTION_LABEL.narrative_watch}</option>
          : <>
            <option value="daily_brief">{SECTION_LABEL.daily_brief}</option>
            <option value="israel_update">{SECTION_LABEL.israel_update}</option>
            <option value="war_update">{SECTION_LABEL.war_update}</option>
          </>}
      </SelectField>
      <Field className={styles.editorField} name="editorialTopic" label="נושא" defaultValue={publication.editorialTopic ?? ""} />
      <Field className={styles.editorField} name="primaryActor" label="שחקן מרכזי" defaultValue={publication.primaryActor ?? ""} />
      <Field className={styles.editorField} name="arena" label="זירה" defaultValue={publication.arena ?? ""} />
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
      <Field className={styles.editorField} name="exactClaim" label="הטענה המדויקת" defaultValue={publication.narrativeWatchDetails.exactClaim} multiline rows={4} required />
      <div className={styles.formGrid}>
        <Field className={styles.editorField} name="propagators" label="מפיצים — אחד בכל שורה" defaultValue={publication.narrativeWatchDetails.propagators.join("\n")} multiline rows={4} />
        <Field className={styles.editorField} name="narrativeArenas" label="זירות — אחת בכל שורה" defaultValue={publication.narrativeWatchDetails.arenas.join("\n")} multiline rows={4} required />
        <SelectField className={styles.editorField} name="trendDirection" label="מגמה" defaultValue={publication.narrativeWatchDetails.trendDirection}>
          <option value="new">{TREND_LABEL.new}</option>
          <option value="rising">{TREND_LABEL.rising}</option>
          <option value="stable">{TREND_LABEL.stable}</option>
          <option value="declining">{TREND_LABEL.declining}</option>
          <option value="unclear">לא ברור</option>
        </SelectField>
        <Field className={styles.editorField} name="knownUnknowns" label="נעלמים ידועים — אחד בכל שורה" defaultValue={publication.narrativeWatchDetails.knownUnknowns.join("\n")} multiline rows={4} />
      </div>
      <Field className={styles.editorField} name="israeliPosition" label="העמדה הישראלית" defaultValue={publication.narrativeWatchDetails.israeliPosition ?? ""} multiline rows={5} />
      <Field className={styles.editorField} name="securityContext" label="הקשר ביטחוני" defaultValue={publication.narrativeWatchDetails.securityContext ?? ""} multiline rows={5} />
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
  </form>;
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
