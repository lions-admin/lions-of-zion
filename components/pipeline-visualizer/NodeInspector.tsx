"use client";

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { PipelineNode } from "./types";
import { CHROME, kindLabel, nodeInspectorCopy } from "./copy";
import styles from "./visualizer.module.css";

interface NodeInspectorProps {
  node: PipelineNode | null;
  stepTitleEn?: string;
  /** True where the inspector would cover the thing it annotates anyway.
   *  See the note on the two shells below. */
  asModal: boolean;
  onClose: () => void;
}

/**
 * The inspector has two shells, and the choice between them is a viewport
 * question rather than a taste one.
 *
 * **On the workbench it is a non-modal aside.** An operator reads this
 * panel by clicking node after node and watching it change; a modal would
 * make that Escape, click, read, Escape, click. The canvas has to stay
 * live, so the panel does not trap focus and does not make the page inert.
 * What it does do is the rest of the dialog contract: it takes focus when
 * it opens, closes on Escape from anywhere inside it, and hands focus back
 * to the control that opened it.
 *
 * **Below 1024×640 it is the shared `Dialog` drawer.** At those sizes the
 * panel covers the map completely, so there is nothing left behind it to
 * keep clickable and every argument above evaporates. The platform
 * `<dialog>` then gives the real thing: focus trap, inert background,
 * Escape, focus return, top layer.
 */
export function NodeInspector({
  node,
  stepTitleEn,
  asModal,
  onClose,
}: NodeInspectorProps) {
  if (!node) return null;

  if (asModal) {
    return (
      <Dialog
        open
        onClose={onClose}
        title={node.nameEn}
        description={stepTitleEn ?? kindLabel(node.kind)}
        variant="drawer"
        size="wide"
        closeLabel={CHROME.inspectorClose}
      >
        <div className={styles.inspectorSections}>
          <NodeInspectorSections node={node} />
        </div>
      </Dialog>
    );
  }

  return <InspectorAside node={node} stepTitleEn={stepTitleEn} onClose={onClose} />;
}

function InspectorAside({
  node,
  stepTitleEn,
  onClose,
}: {
  node: PipelineNode;
  stepTitleEn?: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  /* Remember the control that opened this reading of the panel, then take
     focus. Keyed on the node id so clicking a second card re-points the
     return target at the second card rather than the first. */
  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && !panelRef.current?.contains(active)) {
      openerRef.current = active;
    }
    panelRef.current?.focus();
  }, [node.id]);

  const close = useCallback(() => {
    const opener = openerRef.current;
    onClose();
    if (opener && opener.isConnected) opener.focus();
  }, [onClose]);

  /* Escape is scoped to the panel rather than to the document. A non-modal
     region that swallowed every Escape on the page would be reaching past
     its own boundary — with focus on a node card, Escape belongs to the
     card. */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    },
    [close],
  );

  return (
    <aside
      ref={panelRef}
      className={styles.inspectorPanel}
      role="complementary"
      aria-label={CHROME.regionInspector}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.drawerHeader}>
        <div className={styles.drawerHeading}>
          <span className={styles.drawerKicker}>{kindLabel(node.kind)}</span>
          <h2 className={styles.drawerTitle}>{node.nameEn}</h2>
          {stepTitleEn ? <p className={styles.drawerSubtitle}>{stepTitleEn}</p> : null}
        </div>
        <Button
          type="button"
          variant="toolbar"
          size="sm"
          iconOnly
          onClick={close}
          aria-label={CHROME.inspectorClose}
          title={CHROME.inspectorClose}
        >
          <span aria-hidden="true">✕</span>
        </Button>
      </div>

      <div className={styles.drawerBody}>
        <div className={styles.inspectorSections}>
          <NodeInspectorSections node={node} />
        </div>
      </div>
    </aside>
  );
}

function NodeInspectorSections({ node }: { node: PipelineNode }) {
  const copy = nodeInspectorCopy(node.id);

  return (
    <>
      {copy ? (
        <>
          <div className={styles.inspectorSection}>
            <span className={styles.inspectorLabel}>{CHROME.inspectorWhat}</span>
            <p className={styles.inspectorValueHe}>{copy.what}</p>
          </div>

          <div className={styles.inspectorSection}>
            <span className={styles.inspectorLabel}>{CHROME.inspectorWhy}</span>
            <p className={styles.inspectorValueHe}>{copy.why}</p>
          </div>

          <div className={styles.inspectorSection}>
            <span className={styles.inspectorLabel}>{CHROME.inspectorInput}</span>
            <p className={styles.inspectorValueHe}>{copy.input}</p>
          </div>

          <div className={styles.inspectorSection}>
            <span className={styles.inspectorLabel}>{CHROME.inspectorDoes}</span>
            <p className={styles.inspectorValueHe}>{copy.does}</p>
          </div>

          <div className={styles.inspectorSection}>
            <span className={styles.inspectorLabel}>{CHROME.inspectorOutput}</span>
            <p className={styles.inspectorValueHe}>{copy.output}</p>
          </div>

          <div className={styles.inspectorSection}>
            <span className={styles.inspectorLabel}>{CHROME.inspectorFailure}</span>
            <div className={styles.failureAlertBox}>
              <p className={styles.inspectorValueHe}>{copy.failureMode}</p>
            </div>
          </div>
        </>
      ) : null}

      {node.dbTable && (
        <div className={styles.inspectorSection}>
          <span className={styles.inspectorLabel}>{CHROME.inspectorTable}</span>
          <div className={styles.codeBox} dir="ltr">
            {node.dbTable}
          </div>
        </div>
      )}

      {node.sqlConstraintOrTrigger && (
        <div className={styles.inspectorSection}>
          <span className={styles.inspectorLabel}>{CHROME.inspectorSql}</span>
          <div className={styles.codeBox} dir="ltr">
            {node.sqlConstraintOrTrigger}
          </div>
        </div>
      )}

      {node.codePath && (
        <div className={styles.inspectorSection}>
          <span className={styles.inspectorLabel}>{CHROME.inspectorCode}</span>
          <div className={styles.codeBox} dir="ltr">
            {node.codePath}
          </div>
        </div>
      )}

      {node.terms.length > 0 && (
        <div className={styles.inspectorSection}>
          <span className={styles.inspectorLabel}>{CHROME.inspectorTerms}</span>
          <div className={styles.termChips}>
            {node.terms.map((t, idx) => (
              <span key={idx} className={styles.termChip}>
                {t.en}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
