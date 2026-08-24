"use client";

/**
 * The one source of navigation state.
 *
 * There are no routes yet, so `activeSection` is set locally. When routes
 * arrive it is derived from the pathname instead and this is the only file
 * that changes — no graphic reads a URL, and none should learn to.
 *
 * It is a plain store rather than React state because the WebGL layer reads it
 * every frame. Driving a sixty-times-a-second render loop through re-renders
 * would put React on the hot path for a pointer moving across a ring.
 */

import { useSyncExternalStore } from "react";
import type { SectionId } from "./sections";

export interface NavigationSnapshot {
  activeSection: SectionId | null;
  hoveredSection: SectionId | null;
  focusedSection: SectionId | null;
  /** Set for the duration of a section transfer; `from` is null on first open. */
  transition: {
    from: SectionId | null;
    to: SectionId | null;
    startedAt: number;
  } | null;
}

/** Where the lion is asked to sit when the navigation is merely present. */
export const RECESSION_AT_REST = 0.35;
/** And when a section has been opened and the mark takes the centre. */
export const RECESSION_ACTIVE = 1;

/** How long a section transfer takes. Inside GRAPHIC 08's 700–1100ms band. */
export const TRANSFER_MS = 900;

export class NavigationStore {
  private listeners = new Set<() => void>();
  private snapshot: NavigationSnapshot = {
    activeSection: null,
    hoveredSection: null,
    focusedSection: null,
    transition: null,
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): NavigationSnapshot => this.snapshot;

  private commit(next: Partial<NavigationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }

  setHovered(id: SectionId | null) {
    if (this.snapshot.hoveredSection === id) return;
    this.commit({ hoveredSection: id });
  }

  setFocused(id: SectionId | null) {
    if (this.snapshot.focusedSection === id) return;
    this.commit({ focusedSection: id });
  }

  /**
   * Open a section, or close it by choosing the one already open.
   *
   * A transfer already in flight is re-targeted rather than restarted: its
   * particles keep the position they have reached, which is what stops a
   * quick second click from snapping everything back to a node.
   */
  activate(id: SectionId | null) {
    const current = this.snapshot.activeSection;
    const next = current === id ? null : id;
    if (next === current) return;
    this.commit({
      activeSection: next,
      transition: { from: current, to: next, startedAt: performance.now() },
    });
  }

  /** Called by the render loop once a transfer's particles have arrived. */
  settle() {
    if (!this.snapshot.transition) return;
    this.commit({ transition: null });
  }
}

/** Read the store from React. Used by the DOM navigation, not by the shaders. */
export function useNavigation(store: NavigationStore): NavigationSnapshot {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

/** What the background is told, given the current state. */
export function recessionFor(snapshot: NavigationSnapshot): number {
  return snapshot.activeSection ? RECESSION_ACTIVE : RECESSION_AT_REST;
}
