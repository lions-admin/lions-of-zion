"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import type {
  PipelineJourney,
  SimulationPacket,
  SimulationEventLog,
  ViewPerspective,
  NodeCategory,
} from "../types";
import { PIPELINE_NODES } from "../data/nodes";
import { PIPELINE_JOURNEYS } from "../data/journeys";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function readReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function readReducedMotionOnServer() {
  return false;
}

export function usePipelineSimulation() {
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>("journey_verified_claim");
  const [currentStepIndex, setCurrentStepIndexState] = useState<number>(0);

  // The simulation is the one thing on the page that loops. Under reduced
  // motion it opens paused; the play control still works. `null` means the
  // reader has not touched playback yet, so the preference decides.
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    readReducedMotionOnServer
  );
  const [playIntent, setPlayIntent] = useState<boolean | null>(null);
  const isPlaying = playIntent ?? !prefersReducedMotion;
  const setIsPlaying: (next: boolean) => void = setPlayIntent;

  const [speed, setSpeed] = useState<number>(1);
  const [stepProgress, setStepProgress] = useState<number>(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewPerspective, setViewPerspective] = useState<ViewPerspective>("pipelines");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<NodeCategory | "all">("all");

  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const currentJourney: PipelineJourney = useMemo(() => {
    return PIPELINE_JOURNEYS.find((j) => j.id === selectedJourneyId) ?? PIPELINE_JOURNEYS[0];
  }, [selectedJourneyId]);

  const currentStep = useMemo(() => {
    return currentJourney.steps[currentStepIndex] ?? currentJourney.steps[0];
  }, [currentJourney, currentStepIndex]);

  const nextStepNode = useMemo(() => {
    if (currentStepIndex < currentJourney.steps.length - 1) {
      return currentJourney.steps[currentStepIndex + 1].nodeId;
    }
    return null;
  }, [currentJourney, currentStepIndex]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return PIPELINE_NODES.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId]);

  // Derive event logs dynamically in Hebrew for all steps up to current step
  const eventLogs = useMemo<SimulationEventLog[]>(() => {
    const logs: SimulationEventLog[] = [];
    for (let i = currentStepIndex; i >= 0; i--) {
      const step = currentJourney.steps[i];
      if (!step) continue;
      const node = PIPELINE_NODES.find((n) => n.id === step.nodeId);
      const nodeName = node ? `${node.nameHe} (${node.nameEn})` : step.nodeId;
      logs.push({
        id: `${currentJourney.id}-step-${i}`,
        timestamp: `07:04:${String(10 + i * 2).padStart(2, "0")}`,
        stepIndex: i + 1,
        nodeId: step.nodeId,
        nodeName,
        level: step.logEvent?.level ?? "info",
        message: `${step.titleHe}: ${step.descriptionHe}`,
        detail: step.descriptionHe,
        metrics: step.logEvent?.metrics,
      });
    }
    return logs;
  }, [currentJourney, currentStepIndex]);

  // Handle animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const durationPerStepMs = 2800 / speed;

    const tick = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      setStepProgress((prev) => {
        const increment = delta / durationPerStepMs;
        const next = prev + increment;
        if (next >= 1) {
          // Advance to next step
          setCurrentStepIndexState((curr) => {
            if (curr < currentJourney.steps.length - 1) {
              return curr + 1;
            } else {
              // Loop back to start smoothly
              return 0;
            }
          });
          return 0;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = 0;
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, speed, currentJourney.steps.length]);

  // Derived moving packets
  const activePackets: SimulationPacket[] = useMemo(() => {
    if (!nextStepNode) {
      return [
        {
          id: `packet-${currentStep.nodeId}`,
          fromNodeId: currentStep.nodeId,
          toNodeId: currentStep.nodeId,
          progress: stepProgress,
          label: currentStep.titleHe,
          kind: currentStep.logEvent?.level === "error" ? "alert" : "data",
        },
      ];
    }
    return [
      {
        id: `packet-${currentStep.nodeId}-${nextStepNode}`,
        fromNodeId: currentStep.nodeId,
        toNodeId: nextStepNode,
        progress: stepProgress,
        label: currentStep.titleHe,
        kind:
          currentStep.logEvent?.level === "error"
            ? "quarantine"
            : currentStep.logEvent?.level === "warn"
              ? "alert"
              : "data",
      },
    ];
  }, [currentStep, nextStepNode, stepProgress]);

  const selectJourney = useCallback((journeyId: string) => {
    setSelectedJourneyId(journeyId);
    setCurrentStepIndexState(0);
    setStepProgress(0);
  }, []);

  const nextStep = useCallback(() => {
    setPlayIntent(false);
    setCurrentStepIndexState((curr) => Math.min(curr + 1, currentJourney.steps.length - 1));
    setStepProgress(0);
  }, [currentJourney.steps.length]);

  const prevStep = useCallback(() => {
    setPlayIntent(false);
    setCurrentStepIndexState((curr) => Math.max(curr - 1, 0));
    setStepProgress(0);
  }, []);

  const goToStep = useCallback((index: number) => {
    setPlayIntent(false);
    setCurrentStepIndexState(Math.max(0, Math.min(index, currentJourney.steps.length - 1)));
    setStepProgress(0);
  }, [currentJourney.steps.length]);

  const togglePlay = useCallback(() => {
    setPlayIntent((prev) => !(prev ?? !prefersReducedMotion));
  }, [prefersReducedMotion]);

  const resetSimulation = useCallback(() => {
    setCurrentStepIndexState(0);
    setStepProgress(0);
    setPlayIntent(true);
  }, []);

  return {
    // State
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
    // Actions
    selectJourney,
    setCurrentStepIndex: goToStep,
    nextStep,
    prevStep,
    togglePlay,
    setIsPlaying,
    setSpeed,
    setSelectedNodeId,
    setViewPerspective,
    setActiveCategoryFilter,
    resetSimulation,
  };
}
