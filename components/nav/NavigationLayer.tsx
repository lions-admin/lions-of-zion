"use client";

/**
 * The navigation, as HTML, with the generative layer drawn over it.
 *
 * The order matters and is not stylistic. This component renders a real `<nav>`
 * of real buttons, positioned by the same polar math the ring geometry uses,
 * and *then* mounts a canvas on top. Remove the canvas — a device on the
 * fallback tier, a GPU that will not give a context, a first paint before the
 * scene has built — and what is left is still a navigable list of controls.
 * The particles are how it looks; they were never how it works.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Viewport,
  worldToScreenIn,
  type ViewportSnapshot,
} from "@/components/graphics/viewport";
import { NavScene } from "./nav-scene";
import {
  PANEL,
  computeNavLayout,
  panelModeFor,
  type NavLayout,
  type PanelMode,
} from "./ring-geometry";
import {
  NavigationStore,
  recessionFor,
  useNavigation,
} from "./navigation-state";
import { SECTIONS, sectionById, type SectionId } from "./sections";
import styles from "./navigation-layer.module.css";

export interface NavigationLayerProps {
  /** Where the layer sends what it needs from the scene beneath it. */
  onRecession?: (value: number) => void;
}

interface PlacedNode {
  id: SectionId;
  index: number;
  x: number;
  y: number;
  diameter: number;
  /** The same node once a panel has taken part of the frame. */
  openX: number;
  openY: number;
  openDiameter: number;
  /** Which way the label leans, so it always sits outside the ring. */
  align: "left" | "right" | "top" | "bottom";
}

