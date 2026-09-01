"use client";

import React from "react";
import type { PipelineJourney } from "./types";
import { PIPELINE_JOURNEYS } from "./data/journeys";
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
  return (
    <>
      {/* ── מסלולים תרחישיים (Journey Tabs Bar) ── */}
      <div className={styles.controlBar} dir="rtl">
        <div className={styles.journeySelector}>
          {PIPELINE_JOURNEYS.map((journey) => (
            <button
              key={journey.id}
              type="button"
              className={`
                ${styles.journeyTab}
                ${selectedJourneyId === journey.id ? styles.journeyTabActive : ""}
              `}
              onClick={() => onSelectJourney(journey.id)}
            >
              <span>{journey.titleHe}</span>
            </button>
          ))}
        </div>

        {/* פקדי הרצה ומהירות (Playback Controls & Speed) */}
        <div className={styles.playbackCluster} dir="ltr">
          <button
            type="button"
            className={styles.playbackBtn}
            onClick={onPrevStep}
            disabled={currentStepIndex === 0}
            title="שלב קודם"
            aria-label="שלב קודם"
          >
            ⏮
          </button>

          <button
            type="button"
            className={`${styles.playbackBtn} ${styles.playbackBtnPlay}`}
            onClick={onTogglePlay}
          >
            {isPlaying ? "⏸ השהה" : "▶ הפעל"}
          </button>

          <button
            type="button"
            className={styles.playbackBtn}
            onClick={onNextStep}
            disabled={currentStepIndex >= currentJourney.steps.length - 1}
            title="שלב הבא"
            aria-label="שלב הבא"
          >
            ⏭
          </button>

          <button
            type="button"
            className={styles.playbackBtn}
            onClick={onReset}
            title="איפוס הדמיה"
            aria-label="איפוס הדמיה"
          >
            ↺
          </button>

          <div className={styles.speedSelector}>
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                type="button"
                className={`
                  ${styles.speedBtn}
                  ${speed === s ? styles.speedBtnActive : ""}
                `}
                onClick={() => onSetSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── מד התקדמות שלבים (Step Progress Indicator) ── */}
      <div className={styles.stepTrackerBar} dir="rtl">
        <div className={styles.stepCounterLabel}>
          שלב {currentStepIndex + 1} מתוך {currentJourney.steps.length}:{" "}
          <span className={styles.stepCounterCurrent}>
            {currentJourney.steps[currentStepIndex]?.titleHe}
          </span>
        </div>

        <div className={styles.stepDotsContainer} dir="ltr">
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
                title={st.titleHe}
                aria-label={`שלב ${idx + 1}: ${st.titleHe}`}
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
