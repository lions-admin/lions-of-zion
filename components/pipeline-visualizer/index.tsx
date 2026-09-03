"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { usePipelineSimulation } from "./hooks/usePipelineSimulation";
import { PipelineCanvas } from "./PipelineCanvas";
import { PipelineControls } from "./PipelineControls";
import { StepExplainerCard } from "./StepExplainerCard";
import { TermsGlossaryModal } from "./TermsGlossaryModal";
import { NodeInspectorDrawer } from "./NodeInspectorDrawer";
import { EventTelemetryStream } from "./EventTelemetryStream";
import { CHROME } from "./copy";
import styles from "./visualizer.module.css";

export function PipelineVisualizer() {
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

      <div className={styles.mainStage}>
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

        <NodeInspectorDrawer
          node={selectedNode}
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
