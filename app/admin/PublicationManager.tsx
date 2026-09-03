"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField } from "@/components/ui/CheckboxField";
import { Field } from "@/components/ui/Field";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { SelectField } from "@/components/ui/SelectField";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
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

export function PublicationManager() {
  const [items, setItems] = useState<Publication[]>([]);
  const [features, setFeatures] = useState<Array<{ slot: number; publicationId: string }>>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    const [publicationResponse, featureResponse] = await Promise.all([
      fetch("/api/v1/publications?limit=100&briefingOnly=true", { cache: "no-store" }),
      fetch("/api/v1/admin/homepage-features", { cache: "no-store" }),
    ]);
    if (!publicationResponse.ok || !featureResponse.ok) throw new Error("Unable to load publications.");
    const publicationPayload = await publicationResponse.json() as { publications: Publication[] };
    const featurePayload = await featureResponse.json() as { features: Array<{ slot: number; publicationId: string }> };
    setItems(publicationPayload.publications); setFeatures(featurePayload.features);
    setSelectedId((current) => current || publicationPayload.publications[0]?.id || "");
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((cause: Error) => setMessage({ kind: "error", text: cause.message })); }, 0);
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
      <div className={styles.panelHead}>
        <div>
          <p className={styles.sectionLabel}>Editorial</p>
          <h2>Edit and place publications</h2>
        </div>
      </div>
      {message?.kind === "error" ? <p className={styles.error} {...assertiveLive}>{message.text}</p> : null}
      {message?.kind === "ok" ? <p className={styles.notice} {...politeLive}>{message.text}</p> : null}
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
      <div className={styles.editorLayout}>
        <aside className={styles.draftQueue} aria-label="Publication list">
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
              <span>{item.status}</span>
              <strong>{item.title}</strong>
              <small>{item.section}</small>
            </Button>
          ))}
        </aside>
        {selected
          ? <PublicationForm key={selected.id} publication={selected} busy={busy} onSave={save} onTransition={transition} onArchive={archive} onDelete={remove} />
          : <p className={styles.muted}>No publications to edit.</p>}
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
    if (to === "published" && !window.confirm("Publish this article now? After publication it will appear on public pages and in search engines.")) return;
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
    if (!window.confirm("Permanently delete this publication? Evidence and review history will be kept.")) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/v1/publications/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Deleting the publication failed.");
      await load(); setMessage({ kind: "ok", text: "Publication deleted. Evidence and review history were kept." });
    } catch (cause) { setMessage({ kind: "error", text: cause instanceof Error ? cause.message : "The operation failed." }); } finally { setBusy(false); }
  }
}

function PublicationForm({ publication, busy, onSave, onTransition, onArchive, onDelete }: { publication: Publication; busy: boolean; onSave: (id: string, form: HTMLFormElement) => void; onTransition: (id: string, to: Publication["status"]) => void; onArchive: (id: string) => void; onDelete: (id: string) => void }) {
  return <form className={styles.editorForm} onSubmit={(event) => { event.preventDefault(); onSave(publication.id, event.currentTarget); }}>
    <div className={styles.editorStatus}><span>{publication.status}</span><span>{publication.publicId}</span></div>
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
        <span>evidence basis</span>
        <span>{publication.narrativeWatchDetails.evidenceBasis === "analysis" ? "analysis · no source cited" : "sourced"}</span>
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
    <PublicationTrace publicationId={publication.id} />
    <CheckboxField
      className={styles.editorField}
      name="featuredIsraelStory"
      label="Featured daily Israel story"
      defaultChecked={publication.featuredIsraelStory}
    />
    <div className={styles.actionRow}>
      <Button variant="primary" type="submit" disabled={busy}>Save changes</Button>
      {publicationActions(publication.status).map((action) => (
        <Button
          key={action.to}
          variant={action.primary ? "primary" : "secondary"}
          type="button"
          disabled={busy}
          onClick={() => onTransition(publication.id, action.to)}
        >
          {action.label}
        </Button>
      ))}
      {publication.status !== "archived" ? (
        <Button variant="danger" type="button" disabled={busy} onClick={() => onArchive(publication.id)}>
          Remove from site and archive
        </Button>
      ) : null}
      {(publication.status === "archived" || publication.status === "draft") ? (
        <Button variant="danger" type="button" disabled={busy} onClick={() => onDelete(publication.id)}>
          Delete permanently
        </Button>
      ) : null}
    </div>
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
  const [trace, setTrace] = useState<Traceability | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/v1/publications/${publicationId}/traceability`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("trace unavailable")))
      .then((payload: Traceability) => { if (live) setTrace(payload); })
      .catch(() => { if (live) setTrace(null); });
    return () => { live = false; };
  }, [publicationId]);
  if (!trace) return <p className={styles.muted}>Loading traceability…</p>;
  return <details className={styles.traceability}><summary>Traceability: run, model, and sources</summary>
    <p>{trace.briefingRun ? `${trace.briefingRun.localDate} · ${trace.briefingRun.stage} · ${trace.briefingRun.status} · ${trace.briefingRun.id}` : "Manual publication with no system run."}</p>
    {trace.edition ? <p>{`Edition ${trace.edition.id} · contract ${trace.edition.contractVersion} · prompt ${trace.edition.promptVersion} · ${trace.edition.status}`}</p> : null}
    <ul>{trace.modelRuns.map((run) => <li key={run.id}>{run.model} · {run.stage} · ${run.costUsd.toFixed(4)}</li>)}</ul>
    <ul>{trace.claims.map((claim) => <li key={claim.id}>{claim.title} · {claim.assessment} · {claim.evidenceCount} evidence · {claim.aiRunId ?? "no model run"}</li>)}</ul>
    <ul>{trace.sources.map((source) => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title} · {source.publisher} · {source.retrievalStatus}</li>)}</ul>
  </details>;
}
