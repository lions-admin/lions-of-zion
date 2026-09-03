"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Field } from "@/components/ui/Field";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { SelectField } from "@/components/ui/SelectField";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import { AuthRequired, refusedForAuth } from "./auth-required";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
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

type Notice = { kind: "ok" | "error"; text: string };

/* Enum values are the wire format, not operator chrome. The console reads in
   English words everywhere a status or a section is shown. */
const STATUS_LABEL: Record<Publication["status"], string> = {
  draft: "Draft",
  under_review: "In review",
  approved: "Approved",
  published: "Published",
  updated: "Updated",
  archived: "Archived",
};

const SECTION_LABEL: Record<Publication["section"], string> = {
  daily_brief: "Daily Brief",
  israel_update: "Israel Update",
  war_update: "War Update",
  narrative_watch: "Narrative Watch",
};

export function PublicationManager() {
  const [items, setItems] = useState<Publication[]>([]);
  const [features, setFeatures] = useState<Array<{ slot: number; publicationId: string }>>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Notice | null>(null);
  /**
   * STATE-005: whether the queue is empty because the read succeeded and found
   * nothing, or because the read failed. Both used to render "No publications
   * yet." — an outage telling an operator the queue is clear, which is the one
   * wrong thing to tell someone about to decide there is no work to do.
   */
  const [loadFailed, setLoadFailed] = useState(false);
  /** Refused for want of a session, which is not a fault. */
  const [authRequired, setAuthRequired] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  /* Where focus lands when the control that opened a confirmation no longer
     exists — a deleted publication takes its own action row with it. */
  const queueRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    const [publicationResponse, featureResponse] = await Promise.all([
      fetch("/api/v1/publications?limit=100&briefingOnly=true", { cache: "no-store" }),
      fetch("/api/v1/admin/homepage-features", { cache: "no-store" }),
    ]);
    /* Same distinction as the status console above: a refused read and a
       broken one need different first moves from the operator. */
    if (refusedForAuth([publicationResponse, featureResponse])) throw new AuthRequired();
    if (!publicationResponse.ok || !featureResponse.ok) throw new Error("Unable to load publications.");
    const publicationPayload = await publicationResponse.json() as { publications: Publication[] };
    const featurePayload = await featureResponse.json() as { features: Array<{ slot: number; publicationId: string }> };
    setItems(publicationPayload.publications); setFeatures(featurePayload.features);
    setSelectedId((current) => current || publicationPayload.publications[0]?.id || "");
    setLoadFailed(false);
    setAuthRequired(false);
  }, []);
  const fail = useCallback((cause: Error) => {
    if (cause instanceof AuthRequired) { setAuthRequired(true); return; }
    setLoadFailed(true);
    setMessage({ kind: "error", text: cause.message });
  }, []);

  const reload = useCallback(() => {
    setMessage(null);
    setAuthRequired(false);
    void load().catch(fail);
  }, [load, fail]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch(fail);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, fail]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const eligible = items.filter((item) =>
    (item.status === "published" || item.status === "updated")
    && item.briefingRunId !== null
    && item.section !== "daily_brief",
  );

  return (
    <section className={styles.section} id="console-queue" aria-labelledby="console-queue-heading">
      <div className={styles.panelHead}>
        <div>
          <p className={styles.sectionLabel}>Publication queue</p>
          <h2 id="console-queue-heading">Review, place, and edit publications</h2>
        </div>
        <p className={styles.headNote}>{items.length} in the queue · {eligible.length} eligible for the homepage</p>
      </div>
      {/* A11Y-007 — the console's one notice line is the validation summary
          for every form below it: a save that the API refuses is reported
          here, not on the field it came from. The ids let the editor form and
          the placement selects point at it with `aria-describedby`, so an
          operator who is inside the form when it fails is told why without
          having to go looking for a paragraph above the panel. */}
      {message?.kind === "error" ? <p id="console-error" className={styles.error} {...assertiveLive}>{message.text}</p> : null}
      {message?.kind === "ok" ? <p id="console-notice" className={styles.notice} {...politeLive}>{message.text}</p> : null}

      <div className={styles.panel}>
        <p className={styles.sectionLabel}>Homepage placement</p>
        <p className={styles.muted}>Three lead slots. An empty slot falls back to automatic selection. Only published briefing articles outside the Daily Brief are eligible.</p>
        <div className={styles.featureSlots}>
          {[1, 2, 3].map((slot) => (
            <SelectField
              key={slot}
              className={styles.editorField}
              label={`Lead headline ${slot}`}
              value={features.find((feature) => feature.slot === slot)?.publicationId ?? ""}
              onChange={(event) => setSlot(slot, event.target.value || null)}
              disabled={busy}
            >
              <option value="">Automatic selection</option>
              {eligible.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </SelectField>
          ))}
        </div>
      </div>

      <div className={styles.editorLayout}>
        <aside
          className={styles.draftQueue}
          ref={queueRef}
          tabIndex={-1}
          aria-label="Publications, newest first"
        >
          {items.length === 0 && authRequired ? (
            <StatusState
              status={absenceStatus("auth-required")}
              eyebrow="SESSION"
              title="Sign in to see the queue"
              description="The queue exists and is unchanged; this session is not signed in, so the API refuses to serve it."
              actionText="Go to sign-in"
              actionHref="/admin/login"
            />
          ) : null}
          {items.length === 0 && loadFailed ? (
            <StatusState
              status={absenceStatus("unavailable")}
              eyebrow="QUEUE STATUS"
              title="The queue could not be read"
              description="This is a failed read, not an empty queue. Nothing has been deleted; retry the read before concluding there is no work waiting."
              actionText="Try again"
              onAction={reload}
            />
          ) : null}
          {items.length === 0 && !loadFailed && !authRequired ? (
            <p className={styles.queueEmpty}>No publications yet. The read succeeded and the queue is genuinely empty.</p>
          ) : null}
          {items.map((item) => (
            <Button
              type="button"
              key={item.id}
              variant="ghost"
              size="md"
              isActive={item.id === selectedId}
              className={item.id === selectedId ? `${styles.queueItem} ${styles.selectedDraft}` : styles.queueItem}
              onClick={() => setSelectedId(item.id)}
            >
              <span>{STATUS_LABEL[item.status]}</span>
              <strong>{item.title}</strong>
              <small>{SECTION_LABEL[item.section]}</small>
            </Button>
          ))}
        </aside>
        {selected
          ? <PublicationForm
              key={selected.id}
              publication={selected}
              noticeId={message?.kind === "error" ? "console-error" : message?.kind === "ok" ? "console-notice" : undefined}
              busy={busy}
              onSave={save}
              onTransition={requestTransition}
              onArchive={requestArchive}
              onDelete={requestDelete}
            />
          : <p className={styles.muted}>Select a publication to edit it.</p>}
      </div>

      <ConfirmDialog
        intent={confirmIntent}
        onClose={() => setConfirmIntent(null)}
        fallbackFocusRef={queueRef}
      />
    </section>
  );

  function targetDetail(publication: Publication) {
    return `${publication.publicId} · ${SECTION_LABEL[publication.section]} · ${STATUS_LABEL[publication.status]}`;
  }

  /* The three confirmation requests. Each one names the action, the exact
     publication, and what the operator cannot take back. */
  function requestArchive(publication: Publication) {
    setConfirmIntent({
      action: "Remove this publication from the site and archive it",
      target: publication.title,
      targetDetail: targetDetail(publication),
      consequence: "The article stops being served on public pages and in search results as soon as the change lands. An archived publication can be restored to draft from this queue.",
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
      if (!response.ok) throw new Error("Saving the publication failed.");
      await load(); setMessage({ kind: "ok", text: "Publication saved." });
    } catch (cause) { setMessage({ kind: "error", text: cause instanceof Error ? cause.message : "The operation failed." }); } finally { setBusy(false); }
  }
  async function archive(id: string) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/publications/${id}/transition`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: "archived" }) });
      if (!response.ok) throw new Error("Archiving failed.");
      await load(); setMessage({ kind: "ok", text: "The publication was removed from the site and archived." });
    } catch (cause) { setMessage({ kind: "error", text: cause instanceof Error ? cause.message : "The operation failed." }); } finally { setBusy(false); }
  }
  async function transition(id: string, to: Publication["status"]) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/publications/${id}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
      });
      if (!response.ok) throw new Error("Updating publication status failed.");
      await load();
      setMessage({ kind: "ok", text: transitionMessage(to) });
    } catch (cause) { setMessage({ kind: "error", text: cause instanceof Error ? cause.message : "The operation failed." }); } finally { setBusy(false); }
  }
  async function setSlot(slot: number, publicationId: string | null) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/homepage-features", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ slot, publicationId }) });
      if (!response.ok) throw new Error("Updating the lead headline failed.");
      await load(); setMessage({ kind: "ok", text: "Homepage placement updated." });
    } catch (cause) { setMessage({ kind: "error", text: cause instanceof Error ? cause.message : "The operation failed." }); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/publications/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Deleting the publication failed.");
      /* `load()` only fills the selection when it is empty, so without this
         the id of the row just deleted stays selected: the queue reloads with
         work still in it while the editor beside it says "Select a
         publication to edit it." Clearing first lets the reload land on the
         first remaining row. */
      setSelectedId("");
      await load(); setMessage({ kind: "ok", text: "Publication deleted. Evidence and review history were kept." });
    } catch (cause) { setMessage({ kind: "error", text: cause instanceof Error ? cause.message : "The operation failed." }); } finally { setBusy(false); }
  }
}

function PublicationForm({ publication, busy, noticeId, onSave, onTransition, onArchive, onDelete }: { publication: Publication; busy: boolean; noticeId?: string; onSave: (id: string, form: HTMLFormElement) => void; onTransition: (publication: Publication, to: Publication["status"]) => void; onArchive: (publication: Publication) => void; onDelete: (publication: Publication) => void }) {
  const canArchive = publication.status !== "archived";
  const canDelete = publication.status === "archived" || publication.status === "draft";

  /* A11Y-007: the form's result is reported in the console notice above the
     panel, so the form is described by it. `aria-busy` states the pending save
     on the element that is actually pending. */
  return <form className={styles.editorForm} id="console-editor" aria-label={`Editing ${publication.title}`} aria-describedby={noticeId} aria-busy={busy || undefined} onSubmit={(event) => { event.preventDefault(); onSave(publication.id, event.currentTarget); }}>
    <div className={styles.editorStatus}>
      <span>{STATUS_LABEL[publication.status]} · {SECTION_LABEL[publication.section]}</span>
      <span>{publication.publicId}</span>
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

type Traceability = {
  briefingRun: { id: string; localDate: string; stage: string; status: string } | null;
  edition: { id: string; contractVersion: string; promptVersion: string; status: string } | null;
  modelRuns: Array<{ id: string; model: string; profile: string; stage: string; costUsd: number }>;
  claims: Array<{ id: string; title: string; assessment: string; aiRunId: string | null; evidenceCount: number }>;
  sources: Array<{ id: string; title: string; publisher: string; url: string | null; retrievalStatus: string }>;
};

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
    fetch(`/api/v1/publications/${publicationId}/traceability`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("trace unavailable")))
      .then((payload: Traceability) => { if (live) setTrace({ kind: "ready", value: payload }); })
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
    <ul>{record.modelRuns.map((run) => <li key={run.id}>{run.model} · {run.stage} · ${run.costUsd.toFixed(4)}</li>)}</ul>
    <ul>{record.claims.map((claim) => <li key={claim.id}>{claim.title} · {claim.assessment} · {claim.evidenceCount} evidence · {claim.aiRunId ?? "no model run"}</li>)}</ul>
    <ul>{record.sources.map((source) => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title} · {source.publisher} · {source.retrievalStatus}</li>)}</ul>
  </details>;
}
