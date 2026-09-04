"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import type {
  ConsoleEntityVersion,
  ConsoleEntityVersions,
  ConsoleEvidenceProvenance,
} from "@/server/contracts/admin-console";
import { ENTITY_TYPES } from "@/server/contracts/enums";
import { ABSENCE, T } from "./lexicon";
import { EmptyLine, InlineAbsence, PanelTitle, Pill, formatDate } from "./console-primitives";
import { RouteUnavailable, readConsole, type ReadState } from "./useConsoleRead";
import { AuthRequired } from "./auth-required";
import styles from "./admin.module.css";

/**
 * Lineage — two held lookups over the history tables, generalised from the
 * publication drilldown:
 *
 *  (a) any versioned entity's versions, keyed by the `entity_type` +
 *      `entity_id` pair `entity_version` indexes;
 *  (b) one evidence row's provenance trail.
 *
 * Both reads are held until the operator submits the lookup — nothing is
 * fetched on mount, because the identifiers are typed, not browsed. Both
 * routes answer 404 for "this identifier has no history" as well as for a
 * missing route, so the absence line carries the second cause under it,
 * the same way the draft preview's does.
 */
export function LineageSection() {
  return (
    <section className={styles.subArea} aria-label={T.lineage}>
      <EntityVersionsLookup />
      <EvidenceProvenanceLookup />
    </section>
  );
}

/** The lookup's own state machine: `idle` is the held state — nothing has
 *  been asked yet — and the other four are the read's ordinary states. */
type LookupState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; value: T }
  | { kind: "unavailable" }
  | { kind: "auth-required" }
  | { kind: "failed"; message: string };

/** Maps into the states `InlineAbsence` renders; `ready` and `idle` never
 *  reach it — the callers gate on those before mounting it. */
function toAbsence(state: LookupState<unknown>): ReadState<unknown> {
  if (state.kind === "failed") return { kind: "failed", message: state.message };
  if (state.kind === "ready") return { kind: "ready", value: state.value };
  return { kind: state.kind === "idle" ? "loading" : state.kind };
}

function EntityVersionsLookup() {
  const [entityType, setEntityType] = useState<string>(ENTITY_TYPES[0] ?? "publication");
  const [entityId, setEntityId] = useState("");
  const [state, setState] = useState<LookupState<ConsoleEntityVersions>>({ kind: "idle" });

  async function lookup() {
    const id = entityId.trim();
    if (!id) return;
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", value: await readConsole<ConsoleEntityVersions>(`admin/console/entities/${entityType}/${id}/versions?limit=50`) });
    } catch (cause: unknown) {
      if (cause instanceof AuthRequired) setState({ kind: "auth-required" });
      else if (cause instanceof RouteUnavailable) setState({ kind: "unavailable" });
      else setState({ kind: "failed", message: cause instanceof Error ? cause.message : "לא ניתן לקרוא את ההיסטוריה." });
    }
  }

  return (
    <div className={styles.panel}>
      <PanelTitle note={ABSENCE.lineageAbsent}>{T.lineageWhat}</PanelTitle>
      <form
        className={styles.filterRow}
        aria-label={`${T.lookup} · ${T.lineageWhat}`}
        onSubmit={(event) => {
          event.preventDefault();
          void lookup();
        }}
      >
        <SelectField className={styles.editorField} label={T.entityType} value={entityType} onChange={(event) => setEntityType(event.target.value)}>
          {ENTITY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </SelectField>
        <Field className={styles.editorField} label={T.entityId} value={entityId} onChange={(event) => setEntityId(event.currentTarget.value)} placeholder="uuid" />
        <div className={styles.filterActions}>
          <Button variant="secondary" type="submit" disabled={!entityId.trim() || state.kind === "loading"}>
            {T.lookup}
          </Button>
        </div>
      </form>

      {state.kind !== "ready" && state.kind !== "idle" ? (
        <>
          <InlineAbsence state={toAbsence(state)} what={T.lineageWhat} reload={() => setState({ kind: "idle" })} />
          {state.kind === "unavailable" ? <p className={styles.muted}>{ABSENCE.lineageAbsent}</p> : null}
        </>
      ) : null}

      {state.kind === "ready" ? <EntityVersionList versions={state.value.versions} /> : null}
    </div>
  );
}

