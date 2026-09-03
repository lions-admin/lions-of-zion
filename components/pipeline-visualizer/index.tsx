"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { usePipelineSimulation } from "./hooks/usePipelineSimulation";
import { PipelineCanvas } from "./PipelineCanvas";
import { PipelineControls } from "./PipelineControls";
import { StepExplainerCard } from "./StepExplainerCard";
import { TermsGlossaryModal } from "./TermsGlossaryModal";
import { NodeInspector } from "./NodeInspector";
import { StructureListView } from "./StructureListView";
import { useViewportGate, WORKBENCH_QUERY } from "./hooks/useViewportGate";
import { EventTelemetryStream } from "./EventTelemetryStream";
import { CHROME } from "./copy";
import styles from "./visualizer.module.css";

export function PipelineVisualizer() {
  /* Which shell the inspector gets is a viewport question; see NodeInspector. */
  const isWorkbench = useViewportGate(WORKBENCH_QUERY);
  /* Which stage the reader asked for. The map is only ever the *effective*
     stage where one fits; below the gate the request is kept but the
     structure view answers, and StructureListView says why. */
  const [stagePreference, setStagePreference] = useState<"map" | "structure">("map");
  const stageIsMap = stagePreference === "map";
  const showMap = stageIsMap && isWorkbench;
  const {
    selectedJourneyId,
    currentJourney,
    currentStepIndex,
    currentStep,
    nextStepNode,
    isPlaying,
    speed,
    stepProgress,
    selectedNodeId,
    selectedNode,
    viewPerspective,
    activeCategoryFilter,
    setActiveCategoryFilter,
    eventLogs,
    activePackets,
    selectJourney,
    setCurrentStepIndex,
    nextStep,
    prevStep,
    togglePlay,
    setSpeed,
    setSelectedNodeId,
    setViewPerspective,
    resetSimulation,
  } = usePipelineSimulation();

  const [isGlossaryOpen, setIsGlossaryOpen] = useState<boolean>(false);
  const [glossarySearchQuery, setGlossarySearchQuery] = useState<string>("");

  const handleOpenGlossary = (term?: string) => {
    setGlossarySearchQuery(term || "");
    setIsGlossaryOpen(true);
  };

  return (
    <div className={styles.visualizerShell}>
      <header className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <span>LIONS OF ZION</span>
            <h1 className={styles.brandBadge}>{CHROME.brandBadge}</h1>
          </div>
          <div className={styles.headerSubtitle}>{CHROME.headerSubtitle}</div>
        </div>

        <div className={styles.headerControls}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleOpenGlossary()}
            title={CHROME.glossaryButtonTitle}
          >
            {CHROME.glossaryButton}
          </Button>

          <div className={styles.viewModeGroup}>
            <Button
              type="button"
              variant="filter"
              size="sm"
              isActive={viewPerspective === "pipelines"}
              onClick={() => setViewPerspective("pipelines")}
            >
              {CHROME.viewAllPipelines}
            </Button>
            <Button
              type="button"
              variant="filter"
              size="sm"
              isActive={viewPerspective === "briefing"}
              onClick={() => setViewPerspective("briefing")}
            >
              {CHROME.viewBriefing}
            </Button>
          </div>
        </div>
      </header>

      <PipelineControls
        selectedJourneyId={selectedJourneyId}
        currentJourney={currentJourney}
        currentStepIndex={currentStepIndex}
        stepProgress={stepProgress}
        isPlaying={isPlaying}
        speed={speed}
        onSelectJourney={selectJourney}
        onTogglePlay={togglePlay}
        onNextStep={nextStep}
        onPrevStep={prevStep}
        onGoToStep={setCurrentStepIndex}
        onSetSpeed={setSpeed}
        onReset={resetSimulation}
      />

      <StepExplainerCard
        currentStep={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={currentJourney.steps.length}
        onOpenGlossary={handleOpenGlossary}
        onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
      />

      <div className={styles.stageSwitch} role="group" aria-label={CHROME.stageGroupLabel}>
        <span className={styles.stageSwitchLabel}>{CHROME.stageGroupLabel}</span>
        <Button
          type="button"
          variant="filter"
          size="sm"
          isActive={!stageIsMap}
          onClick={() => setStagePreference("structure")}
        >
          {CHROME.stageStructure}
        </Button>
        <Button
          type="button"
          variant="filter"
          size="sm"
          isActive={stageIsMap}
          onClick={() => setStagePreference("map")}
        >
          {CHROME.stageMap}
        </Button>
      </div>

      <div className={styles.mainStage} aria-label={CHROME.regionStage}>
        {showMap ? (
          <PipelineCanvas
            activeNodeId={currentStep?.nodeId ?? null}
            nextStepNodeId={nextStepNode}
            activePackets={activePackets}
            selectedNodeId={selectedNodeId}
            viewPerspective={viewPerspective}
            activeCategoryFilter={activeCategoryFilter}
            onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            onOpenGlossary={handleOpenGlossary}
          />
        ) : (
          <StructureListView
            currentJourney={currentJourney}
            currentStepIndex={currentStepIndex}
            activeNodeId={currentStep?.nodeId ?? null}
            selectedNodeId={selectedNodeId}
            viewPerspective={viewPerspective}
            activeCategoryFilter={activeCategoryFilter}
            mapIsAvailable={isWorkbench}
            stageIsMap={stageIsMap}
            onGoToStep={setCurrentStepIndex}
            onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            onSetCategoryFilter={setActiveCategoryFilter}
            onOpenGlossary={handleOpenGlossary}
          />
        )}

        <NodeInspector
          node={selectedNode}
          asModal={!isWorkbench}
          stepTitleEn={
            selectedNode && currentStep?.nodeId === selectedNode.id
              ? currentStep.titleEn
              : undefined
          }
          onClose={() => setSelectedNodeId(null)}
        />
      </div>

      <EventTelemetryStream
        eventLogs={eventLogs}
        activeStepNodeName={currentStep?.titleEn}
      />

      <TermsGlossaryModal
        isOpen={isGlossaryOpen}
        initialSearch={glossarySearchQuery}
        onClose={() => setIsGlossaryOpen(false)}
      />
    </div>
  );
}

export default PipelineVisualizer;
