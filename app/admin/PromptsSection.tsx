"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { ConsoleNotices, EmptyLine, PanelTitle, Pill, ReadGate, formatAgo, formatDate, useOperations } from "./console-primitives";
import { SENTENCE, T } from "./lexicon";
import { callConsole, useConsoleRead } from "./useConsoleRead";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import type { ConsolePrompt, ConsolePrompts, ConsolePromptVersion, PromptVersionInserted } from "@/server/contracts/admin-console";
import { AI_RUN_KINDS } from "@/server/contracts/enums";
import styles from "./admin.module.css";

/**
 * The prompt registry desk.
 *
 * Two facts shape it, and both are the registry's own rules rather than
 * preferences: the registry is **append-only** — a version that is inserted
 * is never edited or deleted, so insertion only needs a form and the note
 * that says so — and **activation** is the one sanctioned mutation, made
 * through the SQL function the append-only trigger permits. Activation
 * changes what every future model call sees from the next call on, so it is
 * the one dangerous control here and goes through the shared confirmation
 * with the consequence spelled out.
 */
export function PromptsSection({ signal }: { signal: number }) {
  const prompts = useConsoleRead<ConsolePrompts>("admin/console/ai/prompts", { signal });
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  const areaRef = useRef<HTMLElement | null>(null);
  const ops = useOperations();

  return (
    <section className={styles.subArea} aria-label={T.prompts} ref={areaRef} tabIndex={-1}>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} idPrefix="prompts" />

      <ReadGate state={prompts.state} what={T.promptsWhat} reload={prompts.reload}>
        {(value) => (
          <>
            {value.prompts.length ? (
              value.prompts.map((prompt) => (
                <PromptBlock key={prompt.slug} prompt={prompt} disabled={ops.disabled} run={ops.run} onActivate={requestActivate} onInserted={prompts.reload} />
              ))
            ) : (
              <EmptyLine>המאגר ריק. הקריאה הצליחה; עד שתוסף גרסה ראשונה אין מה להציג.</EmptyLine>
            )}
          </>
        )}
      </ReadGate>

      <ConfirmDialog intent={confirmIntent} onClose={() => setConfirmIntent(null)} fallbackFocusRef={areaRef} />
    </section>
  );

  function requestActivate(prompt: ConsolePrompt, version: ConsolePromptVersion) {
    setConfirmIntent({
      action: T.activateVersion,
      target: prompt.slug,
      targetDetail: `${T.version} ${version.version} · ${version.modelProfile}`,
      consequence: T.activatePromptConsequence,
      confirmLabel: T.activateVersion,
      tone: "danger",
      run: () => activate(prompt, version),
    });
  }

  async function activate(prompt: ConsolePrompt, version: ConsolePromptVersion) {
    await ops.run(`activate:${prompt.slug}:${version.version}`, async () => {
      await callConsole("admin/console/ai/prompts/activate", {
        method: "POST",
        body: { slug: prompt.slug, version: version.version },
        failure: "לא ניתן להפעיל את הגרסה.",
      });
      prompts.reload();
      return SENTENCE.promptActivated(prompt.slug, version.version);
    });
  }
}

/** One slug's desk: the active flag, every version with its template, the
 *  activate control, and the insert form. The insert form is the routine
 *  half — it changes nothing until the version is activated — so it sits
 *  before the registry list, whose rows carry the one dangerous control. */
