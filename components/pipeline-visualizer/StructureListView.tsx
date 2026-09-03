"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import type { NodeCategory, PipelineJourney, ViewPerspective } from "./types";
import { PIPELINE_NODES } from "./data/nodes";
import { groupNodesByLane } from "./data/layout";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CHROME,
  kindLabel,
  nodeInspectorCopy,
} from "./copy";
import styles from "./visualizer.module.css";

interface StructureListViewProps {
  currentJourney: PipelineJourney;
  currentStepIndex: number;
  activeNodeId: string | null;
  selectedNodeId: string | null;
  viewPerspective: ViewPerspective;
  activeCategoryFilter: NodeCategory | "all";
  mapIsAvailable: boolean;
  stageIsMap: boolean;
  onGoToStep: (index: number) => void;
  onSelectNode: (nodeId: string) => void;
  onSetCategoryFilter: (category: NodeCategory | "all") => void;
  onOpenGlossary: (term?: string) => void;
}

/**
 * The stage that always works.
 *
 * The map is a 3400×1600 plane behind a viewport: it needs panning, a
 * pointer, and room. Below 1024×640 there is none of that, and the answer
 * is not a shrunken topology nobody can read — it is this, the same 47
 * components and the same journey, as text in reading order.
 *
 * It is not a mobile fallback. It is available at every size, because it is
 * also the keyboard and screen-reader reading of the diagram: lanes are
 * headings, components are a list, and nothing is reachable only by
 * dragging a canvas.
 */
