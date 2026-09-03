"use client";

import { Button } from "@/components/ui/Button";
import type { PipelineJourney } from "./types";
import { PIPELINE_JOURNEYS } from "./data/journeys";
import { CHROME } from "./copy";
import styles from "./visualizer.module.css";

interface PipelineControlsProps {
  selectedJourneyId: string;
  currentJourney: PipelineJourney;
  currentStepIndex: number;
  stepProgress: number;
  isPlaying: boolean;
  speed: number;
  onSelectJourney: (id: string) => void;
  onTogglePlay: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onGoToStep: (index: number) => void;
  onSetSpeed: (speed: number) => void;
  onReset: () => void;
}

export function PipelineControls({
  selectedJourneyId,
  currentJourney,
  currentStepIndex,
  stepProgress,
  isPlaying,
  speed,
  onSelectJourney,
  onTogglePlay,
  onNextStep,
  onPrevStep,
  onGoToStep,
  onSetSpeed,
  onReset,
}: PipelineControlsProps) {
  const currentTitle = currentJourney.steps[currentStepIndex]?.titleEn ?? "";

  return (
    <>
      <div className={styles.controlBar}>
        <div className={styles.journeySelector}>
          {PIPELINE_JOURNEYS.map((journey) => (
            <Button
              key={journey.id}
              type="button"
              variant="filter"
              size="sm"
              isActive={selectedJourneyId === journey.id}
              onClick={() => onSelectJourney(journey.id)}
            >
              {journey.titleEn}
            </Button>
          ))}
        </div>

        <div className={styles.playbackCluster}>
          <Button
            type="button"
            variant="toolbar"
            size="sm"
            iconOnly
            onClick={onPrevStep}
            disabled={currentStepIndex === 0}
            title={CHROME.prevStep}
            aria-label={CHROME.prevStep}
          >
            ⏮
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onTogglePlay}
          >
            {isPlaying ? `⏸ ${CHROME.pause}` : `▶ ${CHROME.play}`}
          </Button>

          <Button
            type="button"
            variant="toolbar"
            size="sm"
            iconOnly
            onClick={onNextStep}
            disabled={currentStepIndex >= currentJourney.steps.length - 1}
            title={CHROME.nextStep}
            aria-label={CHROME.nextStep}
          >
            ⏭
          </Button>

          <Button
            type="button"
            variant="toolbar"
            size="sm"
            iconOnly
            onClick={onReset}
            title={CHROME.reset}
            aria-label={CHROME.reset}
          >
            ↺
          </Button>

          <div className={styles.speedSelector}>
            {[0.5, 1, 2, 4].map((s) => (
              <Button
                key={s}
                type="button"
                variant="filter"
                size="xs"
                isActive={speed === s}
                onClick={() => onSetSpeed(s)}
              >
                {s}x
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.stepTrackerBar}>
        <div className={styles.stepCounterLabel}>
          {CHROME.stepOf(currentStepIndex + 1, currentJourney.steps.length)}:{" "}
          <span className={styles.stepCounterCurrent}>{currentTitle}</span>
        </div>

        <div className={styles.stepDotsContainer}>
          {currentJourney.steps.map((st, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isDone = idx < currentStepIndex;
            const progress = Math.min(1, Math.max(0, stepProgress));

            return (
              <button
                key={`${currentJourney.id}-step-${idx}`}
                type="button"
                className={`
                  ${styles.stepDot}
                  ${isCurrent ? styles.stepDotActive : ""}
                  ${isDone ? styles.stepDotCompleted : ""}
                `}
                onClick={() => onGoToStep(idx)}
                title={st.titleEn}
                aria-label={CHROME.stepAria(idx + 1, st.titleEn)}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCurrent && isPlaying && (
                  <span
                    className={styles.stepDotProgressFill}
                    style={{ transform: `translateY(-50%) scaleX(${progress})` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
