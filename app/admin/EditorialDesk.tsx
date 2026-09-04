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
  SECTION_LABEL,
  STATUS_LABEL,
  formatDate,
  formatUsd,
  publicationTone,
  useOperations,
} from "./console-primitives";
import { NarrativesPanel } from "./NarrativesPanel";
import { callConsole, readConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

type Lane = keyof ConsoleEditorial["lanes"];

const LANES: Array<{ key: Lane; title: string; statuses: PublicationStatus[] }> = [
  { key: "drafts", title: "New drafts", statuses: ["draft"] },
  { key: "inReview", title: "In review", statuses: ["under_review"] },
  { key: "ready", title: "Ready to publish", statuses: ["approved"] },
  { key: "published", title: "Published", statuses: ["published", "updated"] },
  { key: "archived", title: "Archived", statuses: ["archived"] },
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
        /* The editor shows "select a publication" and the operator can retry
           by selecting again; the lane card is still there. */
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
        label="Editorial desk"
        title="Review, place, and edit publications"
        note={editorial.value ? `${Object.values(editorial.value.counts).reduce((sum, count) => sum + count, 0)} on the desk · ${eligible.length} eligible for the homepage` : `${publications.length} in the list · ${eligible.length} eligible for the homepage`}
      />
      {/* A11Y-007 — the desk's one notice line is the validation summary for
          every form below it: a save that the API refuses is reported here,
          not on the field it came from. The ids let the editor form and the
          placement selects point at it with `aria-describedby`. */}
      <ConsoleNotices busy={ops.busy} notice={ops.notice} idPrefix="console-editorial" />

      <InlineAbsence state={editorial.state} what="the editorial summary" reload={editorial.reload} />
      {editorial.state.kind === "unavailable" ? (
        <p className={styles.muted}>The lanes below are built from the publications list instead; evidence counts are not shown.</p>
      ) : null}

      {/* ── Lanes ─────────────────────────────────────────────────────── */}
      {list.state.kind === "loading" && editorial.state.kind === "loading" ? (
        <div className={styles.laneSkeleton} role="status" aria-busy="true">
          <span className={styles.consolePending}>Loading the editorial desk</span>
          {LANES.map((lane) => (
            <Skeleton key={lane.key} shape="block" height="18rem" />
          ))}
        </div>
      ) : list.state.kind === "auth-required" ? (
        <StatusState
          status={absenceStatus("auth-required")}
          eyebrow="SESSION"
          title="Sign in to see the desk"
          description="The desk exists and is unchanged; this session is not signed in, so the API refuses to serve it."
          actionText="Go to sign-in"
          actionHref="/admin/login"
        />
      ) : list.state.kind === "failed" || list.state.kind === "unavailable" ? (
        <StatusState
          status={absenceStatus("unavailable")}
          eyebrow="DESK STATUS"
          title="The desk could not be read"
          description="This is a failed read, not an empty desk. Nothing has been deleted; retry the read before concluding there is no work waiting."
          actionText="Try again"
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
                  <p className={styles.queueEmpty}>Nothing here. The read succeeded and the lane is genuinely empty.</p>
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
                        {card.status === "updated" ? " · updated" : ""}
                      </span>
                      <small>
                        {card.evidenceCount === null ? "evidence —" : `${card.evidenceCount} evidence`}
                        {card.homepageSlot ? ` · homepage ${card.homepageSlot}` : ""}
                        {card.featuredIsraelStory ? " · featured" : ""}
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
        <PanelTitle>Homepage placement</PanelTitle>
        <p className={styles.muted}>Three lead slots. An empty slot falls back to automatic selection. Only published briefing articles outside the Daily Brief are eligible.</p>
        <div className={styles.featureSlots}>
          {[1, 2, 3].map((slot) => (
            <SelectField
              key={slot}
              className={styles.editorField}
              label={`Lead headline ${slot}`}
              value={features.find((feature) => feature.slot === slot)?.publicationId ?? ""}
              onChange={(event) => setSlot(slot, event.target.value || null)}
              disabled={ops.disabled}
              aria-describedby={noticeId}
            >
              <option value="">Automatic selection</option>
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
          Reading the publication…
        </p>
      ) : (
        <p className={styles.muted}>Select a card to edit it.</p>
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
      action: "Remove this publication from the site and archive it",
      target: publication.title,
      targetDetail: targetDetail(publication),
      consequence: "The article stops being served on public pages and in search results as soon as the change lands. An archived publication can be restored to draft from this desk.",
      confirmLabel: "Remove and archive",
      tone: "danger",
      run: () => archive(publication.id),
    });
  }

  function requestDelete(publication: Publication) {
    setConfirmIntent({
      action: "Delete this publication permanently",
      target: publication.title,
      targetDetail: targetDetail(publication),
      consequence: "The publication and its version history are deleted and cannot be restored from this console. Linked evidence and the review record are kept.",
      confirmLabel: "Delete permanently",
      tone: "danger",
      run: () => remove(publication.id),
    });
  }

  function requestTransition(publication: Publication, to: Publication["status"]) {
    /* Publication is the one workflow step that reaches the public, so it is
       the one that asks. The rest move between internal states. */
    if (to !== "published") { void transition(publication.id, to); return; }
    setConfirmIntent({
      action: publication.status === "updated" ? "Publish this update now" : "Publish this article now",
      target: publication.title,
      targetDetail: targetDetail(publication),
      consequence: "The article becomes readable on public pages and available to search engines immediately. Taking it down again means archiving it, which readers may already have seen.",
      confirmLabel: publication.status === "updated" ? "Publish update" : "Publish now",
      tone: "primary",
      run: () => transition(publication.id, to),
    });
  }

  function requestRollback(publication: Publication, version: PublicationVersion) {
    setConfirmIntent({
      action: `Roll this publication back to version ${version.versionNumber}`,
      target: publication.title,
      targetDetail: `${targetDetail(publication)} · version ${version.versionNumber} by ${version.actorLabel}, ${formatDate(version.createdAt)}`,
      consequence: "The head of the publication is replaced by that version's content as a new version. If the publication is live, readers see the rolled-back text as soon as the change lands. Nothing is deleted: every version stays in the history.",
      confirmLabel: "Roll back",
      tone: "danger",
      run: () => rollback(publication, version),
    });
  }

  async function rollback(publication: Publication, version: PublicationVersion) {
    await ops.run("rollback", async () => {
      await callConsole(`admin/console/publications/${publication.id}/rollback`, {
        method: "POST",
        body: { versionId: version.versionId },
        failure: "Rolling the publication back failed.",
      });
      setVersionsFor(null);
      reloadAll();
      return `Rolled back to version ${version.versionNumber}. The change is recorded as a new version.`;
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
      featuredIsraelStory: data.get("featuredIsraelStory") === "on", changeSummary: "Administrator editorial update",
      ...(narrativeWatchDetails ? { narrativeWatchDetails } : {}),
    };
    await ops.run("save", async () => {
      await callConsole(`publications/${id}`, { method: "PATCH", body, failure: "Saving the publication failed." });
      reloadAll();
      return "Publication saved.";
    });
  }

  async function archive(id: string) {
    await ops.run("archive", async () => {
      await callConsole(`publications/${id}/transition`, { method: "POST", body: { to: "archived" }, failure: "Archiving failed." });
      reloadAll();
      return "The publication was removed from the site and archived.";
    });
  }

  async function transition(id: string, to: Publication["status"]) {
    await ops.run("transition", async () => {
      await callConsole(`publications/${id}/transition`, { method: "POST", body: { to }, failure: "Updating publication status failed." });
      reloadAll();
      return transitionMessage(to);
    });
  }

  async function setSlot(slot: number, publicationId: string | null) {
    await ops.run("slot", async () => {
      await callConsole("admin/homepage-features", { method: "PUT", body: { slot, publicationId }, failure: "Updating the lead headline failed." });
      reloadAll();
      return "Homepage placement updated.";
    });
  }

  async function remove(id: string) {
    await ops.run("delete", async () => {
      await callConsole(`publications/${id}`, { method: "DELETE", failure: "Deleting the publication failed." });
      /* Clear the selection first so the reload does not leave the id of the
         row just deleted selected, with the editor saying "select a card"
         beside lanes that still hold work. */
      setSelectedId("");
      reloadAll();
      return "Publication deleted. Evidence and review history were kept.";
    });
  }
}

function PublicationForm({ publication, busy, noticeId, onSave, onTransition, onArchive, onDelete, onVersions }: { publication: Publication; busy: boolean; noticeId?: string; onSave: (id: string, form: HTMLFormElement) => void; onTransition: (publication: Publication, to: Publication["status"]) => void; onArchive: (publication: Publication) => void; onDelete: (publication: Publication) => void; onVersions: () => void }) {
  const canArchive = publication.status !== "archived";
  const canDelete = publication.status === "archived" || publication.status === "draft";

  /* A11Y-007: the form's result is reported in the desk notice above the
     panel, so the form is described by it. `aria-busy` states the pending
     save on the element that is actually pending. */
  return <form className={styles.editorForm} id="console-editor" aria-label={`Editing ${publication.title}`} aria-describedby={noticeId} aria-busy={busy || undefined} onSubmit={(event) => { event.preventDefault(); onSave(publication.id, event.currentTarget); }}>
    <div className={styles.editorStatus}>
      <span>
        <Pill tone={publicationTone(publication.status)}>{STATUS_LABEL[publication.status]}</Pill> · {SECTION_LABEL[publication.section]}
      </span>
      <span>{publication.publicId}</span>
    </div>
    <div className={styles.actionRow}>
      <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={onVersions}>
        Versions
      </Button>
    </div>
    <Field className={styles.editorField} name="title" label="Title" defaultValue={publication.title} required />
    <Field className={styles.editorField} name="summary" label="Summary" defaultValue={publication.summary ?? ""} multiline rows={4} />
    <Field className={styles.editorField} name="body" label="Article body" defaultValue={publication.body} multiline rows={18} required />
    <div className={styles.formGrid}>
      <SelectField className={styles.editorField} name="section" label="Section" defaultValue={publication.section}>
        {publication.section === "narrative_watch"
          ? <option value="narrative_watch">Narrative Watch</option>
          : <>
            <option value="daily_brief">Daily Brief</option>
            <option value="israel_update">Israel Update</option>
            <option value="war_update">War Update</option>
          </>}
      </SelectField>
      <Field className={styles.editorField} name="editorialTopic" label="Topic" defaultValue={publication.editorialTopic ?? ""} />
      <Field className={styles.editorField} name="primaryActor" label="Primary actor" defaultValue={publication.primaryActor ?? ""} />
      <Field className={styles.editorField} name="arena" label="Arena" defaultValue={publication.arena ?? ""} />
    </div>
    {publication.narrativeWatchDetails ? <FieldGroup legend="Narrative Watch details" className={styles.narrativeFields}>
      {/* Read-only on purpose: the basis is derived from whether the article
          cites anything, never chosen. A form control here would let an editor
          relabel a sourced piece as analysis — or, worse, strip the disclosure
          off an unsourced one — with no change to the evidence underneath. */}
      <div className={styles.editorStatus}>
        <span>Evidence basis</span>
        <span>{publication.narrativeWatchDetails.evidenceBasis === "analysis" ? "Analysis · no source cited" : "Sourced"}</span>
      </div>
      <p className={styles.muted}>Evidence basis is derived from whether the article cites evidence and cannot be chosen on this form. To change it, change the evidence linked to the article.</p>
      <Field className={styles.editorField} name="exactClaim" label="Exact claim" defaultValue={publication.narrativeWatchDetails.exactClaim} multiline rows={4} required />
      <div className={styles.formGrid}>
        <Field className={styles.editorField} name="propagators" label="Propagators — one per line" defaultValue={publication.narrativeWatchDetails.propagators.join("\n")} multiline rows={4} />
        <Field className={styles.editorField} name="narrativeArenas" label="Arenas — one per line" defaultValue={publication.narrativeWatchDetails.arenas.join("\n")} multiline rows={4} required />
        <SelectField className={styles.editorField} name="trendDirection" label="Trend" defaultValue={publication.narrativeWatchDetails.trendDirection}>
          <option value="new">New</option>
          <option value="rising">Rising</option>
          <option value="stable">Stable</option>
          <option value="declining">Declining</option>
          <option value="unclear">Unclear</option>
        </SelectField>
        <Field className={styles.editorField} name="knownUnknowns" label="Known unknowns — one per line" defaultValue={publication.narrativeWatchDetails.knownUnknowns.join("\n")} multiline rows={4} />
      </div>
      <Field className={styles.editorField} name="israeliPosition" label="Israeli position" defaultValue={publication.narrativeWatchDetails.israeliPosition ?? ""} multiline rows={5} />
      <Field className={styles.editorField} name="securityContext" label="Security context" defaultValue={publication.narrativeWatchDetails.securityContext ?? ""} multiline rows={5} />
    </FieldGroup> : null}
    <CheckboxField
      className={styles.editorField}
      name="featuredIsraelStory"
      label="Featured daily Israel story"
      defaultChecked={publication.featuredIsraelStory}
    />
    <PublicationTrace publicationId={publication.id} />
    <div className={styles.actionRow}>
      <Button variant="primary" type="submit" disabled={busy}>Save changes</Button>
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
        <p className={styles.dangerLabel}>Irreversible actions</p>
        <p className={styles.muted}>Each one names its target and its consequence before it runs.</p>
        <div className={styles.actionRow}>
          {canArchive ? (
            <Button variant="danger" type="button" disabled={busy} onClick={() => onArchive(publication)}>
              Remove from site and archive
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="danger" type="button" disabled={busy} onClick={() => onDelete(publication)}>
              Delete permanently
            </Button>
          ) : null}
        </div>
      </div>
    ) : null}
  </form>;
}

function publicationActions(status: Publication["status"]): Array<{ to: Publication["status"]; label: string; primary?: boolean }> {
  switch (status) {
    case "draft": return [{ to: "under_review", label: "Send to review" }];
    case "under_review": return [{ to: "approved", label: "Approve for publication", primary: true }, { to: "draft", label: "Return to draft" }];
    case "approved": return [{ to: "published", label: "Publish now", primary: true }, { to: "draft", label: "Return to draft" }];
    case "updated": return [{ to: "published", label: "Publish update", primary: true }];
    case "archived": return [{ to: "draft", label: "Restore to draft" }];
    default: return [];
  }
}

function transitionMessage(to: Publication["status"]): string {
  return ({
    draft: "Publication returned to draft.",
    under_review: "Publication sent to review.",
    approved: "Publication approved and ready to publish.",
    published: "Publication is live.",
    updated: "Publication marked as updated.",
    archived: "Publication archived.",
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
  if (trace.kind === "loading") return <p className={styles.muted} aria-busy="true">Loading traceability…</p>;
  if (trace.kind === "unavailable") {
    return (
      <p className={styles.error} {...assertiveLive}>
        The traceability record could not be read. This is a failed read, not an article without a
        run — reload the console to try again.
      </p>
    );
  }
  const record = trace.value;
  return <details className={styles.traceability}><summary>Traceability: run, model, and sources</summary>
    <p>{record.briefingRun ? `${record.briefingRun.localDate} · ${record.briefingRun.stage} · ${record.briefingRun.status} · ${record.briefingRun.id}` : "Manual publication with no system run."}</p>
    {record.edition ? <p>{`Edition ${record.edition.id} · contract ${record.edition.contractVersion} · prompt ${record.edition.promptVersion} · ${record.edition.status}`}</p> : null}
    <ul>{record.modelRuns.map((run) => <li key={run.id}>{run.model} · {run.stage} · {formatUsd(run.costUsd)}</li>)}</ul>
    <ul>{record.claims.map((claim) => <li key={claim.id}>{claim.title} · {claim.assessment} · {claim.evidenceCount} evidence · {claim.aiRunId ?? "no model run"}</li>)}</ul>
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
      title="Versions"
      description={publication ? publication.title : undefined}
      closeLabel="Close the version history"
    >
      {publication ? (
        <>
          <InlineAbsence state={versions.state} what="the version history" reload={versions.reload} />
          {versions.state.kind === "ready" ? (
            rows.length ? (
              <ol className={styles.versionList}>
                {rows.map((version) => (
                  <li key={version.versionId}>
                    <div>
                      <strong>Version {version.versionNumber}</strong>
                      {version.isHead ? <Pill tone="gold">head</Pill> : null}
                      <small>
                        {version.actorLabel} · {formatDate(version.createdAt)}
                        {version.changeSummary ? ` · ${version.changeSummary}` : ""}
                      </small>
                    </div>
                    {!version.isHead ? (
                      <Button variant="danger" size="sm" type="button" disabled={disabled} onClick={() => onRollback(publication, version)}>
                        Roll back
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyLine>No versions recorded. The read succeeded and the history is genuinely empty.</EmptyLine>
            )
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}
