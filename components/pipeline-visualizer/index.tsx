"use client";

import React, { useState } from "react";
import { usePipelineSimulation } from "./hooks/usePipelineSimulation";
import { PipelineCanvas } from "./PipelineCanvas";
import { PipelineControls } from "./PipelineControls";
import { StepExplainerCard } from "./StepExplainerCard";
import { TermsGlossaryModal } from "./TermsGlossaryModal";
import { NodeInspectorDrawer } from "./NodeInspectorDrawer";
import { EventTelemetryStream } from "./EventTelemetryStream";
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

  // Glossary modal state
  const [isGlossaryOpen, setIsGlossaryOpen] = useState<boolean>(false);
  const [glossarySearchQuery, setGlossarySearchQuery] = useState<string>("");

  const handleOpenGlossary = (term?: string) => {
    setGlossarySearchQuery(term || "");
    setIsGlossaryOpen(true);
  };

  return (
    <div className={styles.visualizerShell}>
      {/* ── שורת כותרת עליונה (Header Bar) ── */}
      <header className={styles.headerBar} dir="rtl">
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <span>LIONS OF ZION</span>
            <span className={styles.brandBadge}>ארכיטקטורת המערכת וצינור המידע</span>
          </div>
          <div className={styles.headerSubtitle}>
            הדמיה אינטראקטיבית מתוסרטת של מנוע אימות הטענות, שערי ה־SQL, מכונת הבריף היומי ושכבות האבטחה — מבוססת על מבנה הקוד, ולא על הרצה חיה
          </div>
        </div>

        <div className={styles.headerControls} dir="ltr">
          <button
            type="button"
            className={styles.glossaryPillBtn}
            onClick={() => handleOpenGlossary()}
            title="פתח מילון מונחים והסברים"
          >
            מילון מונחים (עברית/אנגלית)
          </button>

          <div className={styles.viewModeGroup}>
            <button
              type="button"
              className={`
                ${styles.viewModeBtn}
                ${viewPerspective === "pipelines" ? styles.viewModeBtnActive : ""}
              `}
              onClick={() => setViewPerspective("pipelines")}
            >
              כל המערכת (7 מסלולים)
            </button>
            <button
              type="button"
              className={`
                ${styles.viewModeBtn}
                ${viewPerspective === "briefing" ? styles.viewModeBtnActive : ""}
              `}
              onClick={() => setViewPerspective("briefing")}
            >
              מכונת הבריף היומי
            </button>
          </div>
        </div>
      </header>

      {/* ── פקדי ניווט ותרחישים (Controls & Scenarios Bar) ── */}
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

      {/* ── כרטיס הסבר שלב בולט וברור (Step Story Explainer) ── */}
      <StepExplainerCard
        currentStep={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={currentJourney.steps.length}
        onOpenGlossary={handleOpenGlossary}
        onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
      />

      {/* ── משטח ההדמיה האינטראקטיבי (Pan & Zoom Canvas + Draggable Cards) ── */}
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

        {/* מגירת ניתוח רכיב מעמיקה */}
        <NodeInspectorDrawer
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>

      {/* ── מסוף יומן אירועים ומדדים חיים ── */}
      <EventTelemetryStream
        eventLogs={eventLogs}
        activeStepNodeName={currentStep?.titleHe}
      />

      {/* ── מילון מונחים והסברים מלא ── */}
      <TermsGlossaryModal
        isOpen={isGlossaryOpen}
        initialSearch={glossarySearchQuery}
        onClose={() => setIsGlossaryOpen(false)}
      />
    </div>
  );
}

export default PipelineVisualizer;
