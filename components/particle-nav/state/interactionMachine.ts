/**
 * Interaction state machine (brief §7). Hand-rolled store — no dependency,
 * no global state; one instance per mounted nav.
 *
 * The only input surface is DOM events on the server-rendered <a> links, so
 * keyboard focus produces bit-identical state to pointer hover by construction.
 * The machine is discrete; useInteraction smooths it into eased GPU uniforms.
 */

export type InteractionState =
  | { kind: 'idle' }
  | { kind: 'hover'; nodeIndex: number; since: number }
  | { kind: 'activating'; nodeIndex: number; since: number };

export interface InteractionSnapshot {
  state: InteractionState;
  /** Last hovered node — the return animation eases away from it after unhover. */
  lastNodeIndex: number;
  reducedMotion: boolean;
}

type Listener = (snap: InteractionSnapshot) => void;

export class InteractionMachine {
  private snap: InteractionSnapshot = {
    state: { kind: 'idle' },
    lastNodeIndex: 0,
    reducedMotion: false,
  };
  private listeners = new Set<Listener>();

  get current(): InteractionSnapshot {
    return this.snap;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(state: InteractionState, lastNodeIndex = this.snap.lastNodeIndex): void {
    this.snap = { ...this.snap, state, lastNodeIndex };
    for (const fn of this.listeners) fn(this.snap);
  }

  setReducedMotion(reduced: boolean): void {
    this.snap = { ...this.snap, reducedMotion: reduced };
    for (const fn of this.listeners) fn(this.snap);
  }

  /** pointerenter and focus dispatch identically (brief §9 keyboard parity). */
  hover(nodeIndex: number): void {
    if (this.snap.state.kind === 'activating') return;
    this.set({ kind: 'hover', nodeIndex, since: performance.now() }, nodeIndex);
  }

  /** pointerleave and blur dispatch identically. */
  unhover(nodeIndex: number): void {
    const s = this.snap.state;
    if (s.kind === 'hover' && s.nodeIndex === nodeIndex) {
      this.set({ kind: 'idle' });
    }
  }

  /**
   * Activation is visual-only here: the caller schedules router.push at
   * NAVIGATE_AT_MS independently. Navigation never waits for this machine.
   */
  activate(nodeIndex: number): void {
    this.set({ kind: 'activating', nodeIndex, since: performance.now() }, nodeIndex);
  }

  reset(): void {
    this.set({ kind: 'idle' });
  }
}