function PromptBlock({
  prompt,
  disabled,
  run,
  onActivate,
  onInserted,
}: {
  prompt: ConsolePrompt;
  disabled: boolean;
  run: (label: string, operation: () => Promise<string | null>) => Promise<void>;
  onActivate: (prompt: ConsolePrompt, version: ConsolePromptVersion) => void;
  onInserted: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [kind, setKind] = useState<string>("chat");
  const [modelProfile, setModelProfile] = useState("fast");
  const [template, setTemplate] = useState("");
  const [notes, setNotes] = useState("");
  const [insertOpen, setInsertOpen] = useState(false);

  async function insert() {
    const target = slug.trim() || prompt.slug;
    await run(`insert:${target}`, async () => {
      if (!template.trim()) throw new Error("נדרשת תבנית כדי להוסיף גרסה. שום דבר לא נשמר.");
      const result = await callConsole<PromptVersionInserted>("admin/console/ai/prompts", {
        method: "POST",
        body: {
          slug: target,
          kind: kind,
          template: template.trim(),
          modelProfile: modelProfile.trim() || "fast",
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
        failure: "לא ניתן להוסיף את הגרסה.",
      });
      setTemplate("");
      setNotes("");
      setInsertOpen(false);
      onInserted();
      return SENTENCE.promptInserted(result.slug, result.version);
    });
  }

  return (
    <div className={styles.panel}>
      <PanelTitle note={`${prompt.versions.length} ${T.versions}`}>
        <bdi>{prompt.slug}</bdi>
      </PanelTitle>
      <div className={styles.chipRow}>
        <Pill tone="neutral">{prompt.kind}</Pill>
        {prompt.activeVersion === null ? (
          <Pill tone="warn">{T.noActiveVersion}</Pill>
        ) : (
          <Pill tone="ok">
            {T.activeVersion} · {T.version} {prompt.activeVersion}
          </Pill>
        )}
      </div>

      <p className={styles.muted}>{T.insertPromptNote}</p>
      <div className={styles.actionRow}>
        <Button variant="secondary" size="sm" type="button" aria-expanded={insertOpen} onClick={() => setInsertOpen((open) => !open)}>
          {insertOpen ? T.close : T.insertVersion}
        </Button>
      </div>
      {insertOpen ? (
        <form
          className={styles.formGrid}
          aria-label={`${T.insertVersion} · ${prompt.slug}`}
          onSubmit={(event) => {
            event.preventDefault();
            void insert();
          }}
        >
          <Field className={styles.editorField} label={T.prompt} value={slug} onChange={(event) => setSlug(event.currentTarget.value)} placeholder={prompt.slug} maxLength={200} />
          <SelectField className={styles.editorField} label={T.promptKind} value={kind} onChange={(event) => setKind(event.target.value)}>
            {AI_RUN_KINDS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectField>
          <Field className={styles.editorField} label={T.promptProfile} value={modelProfile} onChange={(event) => setModelProfile(event.currentTarget.value)} maxLength={100} />
          <label className={styles.editorField}>
            <span className={styles.sectionLabel}>{T.promptTemplate}</span>
            <textarea value={template} rows={6} maxLength={20_000} onChange={(event) => setTemplate(event.target.value)} />
          </label>
          <Field className={styles.editorField} label={T.promptNotes} value={notes} onChange={(event) => setNotes(event.currentTarget.value)} maxLength={2000} />
          <div className={styles.actionRow}>
            <Button variant="primary" type="submit" disabled={disabled || !template.trim()}>
              {T.insertVersion}
            </Button>
          </div>
        </form>
      ) : null}

      <ul className={styles.versionList}>
        {prompt.versions.map((version) => {
          const active = prompt.activeVersion === version.version;
          return (
            <li key={version.id}>
              <div>
                <strong>
                  {T.version} {version.version}
                </strong>
                {active ? <Pill tone="gold">{T.active}</Pill> : null}
                <small>
                  <bdi>{version.modelProfile}</bdi> · {formatDate(version.createdAt)}
                  {version.activatedAt ? ` · הופעלה ${formatAgo(version.activatedAt)}` : ""}
                  {version.notes ? ` · ${version.notes}` : ""}
                </small>
              </div>
              {!active ? (
                <Button variant="danger" size="sm" type="button" disabled={disabled} onClick={() => onActivate(prompt, version)}>
                  {T.activateVersion}
                </Button>
              ) : null}
              <details className={styles.traceability}>
                <summary>{T.promptTemplate}</summary>
                <pre className={styles.json}>{version.template}</pre>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
