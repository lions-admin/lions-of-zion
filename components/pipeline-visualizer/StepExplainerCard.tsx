"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { JourneyStep } from "./types";
import { PIPELINE_NODES } from "./data/nodes";
import { CHROME } from "./copy";
import styles from "./visualizer.module.css";

const HEBREW = /[\u0590-\u05FF]/;

function formatPayload(payload: JourneyStep["payloadSnippet"]): string | null {
  if (payload == null) return null;
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return HEBREW.test(text) ? null : text;
}

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
  const payloadText = formatPayload(currentStep.payloadSnippet);

  return (
    <div className={styles.explainerCardContainer}>
      <div className={styles.explainerHeader}>
        <div className={styles.explainerHeaderRight}>
          <span className={styles.stepBadge}>
            {CHROME.stepOf(stepIndex + 1, totalSteps)}
          </span>
          <h3 className={styles.explainerTitle}>{currentStep.titleEn}</h3>
        </div>

        <div className={styles.explainerHeaderActions}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenGlossary()}
            title={CHROME.glossaryButtonTitle}
          >
            {CHROME.glossaryButton}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? CHROME.collapseTitle : CHROME.expandTitle}
          >
            {isExpanded ? `▲ ${CHROME.collapse}` : `▼ ${CHROME.expand}`}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.explainerBody}>
          <div className={styles.explainerMainText}>
            <div className={styles.explainerContent}>
              <strong>{CHROME.nowHappening}:</strong> {currentStep.descriptionEn}
            </div>
          </div>

          {node && (
            <div className={styles.explainerNodeLinkRow}>
              <div className={styles.explainerNodeBadge}>
                <span>{CHROME.activeComponent}:</span>
                <Button
                  type="button"
                  variant="text"
                  size="sm"
                  className={styles.nodeLinkBtn}
                  onClick={() => onSelectNode(node.id)}
                >
                  {node.nameEn}
                </Button>
              </div>

              {node.dbTable && (
                <div className={styles.explainerTableBadge}>
                  <span>{CHROME.table}:</span> <code>{node.dbTable}</code>
                </div>
              )}

              {node.sqlConstraintOrTrigger && (
                <div className={styles.explainerTriggerBadge}>
                  <span>{CHROME.sqlConstraint}:</span>{" "}
                  <code>{node.sqlConstraintOrTrigger}</code>
                </div>
              )}
            </div>
          )}

          {payloadText && (
            <div className={styles.explainerPayloadBox}>
              <div className={styles.payloadBoxHeader}>
                <span>{CHROME.payloadHeader}:</span>
              </div>
              <pre className={styles.payloadPre} dir="ltr">
                {payloadText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
