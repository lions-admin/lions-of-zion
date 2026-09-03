"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import type {
  SimulationPacket,
  ViewPerspective,
  NodeCategory,
} from "./types";
import { BASE_NODE_POSITIONS, NODES_IN_DIAGRAM_ORDER } from "./data/layout";
import { PIPELINE_EDGES } from "./data/edges";
import { CHROME, LANE_COPY, kindLabel, nodeInspectorCopy } from "./copy";
import styles from "./visualizer.module.css";

interface PipelineCanvasProps {
  activeNodeId: string | null;
  nextStepNodeId: string | null;
  activePackets: SimulationPacket[];
  selectedNodeId: string | null;
  viewPerspective: ViewPerspective;
  activeCategoryFilter: NodeCategory | "all";
  onSelectNode: (nodeId: string) => void;
  onOpenGlossary: (term?: string) => void;
}

interface NodeLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* Kind colour lives in the stylesheet, keyed by `data-kind`, on the semantic
   ramps — not here as twelve neon literals.

   Kind labels used to sit next to pictograms. The pictograms carried no
   information the badge did not already carry. What distinguishes the kinds
   visually is `data-kind`, which the stylesheet reads. */
const BASE_LANES = LANE_COPY;

/* Below this a pointer press is a click, not a drag. Without it every tap
   on a touch screen registered as a one-pixel card drag, and a deliberate
   drag also fired the card's click and opened the inspector on release. */
const DRAG_THRESHOLD_PX = 4;

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.5;

function getBezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const cx = 3 * (p1.x - p0.x);
  const bx = 3 * (p2.x - p1.x) - cx;
  const ax = p3.x - p0.x - cx - bx;

  const cy = 3 * (p1.y - p0.y);
  const by = 3 * (p2.y - p1.y) - cy;
  const ay = p3.y - p0.y - cy - by;

  const xt = ax * Math.pow(t, 3) + bx * Math.pow(t, 2) + cx * t + p0.x;
  const yt = ay * Math.pow(t, 3) + by * Math.pow(t, 2) + cy * t + p0.y;

  return { x: xt, y: yt };
}