export function StructureListView({
  currentJourney,
  currentStepIndex,
  activeNodeId,
  selectedNodeId,
  viewPerspective,
  activeCategoryFilter,
  mapIsAvailable,
  stageIsMap,
  onGoToStep,
  onSelectNode,
  onSetCategoryFilter,
  onOpenGlossary,
}: StructureListViewProps) {
  /* The same two filters the map applies, applied to the same node list, so
     the two stages can never be showing different systems. */
  const visibleNodes = useMemo(() => {
    return PIPELINE_NODES.filter((node) => {
      if (activeCategoryFilter !== "all" && node.cat !== activeCategoryFilter) {
        return false;
      }
      if (viewPerspective === "briefing") {
        return (
          node.cat === "briefing" ||
          node.cat === "ingest" ||
          node.id === "ai_gateway" ||
          node.id === "publication"
        );
      }
      return true;
    });
  }, [activeCategoryFilter, viewPerspective]);

  const laneGroups = useMemo(() => groupNodesByLane(visibleNodes), [visibleNodes]);

  const journeyNodeIds = useMemo(
    () => new Set(currentJourney.steps.map((step) => step.nodeId)),
    [currentJourney],
  );

  return (
    <div className={styles.structureRegion}>
      {/* Only shown when the reader asked for the map and the viewport
          cannot hold one. Saying nothing would read as a broken toggle. */}
      {stageIsMap && !mapIsAvailable ? (
        <div className={styles.stageNotice} role="status">
          <strong className={styles.stageNoticeTitle}>
            {CHROME.stageMapUnavailableTitle}
          </strong>
          <p className={styles.stageNoticeBody}>{CHROME.stageMapUnavailable}</p>
        </div>
      ) : null}

      <section className={styles.structureSection} aria-labelledby="pipeline-process-heading">
        <div className={styles.structureSectionHead}>
          <h2 id="pipeline-process-heading" className={styles.structureHeading}>
            {CHROME.structureProcessHeading}
          </h2>
          <p className={styles.structureIntro}>
            {CHROME.structureProcessIntro(currentJourney.titleEn)}
          </p>
        </div>

        <ol className={styles.processList}>
          {currentJourney.steps.map((step, index) => {
            const isCurrent = index === currentStepIndex;
            const isDone = index < currentStepIndex;
            const node = PIPELINE_NODES.find((n) => n.id === step.nodeId);

            return (
              <li
                key={`${currentJourney.id}-process-${index}`}
                className={[
                  styles.processItem,
                  isCurrent ? styles.processItemCurrent : "",
                  isDone ? styles.processItemDone : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={isCurrent ? "step" : undefined}
              >
                <button
                  type="button"
                  className={styles.processButton}
                  onClick={() => onGoToStep(index)}
                  aria-label={CHROME.stepAria(index + 1, step.titleEn)}
                >
                  <span className={styles.processIndex} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.processText}>
                    <span className={styles.processTitle}>{step.titleEn}</span>
                    <span className={styles.processDescription}>
                      {step.descriptionEn}
                    </span>
                  </span>
                </button>

                <div className={styles.processMeta}>
                  {isCurrent ? (
                    <span className={styles.processCurrentTag}>
                      {CHROME.structureCurrentStep}
                    </span>
                  ) : null}
                  {node ? (
                    <Button
                      type="button"
                      variant="text"
                      size="sm"
                      onClick={() => onSelectNode(node.id)}
                    >
                      {node.nameEn}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section
        className={styles.structureSection}
        aria-labelledby="pipeline-components-heading"
      >
        <div className={styles.structureSectionHead}>
          <h2 id="pipeline-components-heading" className={styles.structureHeading}>
            {CHROME.structureComponentsHeading}
          </h2>
          <p className={styles.structureIntro}>{CHROME.structureComponentsIntro}</p>

          <div className={styles.laneFilterRow} role="group" aria-label={CHROME.laneFilterLabel}>
            <Button
              type="button"
              variant="filter"
              size="sm"
              isActive={activeCategoryFilter === "all"}
              onClick={() => onSetCategoryFilter("all")}
            >
              {CHROME.laneFilterAll}
            </Button>
            {CATEGORY_ORDER.map((category) => (
              <Button
                key={category}
                type="button"
                variant="filter"
                size="sm"
                isActive={activeCategoryFilter === category}
                onClick={() => onSetCategoryFilter(category)}
              >
                {CATEGORY_LABELS[category]}
              </Button>
            ))}
          </div>

          <p className={styles.structureCount}>
            {CHROME.structureCount(visibleNodes.length, PIPELINE_NODES.length)}
          </p>
        </div>

        {laneGroups.length === 0 ? (
          <p className={styles.structureEmpty}>{CHROME.structureEmpty}</p>
        ) : (
          laneGroups.map((lane) => (
            <section key={lane.id} className={styles.laneGroup}>
              <h3 className={styles.laneGroupTitle}>{lane.title}</h3>
              <p className={styles.laneGroupDescription}>{lane.description}</p>

              <ul className={styles.nodeList}>
                {lane.nodes.map((node) => {
                  const copy = nodeInspectorCopy(node.id);
                  const isActive = activeNodeId === node.id;
                  const isSelected = selectedNodeId === node.id;
                  const inJourney = journeyNodeIds.has(node.id);

                  return (
                    <li
                      key={node.id}
                      className={[
                        styles.nodeRow,
                        isActive ? styles.nodeRowActive : "",
                        isSelected ? styles.nodeRowSelected : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      data-kind={node.kind}
                    >
                      <button
                        type="button"
                        className={styles.nodeRowButton}
                        onClick={() => onSelectNode(node.id)}
                        aria-pressed={isSelected}
                      >
                        <span className={styles.nodeRowTop}>
                          <span className={styles.nodeRowKind}>
                            {kindLabel(node.kind)}
                          </span>
                          {isActive ? (
                            <span className={styles.nodeRowFlagActive}>
                              {CHROME.structureCurrentStep}
                            </span>
                          ) : inJourney ? (
                            <span className={styles.nodeRowFlag}>
                              {CHROME.structureVisitedInJourney}
                            </span>
                          ) : null}
                        </span>

                        <span className={styles.nodeRowName}>{node.nameEn}</span>

                        {node.dbTable && node.dbTable !== node.nameEn ? (
                          <span className={styles.nodeRowTable}>{node.dbTable}</span>
                        ) : null}

                        {copy?.what ? (
                          <span className={styles.nodeRowWhat}>{copy.what}</span>
                        ) : null}
                      </button>

                      {node.terms.length > 0 ? (
                        <div className={styles.nodeRowActions}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenGlossary(node.nameEn)}
                            title={CHROME.explainTitle}
                          >
                            {CHROME.explain}
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </section>
    </div>
  );
}
