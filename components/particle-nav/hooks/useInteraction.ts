'use client';
/**
 * Translates the discrete interaction machine into smoothed per-frame values —
 * the machine is discrete; the GPU sees eased scalars (plan §4.4).
 * Timings per brief §7: stream out 700 ms ease-out, return 900 ms, activate
 * burst + dolly with navigation firing independently at 320 ms.
 */
import { useMemo } from 'react';
import { InteractionMachine } from '../state/interactionMachine';
import type { SimParams } from '../types';

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export interface InteractionFrame {
  /** 0..1 detach-stream amount for the lion compute. */
  hoverAmount: number;
  /** Node the stream targets (last hovered while easing back). */
  streamNode: number;
  /** Per-node ring/connector activation 0..1. */
  nodeActive: number[];
  /** 0..1 connector gold flood. */
  flood: number;
  /** One-frame radial impulse (u/s) — consumed by the caller. */
  burstPulse: number;
  /** Camera dolly toward the active node, 0..1 of activateDollyDistance. */
  dolly: number;
}

export class InteractionDriver {
  readonly machine = new InteractionMachine();
  private hoverStart = 0;
  private hoverFrom = 0;
  private hover = 0;
  private nodeActive: number[] = [];
  private flood = 0;
  private dolly = 0;
  private burstFired = false;
  private lastKind: 'idle' | 'hover' | 'activating' = 'idle';

  constructor(nodeCount: number) {
    this.nodeActive = new Array(nodeCount).fill(0);
    this.machine.subscribe((snap) => {
      const kind = snap.state.kind;
      if (kind !== this.lastKind || (kind === 'hover' && this.lastKind === 'hover')) {
        this.hoverFrom = this.hover;
        this.hoverStart = performance.now();
        if (kind === 'activating') this.burstFired = false;
        this.lastKind = kind;
      }
    });
  }

  tick(now: number, dt: number, params: SimParams): InteractionFrame {
    const snap = this.machine.current;
    const s = snap.state;

    // --- hover stream amount: fixed-duration eased ramp, target from state
    const target = s.kind === 'idle' ? 0 : 1;
    const duration = target === 1 ? params.streamDurationMs : params.returnDurationMs;
    const t = Math.min(1, (now - this.hoverStart) / Math.max(1, duration));
    this.hover = this.hoverFrom + (target - this.hoverFrom) * easeOutCubic(t);

    // --- per-node ring/connector activation (quick 150 ms ease both ways)
    const k = 1 - Math.exp(-dt * 22);
    for (let i = 0; i < this.nodeActive.length; i++) {
      const on = s.kind !== 'idle' && s.nodeIndex === i ? 1 : 0;
      this.nodeActive[i] += (on - this.nodeActive[i]) * k;
    }

    // --- activate flood + dolly + one-frame burst
    const activating = s.kind === 'activating';
    this.flood += ((activating ? 1 : 0) - this.flood) * (1 - Math.exp(-dt * 14));
    this.dolly += ((activating ? 1 : 0) - this.dolly) * (1 - Math.exp(-dt * 6));
    let burstPulse = 0;
    if (activating && !this.burstFired) {
      burstPulse = params.activateImpulse;
      this.burstFired = true;
    }

    return {
      hoverAmount: snap.reducedMotion ? 0 : this.hover,
      streamNode: snap.lastNodeIndex,
      nodeActive: this.nodeActive,
      flood: this.flood,
      burstPulse: snap.reducedMotion ? 0 : burstPulse,
      dolly: snap.reducedMotion ? 0 : this.dolly,
    };
  }
}

export function useInteractionDriver(nodeCount: number): InteractionDriver {
  return useMemo(() => new InteractionDriver(nodeCount), [nodeCount]);
}
