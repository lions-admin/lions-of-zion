"use client";

import { useState } from "react";
import type { JourneyStep } from "./types";
import { PIPELINE_NODES } from "./data/nodes";
import styles from "./visualizer.module.css";

interface StepExplainerCardProps {
  currentStep: JourneyStep;
  stepIndex: number;
  totalSteps: number;
  onOpenGlossary: (term?: string) => void;
  onSelectNode: (nodeId: string) => void;
}

export function StepExplainerCard({
  currentStep,
  stepIndex,
  totalSteps,
  onOpenGlossary,
  onSelectNode,
}: StepExplainerCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const node = PIPELINE_NODES.find((n) => n.id === currentStep.nodeId);

  return (
    <div className={styles.explainerCardContainer} dir="rtl">
      {/* ── Header ── */}
      <div className={styles.explainerHeader}>
        <div className={styles.explainerHeaderRight}>
          <span className={styles.stepBadge}>
            שלב {stepIndex + 1} מתוך {totalSteps}
          </span>
          <h3 className={styles.explainerTitle}>{currentStep.titleHe}</h3>
        </div>

        <div className={styles.explainerHeaderActions}>
          <button
            type="button"
            className={styles.glossaryPillBtn}
            onClick={() => onOpenGlossary()}
            title="פתח מילון מונחים והסברים"
          >
            מילון מונחים
          </button>
          <button
            type="button"
            className={styles.explainerToggleBtn}
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? "כווץ הסבר" : "הרחב הסבר"}
          >
            {isExpanded ? "▲ כווץ" : "▼ הרחב הסבר"}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {isExpanded && (
        <div className={styles.explainerBody}>
          {/* מה קורה כעת */}
          <div className={styles.explainerMainText}>
            <div className={styles.explainerContent}>
              <strong>מה קורה כעת:</strong> {currentStep.descriptionHe}
            </div>
          </div>

          {/* רכיב מעורב וקישורים */}
          {node && (
            <div className={styles.explainerNodeLinkRow}>
              <div className={styles.explainerNodeBadge}>
                <span>רכיב פעיל:</span>
                <button
                  type="button"
                  className={styles.nodeLinkBtn}
                  onClick={() => onSelectNode(node.id)}
                >
                  {node.nameHe} <span className={styles.nodeLinkEn} dir="ltr">({node.nameEn})</span>
                </button>
              </div>

              {node.dbTable && (
                <div className={styles.explainerTableBadge} dir="ltr">
                  <span>טבלה:</span> <code>{node.dbTable}</code>
                </div>
              )}

              {node.sqlConstraintOrTrigger && (
                <div className={styles.explainerTriggerBadge} dir="ltr">
                  <span>אילוץ SQL:</span> <code>{node.sqlConstraintOrTrigger}</code>
                </div>
              )}
            </div>
          )}

          {/* הצגת נתונים שעוברים בשלב (Payload / Data Snippet) */}
          {currentStep.payloadSnippet && (
            <div className={styles.explainerPayloadBox}>
              <div className={styles.payloadBoxHeader}>
                <span>נתוני המידע שעוברים כעת ברשת:</span>
              </div>
              <pre className={styles.payloadPre} dir="ltr">
                {typeof currentStep.payloadSnippet === "string"
                  ? currentStep.payloadSnippet
                  : JSON.stringify(currentStep.payloadSnippet, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