export default function NavigationLayer({ onRecession }: NavigationLayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const buttonsRef = useRef(new Map<SectionId, HTMLButtonElement>());

  const sceneRef = useRef<NavScene | null>(null);
  const store = useMemo(() => new NavigationStore(), []);
  const state = useNavigation(store);

  const [placed, setPlaced] = useState<PlacedNode[]>([]);
  const [tier, setTier] = useState<ViewportSnapshot["tier"]>("high");
  const [panelMode, setPanelMode] = useState<PanelMode>("side");
  const [compact, setCompact] = useState(false);
  const placedRef = useRef<PlacedNode[]>([]);
  const itemsRef = useRef(new Map<SectionId, HTMLLIElement>());

  /* The render loop reads the store directly rather than a React snapshot: the
     store is already the source, and going through a render would put React on
     the hot path for a pointer crossing a ring. */
  const recessionRef = useRef(onRecession);
  useEffect(() => {
    recessionRef.current = onRecession;
  }, [onRecession]);

  const place = useCallback(
    (closed: NavLayout, open: NavLayout, snapshot: ViewportSnapshot) => {
      const toPx = (world: number) => (world / snapshot.halfW) * snapshot.width;
      setTier(snapshot.tier);
      setPanelMode(panelModeFor(snapshot.aspect));
      setCompact(closed.compact);
      const next = closed.nodes.map((node, i) => {
        const screen = worldToScreenIn(snapshot, node.x, node.y);
        const openNode = open.nodes[i];
        const openScreen = worldToScreenIn(snapshot, openNode.x, openNode.y);
        const dx = node.x - closed.centerX;
        const dy = node.y - closed.centerY;
        const align =
          Math.abs(dx) < closed.radiusX * 0.35
            ? dy >= 0
              ? "top"
              : "bottom"
            : dx > 0
              ? "right"
              : "left";
        return {
          id: node.id,
          index: node.index,
          x: screen.x,
          y: screen.y,
          diameter: toPx(closed.nodeRadius),
          openX: openScreen.x,
          openY: openScreen.y,
          openDiameter: toPx(open.nodeRadius),
          align,
        } satisfies PlacedNode;
      });
      placedRef.current = next;
      setPlaced(next);
    },
    [],
  );

  /* The stylesheet is told the panel's footprint rather than declaring its
     own, so the ring's fit and the panel's size cannot disagree. */
  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    element.style.setProperty("--panel-side", `${PANEL.sideWidth * 100}%`);
    element.style.setProperty("--panel-sheet", `${PANEL.sheetHeight * 100}%`);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap) return;

    const viewport = new Viewport();
    const stopViewport = viewport.observe(wrap);

    // No GPU, no canvas. The nav below is the navigation either way.
    if (!canvas || viewport.current.tier === "fallback") {
      const unsubscribe = viewport.subscribe((snapshot) => {
        place(
          computeNavLayout(snapshot, false),
          computeNavLayout(snapshot, true),
          snapshot,
        );
      });
      return () => {
        unsubscribe();
        stopViewport();
      };
    }

    let scene: NavScene | null = null;
    try {
      scene = new NavScene(
        {
          canvas,
          getState: store.getSnapshot,
          onRecession: (value) => recessionRef.current?.(value),
          onLayout: place,
          getPanelRect: () =>
            panelRef.current?.getBoundingClientRect() ?? null,
          /* The DOM travels on exactly the value the shader travels on, so
             the focusable circle and the drawn circle stay coincident. */
          onOpen: (t) => {
            for (const node of placedRef.current) {
              const element = itemsRef.current.get(node.id);
              if (!element) continue;
              const x = node.x + (node.openX - node.x) * t;
              const y = node.y + (node.openY - node.y) * t;
              const d = node.diameter + (node.openDiameter - node.diameter) * t;
              element.style.transform = `translate(-50%, -50%) translate(${
                x - node.x
              }px, ${y - node.y}px)`;
              element.style.setProperty("--node-size", `${d.toFixed(2)}px`);
            }
          },
        },
        viewport.current,
      );
      scene.start();
    } catch (error) {
      console.warn("Navigation layer falling back to HTML only", error);
      scene = null;
      canvas.style.display = "none";
    }

    const unsubscribe = viewport.subscribe((snapshot) => {
      if (scene) scene.resize(snapshot);
      else
        place(
          computeNavLayout(snapshot, false),
          computeNavLayout(snapshot, true),
          snapshot,
        );
    });

    sceneRef.current = scene;

    return () => {
      sceneRef.current = null;
      unsubscribe();
      stopViewport();
      scene?.dispose();
    };
  }, [place, store]);

  /* The background is told what to do here rather than inside the render loop
     when there is no loop to speak of. */
  useEffect(() => {
    if (sceneRef.current) return;
    onRecession?.(recessionFor(state));
  }, [state, onRecession]);

  const activate = useCallback(
    (id: SectionId) => {
      const opening = store.getSnapshot().activeSection !== id;
      store.activate(id);
      if (opening) {
        sceneRef.current?.burst(SECTIONS.findIndex((s) => s.id === id));
      }
    },
    [store],
  );

  /* Arrow keys walk the ring. Home and End jump to its ends, Escape closes. */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      const step =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : 0;

      let next = -1;
      if (step !== 0) {
        next = (index + step + SECTIONS.length) % SECTIONS.length;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = SECTIONS.length - 1;
      } else if (event.key === "Escape") {
        if (store.getSnapshot().activeSection) {
          event.preventDefault();
          store.activate(store.getSnapshot().activeSection);
        }
        return;
      } else {
        return;
      }

      event.preventDefault();
      buttonsRef.current.get(SECTIONS[next].id)?.focus();
    },
    [store],
  );

  const active = state.activeSection ? sectionById(state.activeSection) : null;

  return (
    <div
      ref={wrapRef}
      className={`${styles.layer} ${tier === "fallback" ? styles.fallback : ""}`}
      data-panel={panelMode}
      data-compact={compact}
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.brand}>
          <MarkGlyph className={styles.brandMark} />
          <span className={styles.brandWord}>Lions of Zion</span>
        </div>
        <div className={styles.headerControls}>
          {/* Nothing behind these yet. A control that looks live and does
              nothing is worse than one that says so. */}
          <button
            type="button"
            className={styles.headerButton}
            disabled
            title="Search is not available yet"
          >
            <SearchGlyph />
            <span className={styles.srOnly}>Search — not available yet</span>
          </button>
          <span className={styles.language} aria-disabled="true">
            EN <span aria-hidden="true">/</span>{" "}
            <span className={styles.languageOff}>HE</span>
          </span>
          <button
            type="button"
            className={styles.cta}
            disabled
            title="Sharing is not available yet"
          >
            Share the Truth
          </button>
        </div>
      </header>

      <nav className={styles.nav} aria-label="Sections">
        <ul className={styles.nodeList}>
          {placed.map((node) => {
            const section = sectionById(node.id);
            const isActive = state.activeSection === node.id;
            return (
              <li
                key={node.id}
                ref={(element) => {
                  if (element) itemsRef.current.set(node.id, element);
                  else itemsRef.current.delete(node.id);
                }}
                className={styles.nodeItem}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  ["--node-size" as string]: `${node.diameter}px`,
                }}
              >
                <button
                  type="button"
                  ref={(element) => {
                    if (element) buttonsRef.current.set(node.id, element);
                    else buttonsRef.current.delete(node.id);
                  }}
                  className={styles.node}
                  data-active={isActive}
                  data-align={node.align}
                  aria-expanded={isActive}
                  aria-controls="nav-panel"
                  onPointerEnter={() => store.setHovered(node.id)}
                  onPointerLeave={() => store.setHovered(null)}
                  onFocus={() => store.setFocused(node.id)}
                  onBlur={() => store.setFocused(null)}
                  onClick={() => activate(node.id)}
                  onKeyDown={(event) => onKeyDown(event, node.index)}
                >
                  <span className={styles.nodeMark} aria-hidden="true" />
                  <span className={styles.labelBlock}>
                    <span className={styles.label}>{section.label}</span>
                    <span className={styles.blurb}>
                      {section.blurb[0]}
                      <br />
                      {section.blurb[1]}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section
        id="nav-panel"
        ref={panelRef}
        className={styles.panel}
        hidden={!active}
        aria-label={active ? `${active.label} — section detail` : undefined}
      >
        {active ? (
          <>
            <button
              type="button"
              className={styles.panelClose}
              onClick={() => store.activate(active.id)}
            >
              Close
            </button>
            <p className={styles.eyebrow}>You are exploring</p>
            <h2 className={styles.panelTitle}>{active.label}</h2>
            <p className={styles.panelBlurb}>
              {active.blurb[0]} {active.blurb[1]}
            </p>
            <ul className={styles.entries}>
              {active.entries.map((entry) => (
                /* Text, not links. There is nowhere for them to go yet, and a
                   list of dead links would be a worse lie than a plain list. */
                <li key={entry.label} className={styles.entry}>
                  <span className={styles.entryLabel}>{entry.label}</span>
                  <span className={styles.entryHint}>{entry.hint}</span>
                </li>
              ))}
            </ul>
            <p className={styles.panelFoot}>
              Truth has a signal. These sections have no content yet.
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}

/* Two small glyphs the header needs. Everything else in this layer is drawn by
   the generative system; these exist because header chrome has to survive the
   canvas being absent. */

function MarkGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        d="M24 3.4 36.6 8.6 43 20.4 38.4 34.6 24 44.6 9.6 34.6 5 20.4 11.4 8.6Z
           M24 11.6c7.2 0 11.4 5.2 11.4 11.4 0 8-5.2 13.2-11.4 15.4
           -6.2-2.2-11.4-7.4-11.4-15.4 0-6.2 4.2-11.4 11.4-11.4Z
           M18.2 21.8h3.6 M26.2 21.8h3.6
           M24 26.8 21.4 29.8 24 32l2.6-2.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle
        cx="10.4"
        cy="10.4"
        r="6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M15 15 20.6 20.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
