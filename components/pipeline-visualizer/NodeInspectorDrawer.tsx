"use client";

import { Button } from "@/components/ui/Button";
import type { PipelineNode } from "./types";
import { CHROME, kindLabel, nodeInspectorCopy } from "./copy";
import styles from "./visualizer.module.css";

interface NodeInspectorDrawerProps {
  node: PipelineNode | null;
  stepTitleEn?: string;
  onClose: () => void;
}

export function NodeInspectorDrawer({
  node,
  stepTitleEn,
  onClose,
}: NodeInspectorDrawerProps) {
  if (!node) return null;

  const copy = nodeInspectorCopy(node.id);

  return (
    <div className={styles.inspectorDrawer}>
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
          onClick={onClose}
          aria-label={CHROME.inspectorClose}
          title={CHROME.inspectorClose}
        >
          <span aria-hidden="true">✕</span>
        </Button>
      </div>

      <div className={styles.drawerBody}>
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
      </div>
    </div>
  );
}
