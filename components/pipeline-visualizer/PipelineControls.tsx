"use client";

import { useEffect, useRef } from "react";
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
  const railRef = useRef<HTMLDivElement | null>(null);
  const activeStepRef = useRef<HTMLButtonElement | null>(null);

  /* The rail scrolls within its own region rather than stretching the bar
     off the viewport, which means the playhead can leave view while the
     simulation runs. Bring it back by moving the rail's own scrollLeft —
     never `scrollIntoView`, which walks every scrollable ancestor and would
     drag the whole page around on a phone. */
  useEffect(() => {
    const rail = railRef.current;
    const dot = activeStepRef.current;
    if (!rail || !dot) return;
    if (rail.scrollWidth <= rail.clientWidth) return;

    const target = dot.offsetLeft - (rail.clientWidth - dot.offsetWidth) / 2;
    const max = rail.scrollWidth - rail.clientWidth;
    rail.scrollLeft = Math.max(0, Math.min(max, target));
  }, [currentStepIndex, selectedJourneyId]);

  return (
    <>
      <section className={styles.controlBar} aria-label={CHROME.regionControls}>
        <div className={styles.journeySelector} role="group" aria-label="Journey">
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
            <span aria-hidden="true">⏮</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            className={styles.playButton}
            onClick={onTogglePlay}
          >
            <span aria-hidden="true">{isPlaying ? "⏸" : "▶"}</span>
            {isPlaying ? CHROME.pause : CHROME.play}
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
            <span aria-hidden="true">⏭</span>
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
            <span aria-hidden="true">↺</span>
          </Button>

          <div className={styles.speedSelector} role="group" aria-label="Speed">
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
      </section>

      <nav className={styles.stepTrackerBar} aria-label={CHROME.regionSteps}>
        <p className={styles.stepCounterLabel}>
          {CHROME.stepOf(currentStepIndex + 1, currentJourney.steps.length)}:{" "}
          <span className={styles.stepCounterCurrent}>{currentTitle}</span>
        </p>

        {/* The scrubber is a documented bespoke control: a rail of segments
            rather than a slider, because a journey's steps are named states
            and not a continuum. What it is not allowed to be is small. Each
            segment carries its own 44px hit area — on a fine pointer the
            visible bar sits inside a taller transparent target, and on a
            coarse pointer the rail stops dividing the width and starts
            scrolling, so the twenty-step journeys keep full-size targets at
            320px instead of eight-pixel slivers. */}
        <div className={styles.stepDotsContainer} ref={railRef}>
          {currentJourney.steps.map((st, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isDone = idx < currentStepIndex;
            const progress = Math.min(1, Math.max(0, stepProgress));

            return (
              <button
                key={`${currentJourney.id}-step-${idx}`}
                ref={isCurrent ? activeStepRef : undefined}
                type="button"
                className={[
                  styles.stepDot,
                  isCurrent ? styles.stepDotActive : "",
                  isDone ? styles.stepDotCompleted : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onGoToStep(idx)}
                title={st.titleEn}
                aria-label={CHROME.stepAria(idx + 1, st.titleEn)}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className={styles.stepDotIndex} aria-hidden="true">
                  {idx + 1}
                </span>
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
      </nav>
    </>
  );
}