export function PipelineCanvas({
  activeNodeId,
  nextStepNodeId,
  activePackets,
  selectedNodeId,
  viewPerspective,
  activeCategoryFilter,
  onSelectNode,
  onOpenGlossary,
}: PipelineCanvasProps) {
  // Spacing mode: 1 = standard, 1.4 = spacious, 1.9 = ultra-spacious
  const [spacingMultiplier, setSpacingMultiplier] = useState<number>(1.3);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(0.7);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 30, y: 30 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Custom dragged positions override
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pendingDragRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const dragMovedRef = useRef<boolean>(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const planeRef = useRef<HTMLDivElement | null>(null);
  const hasAutoFitRef = useRef<boolean>(false);

  // Calculate dynamic lane positions based on spacing multiplier
  const laneWidth = 350;
  const laneGap = 90 * spacingMultiplier;
  const rowHeight = 125 * spacingMultiplier;
  const cardWidth = 310;
  const cardHeight = 105;

  const computedLanes = useMemo(() => {
    return BASE_LANES.map((lane) => {
      const x = 50 + lane.laneIndex * (laneWidth + laneGap);
      return {
        ...lane,
        x,
        w: laneWidth,
      };
    });
  }, [laneGap]);

  // Compute node layouts with spacing multiplier
  const nodeLayouts = useMemo<Record<string, NodeLayout>>(() => {
    const map: Record<string, NodeLayout> = {};

    for (const [nodeId, pos] of Object.entries(BASE_NODE_POSITIONS)) {
      if (customPositions[nodeId]) {
        map[nodeId] = {
          x: customPositions[nodeId].x,
          y: customPositions[nodeId].y,
          w: cardWidth,
          h: cardHeight,
        };
        continue;
      }

      const laneX = 50 + pos.laneIdx * (laneWidth + laneGap);
      const cardX = laneX + (laneWidth - cardWidth) / 2;
      const cardY = 160 + pos.rowIdx * rowHeight;

      map[nodeId] = {
        x: cardX,
        y: cardY,
        w: cardWidth,
        h: cardHeight,
      };
    }

    return map;
  }, [laneGap, rowHeight, customPositions]);

  // Total canvas dimensions
  const totalCanvasWidth = Math.max(3400, 7 * (laneWidth + laneGap) + 200);
  const totalCanvasHeight = Math.max(1600, 9 * rowHeight + 300);

  /* What "fit" actually has to fit. Measured from the lanes and the cards
     rather than assumed, so a dragged card cannot end up outside the frame
     the fit control claims covers everything. */
  const contentBounds = useMemo(() => {
    let right = 0;
    let bottom = 0;
    for (const lane of computedLanes) right = Math.max(right, lane.x + lane.w);
    for (const layout of Object.values(nodeLayouts)) {
      right = Math.max(right, layout.x + layout.w);
      bottom = Math.max(bottom, layout.y + layout.h);
    }
    return { width: right + 50, height: Math.max(bottom, 400) + 50 };
  }, [computedLanes, nodeLayouts]);

  // Filter visible nodes based on category / perspective. Diagram order, so
  // the tab sequence walks the lanes the way the eye does.
  const visibleNodes = useMemo(() => {
    return NODES_IN_DIAGRAM_ORDER.filter((n) => {
      if (activeCategoryFilter !== "all" && n.cat !== activeCategoryFilter) {
        return false;
      }
      if (viewPerspective === "briefing") {
        return n.cat === "briefing" || n.cat === "ingest" || n.id === "ai_gateway" || n.id === "publication";
      }
      return true;
    });
  }, [activeCategoryFilter, viewPerspective]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return PIPELINE_EDGES.filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to));
  }, [visibleNodeIds]);

  const fitAll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { clientWidth, clientHeight } = viewport;
    if (clientWidth < 1 || clientHeight < 1) return;

    const scale = Math.max(
      MIN_ZOOM,
      Math.min(
        MAX_ZOOM,
        Math.min(clientWidth / contentBounds.width, clientHeight / contentBounds.height),
      ),
    );

    setZoom(scale);
    setPan({
      x: Math.max(0, (clientWidth - contentBounds.width * scale) / 2),
      y: Math.max(0, (clientHeight - contentBounds.height * scale) / 2),
    });
  }, [contentBounds]);

  /* The map region is `display: none` until the viewport can hold it, so
     there is no size to fit at mount. Wait for the first measurable box —
     which is also the moment a rotation or a resize brings the region into
     existence — and fit once. After that the view is the reader's. */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (hasAutoFitRef.current) return;
      if (viewport.clientWidth < 1 || viewport.clientHeight < 1) return;
      hasAutoFitRef.current = true;
      fitAll();
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitAll]);

  /* React registers root wheel listeners passively, so an `onWheel` prop
     cannot call `preventDefault` — Ctrl+wheel zoomed the diagram *and* the
     browser. A native non-passive listener is the only way to own it. */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.08 : 0.92;
        setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * factor)));
        return;
      }

      /* Plain scrolling pans. The map only exists inside a fixed-height
         stage, so there is no page scroll being stolen here. */
      event.preventDefault();
      setPan((prev) => ({
        x: prev.x - (event.shiftKey ? event.deltaY : event.deltaX),
        y: prev.y - (event.shiftKey ? 0 : event.deltaY),
      }));
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  /* Pointer events, not mouse events. The map is reachable on an iPad in
     landscape, where the old mouse-only handlers meant a 3400px plane with
     no way to move it at all. */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target !== viewportRef.current && target !== planeRef.current) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    const pending = pendingDragRef.current;
    if (pending && !draggingNodeId) {
      const moved =
        Math.abs(e.clientX - pending.x) + Math.abs(e.clientY - pending.y);
      if (moved < DRAG_THRESHOLD_PX) return;
      setDraggingNodeId(pending.nodeId);
      dragMovedRef.current = true;
    }

    const activeDrag = draggingNodeId ?? pendingDragRef.current?.nodeId;
    if (!activeDrag || !dragMovedRef.current) return;

    const rect = viewportRef.current?.getBoundingClientRect();
    const originX = rect ? rect.left : 0;
    const originY = rect ? rect.top : 0;
    const newX = (e.clientX - originX - pan.x) / zoom - dragOffsetRef.current.x;
    const newY = (e.clientY - originY - pan.y) / zoom - dragOffsetRef.current.y;

    setCustomPositions((prev) => ({
      ...prev,
      [activeDrag]: { x: Math.max(10, newX), y: Math.max(10, newY) },
    }));
  }, [isPanning, draggingNodeId, pan, zoom]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNodeId(null);
    pendingDragRef.current = null;
  }, []);

  const handleCardPointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    const layout = nodeLayouts[nodeId];
    if (!layout) return;

    const rect = viewportRef.current?.getBoundingClientRect();
    const originX = rect ? rect.left : 0;
    const originY = rect ? rect.top : 0;
    const pointerCanvasX = (e.clientX - originX - pan.x) / zoom;
    const pointerCanvasY = (e.clientY - originY - pan.y) / zoom;

    dragOffsetRef.current = {
      x: pointerCanvasX - layout.x,
      y: pointerCanvasY - layout.y,
    };
    dragMovedRef.current = false;
    pendingDragRef.current = { nodeId, x: e.clientX, y: e.clientY };
  }, [nodeLayouts, pan, zoom]);

  const handleCardClick = useCallback((nodeId: string) => {
    /* A completed drag ends in a click. Selecting the card the reader was
       only repositioning is not what they asked for. */
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    onSelectNode(nodeId);
  }, [onSelectNode]);

  const resetCardPositions = () => {
    setCustomPositions({});
  };

  return (
    <div className={styles.mapRegion}>
      {/* The toolbar used to float over the canvas, absolutely positioned
          against the top-right corner and free to wrap down over the
          diagram it controls. It is a region in the flow now: it takes the
          height it needs, scrolls sideways within itself when it cannot fit,
          and never covers content or leaves the viewport. */}
      <div className={styles.stageToolbar}>
        <div className={styles.toolbarButtonGroup} role="group" aria-label={CHROME.resetView}>
          <Button
            type="button"
            variant="toolbar"
            size="sm"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2))}
            title={CHROME.zoomIn}
            aria-label={CHROME.zoomIn}
          >
            <span aria-hidden="true">+</span>
          </Button>
          <span className={styles.zoomPercentageBadge}>{Math.round(zoom * 100)}%</span>
          <Button
            type="button"
            variant="toolbar"
            size="sm"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z * 0.8))}
            title={CHROME.zoomOut}
            aria-label={CHROME.zoomOut}
          >
            <span aria-hidden="true">−</span>
          </Button>
          <Button
            type="button"
            variant="toolbar"
            size="sm"
            onClick={() => {
              setZoom(0.7);
              setPan({ x: 30, y: 30 });
            }}
            title={CHROME.resetView}
          >
            {CHROME.resetView}
          </Button>
          <Button
            type="button"
            variant="toolbar"
            size="sm"
            onClick={fitAll}
            title={CHROME.fitAll}
          >
            {CHROME.fitAll}
          </Button>
        </div>

        <div className={styles.toolbarButtonGroup} role="group" aria-label={CHROME.spacing}>
          <span className={styles.toolbarGroupLabel}>{CHROME.spacing}</span>
          <Button
            type="button"
            variant="filter"
            size="sm"
            isActive={spacingMultiplier === 1.0}
            onClick={() => setSpacingMultiplier(1.0)}
          >
            {CHROME.compact}
          </Button>
          <Button
            type="button"
            variant="filter"
            size="sm"
            isActive={spacingMultiplier === 1.3}
            onClick={() => setSpacingMultiplier(1.3)}
          >
            {CHROME.comfortable}
          </Button>
          <Button
            type="button"
            variant="filter"
            size="sm"
            isActive={spacingMultiplier === 1.8}
            onClick={() => setSpacingMultiplier(1.8)}
          >
            {CHROME.extraWide}
          </Button>
          {Object.keys(customPositions).length > 0 && (
            <Button
              type="button"
              variant="toolbar"
              size="sm"
              onClick={resetCardPositions}
              title={CHROME.rearrangeTitle}
            >
              {CHROME.rearrange}
            </Button>
          )}
        </div>

        <p className={styles.canvasToolbarHint}>{CHROME.canvasPanHint}</p>
      </div>

      <div
        ref={viewportRef}
        className={styles.canvasViewport}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        data-panning={isPanning ? "" : undefined}
        dir="ltr"
      >
        {/* ── Transformable Canvas Plane ── */}
        <div
          ref={planeRef}
          className={styles.canvasPlane}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: `${totalCanvasWidth}px`,
            height: `${totalCanvasHeight}px`,
          }}
        >
          {/* ── Lanes Visual Columns ── */}
          {computedLanes.map((lane) => (
            <div
              key={lane.id}
              className={styles.htmlLaneColumn}
              style={{
                left: `${lane.x}px`,
                top: `20px`,
                width: `${lane.w}px`,
                height: `${totalCanvasHeight - 60}px`,
              }}
            >
              <div className={styles.htmlLaneHeader}>
                <div className={styles.htmlLaneBadgeRow}>
                  <span className={styles.htmlLaneBadge}>{CHROME.lane(lane.laneIndex + 1)}</span>
                </div>
                <h3 className={styles.htmlLaneTitleHe}>{lane.title}</h3>
                <p className={styles.htmlLaneDesc}>{lane.description}</p>
              </div>
            </div>
          ))}

          {/* ── SVG Connection Overlay Layer (Cubic Bezier Edges & Traveling Packets) ── */}
          <svg
            className={styles.htmlSvgOverlay}
            style={{ width: `${totalCanvasWidth}px`, height: `${totalCanvasHeight}px` }}
            fill="none"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Edges */}
            {visibleEdges.map((edge) => {
              const fromLayout = nodeLayouts[edge.from];
              const toLayout = nodeLayouts[edge.to];
              if (!fromLayout || !toLayout) return null;

              const isEdgeActive =
                (activeNodeId === edge.from && nextStepNodeId === edge.to) ||
                (activeNodeId === edge.to && nextStepNodeId === edge.from);

              let startX = fromLayout.x + fromLayout.w;
              let startY = fromLayout.y + fromLayout.h / 2;
              let endX = toLayout.x;
              let endY = toLayout.y + toLayout.h / 2;

              if (Math.abs(fromLayout.x - toLayout.x) < 70) {
                startX = fromLayout.x + fromLayout.w / 2;
                startY = fromLayout.y + fromLayout.h;
                endX = toLayout.x + toLayout.w / 2;
                endY = toLayout.y;
              }

              const dx = Math.abs(endX - startX) * 0.5;
              const dy = Math.abs(endY - startY) * 0.5;

              const p0 = { x: startX, y: startY };
              const p1 =
                Math.abs(fromLayout.x - toLayout.x) < 70
                  ? { x: startX, y: startY + dy }
                  : { x: startX + dx, y: startY };
              const p2 =
                Math.abs(fromLayout.x - toLayout.x) < 70
                  ? { x: endX, y: endY - dy }
                  : { x: endX - dx, y: endY };
              const p3 = { x: endX, y: endY };

              const d = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

              return (
                <g key={`${edge.from}->${edge.to}`}>
                  <path
                    d={d}
                    className={[
                      styles.edgePath,
                      isEdgeActive ? styles.edgePathActive : "",
                      edge.isQuarantine ? styles.edgePathQuarantine : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                </g>
              );
            })}

            {/* Dynamic Traveling Data Packets */}
            {activePackets.map((pkt) => {
              const fromLayout = nodeLayouts[pkt.fromNodeId];
              const toLayout = nodeLayouts[pkt.toNodeId];
              if (!fromLayout) return null;

              let startX = fromLayout.x + fromLayout.w;
              let startY = fromLayout.y + fromLayout.h / 2;
              let endX = toLayout ? toLayout.x : startX;
              let endY = toLayout ? toLayout.y + toLayout.h / 2 : startY;

              if (toLayout && Math.abs(fromLayout.x - toLayout.x) < 70) {
                startX = fromLayout.x + fromLayout.w / 2;
                startY = fromLayout.y + fromLayout.h;
                endX = toLayout.x + toLayout.w / 2;
                endY = toLayout.y;
              }

              const dx = Math.abs(endX - startX) * 0.5;
              const dy = Math.abs(endY - startY) * 0.5;

              const p0 = { x: startX, y: startY };
              const p1 =
                toLayout && Math.abs(fromLayout.x - toLayout.x) < 70
                  ? { x: startX, y: startY + dy }
                  : { x: startX + dx, y: startY };
              const p2 =
                toLayout && Math.abs(fromLayout.x - toLayout.x) < 70
                  ? { x: endX, y: endY - dy }
                  : { x: endX - dx, y: endY };
              const p3 = { x: endX, y: endY };

              const pos = getBezierPoint(p0, p1, p2, p3, pkt.progress);
              const isQuarantine = pkt.kind === "quarantine" || pkt.kind === "alert";

              return (
                <g key={pkt.id} transform={`translate(${pos.x}, ${pos.y})`}>
                  <circle
                    r={isQuarantine ? 10 : 9}
                    className={
                      isQuarantine ? styles.packetParticleQuarantine : styles.packetParticle
                    }
                  />
                  <circle
                    r={isQuarantine ? 18 : 16}
                    className={isQuarantine ? styles.packetRingQuarantine : styles.packetRing}
                  />
                </g>
              );
            })}
          </svg>

          {/* ── Rich HTML Node Cards ── */}
          {visibleNodes.map((node) => {
            const layout = nodeLayouts[node.id];
            if (!layout) return null;

            const isActive = activeNodeId === node.id;
            const isSelected = selectedNodeId === node.id;
            const isQuarantined = node.id === "briefing_quarantine" && isActive;
            const copy = nodeInspectorCopy(node.id);
            const snippet = copy?.what
              ? copy.what.length > 70
                ? copy.what.substring(0, 70) + "…"
                : copy.what
              : null;
            const showTablePill = Boolean(node.dbTable && node.dbTable !== node.nameEn);

            return (
              <div
                key={node.id}
                data-node-card={node.id}
                className={[
                  styles.htmlNodeCard,
                  isActive ? styles.htmlNodeCardActive : "",
                  isSelected ? styles.htmlNodeCardSelected : "",
                  isQuarantined ? styles.htmlNodeCardQuarantined : "",
                  draggingNodeId === node.id ? styles.htmlNodeCardDragging : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-kind={node.kind}
                style={{
                  left: `${layout.x}px`,
                  top: `${layout.y}px`,
                  width: `${layout.w}px`,
                  minHeight: `${layout.h}px`,
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onPointerDown={(e) => handleCardPointerDown(e, node.id)}
                onClick={() => handleCardClick(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectNode(node.id);
                  }
                }}
              >
                <div className={styles.htmlCardTopRow}>
                  <span className={styles.htmlKindBadge}>{kindLabel(node.kind)}</span>

                  <div className={styles.htmlCardActions}>
                    {node.terms.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className={styles.cardGlossaryBtn}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenGlossary(node.nameEn);
                        }}
                        title={CHROME.explainTitle}
                      >
                        {CHROME.explain}
                      </Button>
                    )}
                    {isActive && <span className={styles.activePulseDot} />}
                  </div>
                </div>

                <h4 className={styles.htmlNodeTitleHe}>{node.nameEn}</h4>

                {showTablePill && node.dbTable ? (
                  <div className={styles.htmlNodeTitleEnRow}>
                    <span className={styles.htmlTablePill} dir="ltr">
                      {node.dbTable}
                    </span>
                  </div>
                ) : null}

                {snippet ? <p className={styles.htmlNodeSnippet}>{snippet}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