function EntityVersionList({ versions }: { versions: ConsoleEntityVersion[] }) {
  if (!versions.length) {
    return <EmptyLine>לא נרשמו גרסאות לישות הזו. הקריאה הצליחה וההיסטוריה באמת ריקה.</EmptyLine>;
  }
  return (
    <ol className={styles.versionList}>
      {versions.map((version) => (
        <li key={version.versionId}>
          <div>
            <strong>
              {T.version} {version.versionNumber}
            </strong>
            <Pill tone="neutral">{version.changeSource}</Pill>
            <small>
              {version.actorLabel} · {formatDate(version.createdAt)} · {version.changeSummary}
            </small>
          </div>
          <details className={styles.traceability}>
            <summary>{T.snapshot}</summary>
            <pre className={styles.json}>{JSON.stringify(version.snapshot, null, 2)}</pre>
          </details>
        </li>
      ))}
    </ol>
  );
}

function EvidenceProvenanceLookup() {
  const [evidenceId, setEvidenceId] = useState("");
  const [state, setState] = useState<LookupState<ConsoleEvidenceProvenance>>({ kind: "idle" });

  async function lookup() {
    const id = evidenceId.trim();
    if (!id) return;
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", value: await readConsole<ConsoleEvidenceProvenance>(`admin/console/evidence/${id}/provenance`) });
    } catch (cause: unknown) {
      if (cause instanceof AuthRequired) setState({ kind: "auth-required" });
      else if (cause instanceof RouteUnavailable) setState({ kind: "unavailable" });
      else setState({ kind: "failed", message: cause instanceof Error ? cause.message : "לא ניתן לקרוא את שרשרת המקור." });
    }
  }

  return (
    <div className={styles.panel}>
      <PanelTitle note={ABSENCE.provenanceAbsent}>{T.provenance}</PanelTitle>
      <form
        className={styles.filterRow}
        aria-label={`${T.lookup} · ${T.provenance}`}
        onSubmit={(event) => {
          event.preventDefault();
          void lookup();
        }}
      >
        <Field className={styles.editorField} label={T.evidenceId} value={evidenceId} onChange={(event) => setEvidenceId(event.currentTarget.value)} placeholder="uuid" />
        <div className={styles.filterActions}>
          <Button variant="secondary" type="submit" disabled={!evidenceId.trim() || state.kind === "loading"}>
            {T.lookup}
          </Button>
        </div>
      </form>

      {state.kind !== "ready" && state.kind !== "idle" ? (
        <>
          <InlineAbsence state={toAbsence(state)} what={T.provenanceWhat} reload={() => setState({ kind: "idle" })} />
          {state.kind === "unavailable" ? <p className={styles.muted}>{ABSENCE.provenanceAbsent}</p> : null}
        </>
      ) : null}

      {state.kind === "ready" ? <ProvenanceList value={state.value} /> : null}
    </div>
  );
}

function ProvenanceList({ value }: { value: ConsoleEvidenceProvenance }) {
  if (!value.entries.length) {
    return <EmptyLine>לא נרשמו רשומות מקור לראיה הזו. הקריאה הצליחה והשרשרת באמת ריקה.</EmptyLine>;
  }
  return (
    <ul className={styles.logList}>
      {value.entries.map((entry) => (
        <li key={entry.id}>
          <span>
            <Pill tone="neutral">{entry.action}</Pill>
          </span>
          <strong>{entry.actorLabel}</strong>
          <small>
            {formatDate(entry.occurredAt)}
            {entry.detail ? ` · ${entry.detail}` : ""}
          </small>
        </li>
      ))}
    </ul>
  );
}
