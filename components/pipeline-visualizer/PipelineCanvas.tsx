"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import type {
  SimulationPacket,
  ViewPerspective,
  NodeCategory,
} from "./types";
import { PIPELINE_NODES } from "./data/nodes";
import { PIPELINE_EDGES } from "./data/edges";
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

   The twelve emoji that used to ride alongside these labels are gone. Each one
   sat next to a Hebrew word that already named the kind, so they carried no
   information the badge did not already carry, and a row of pictograms is the
   wrong register for a page describing an evidence pipeline. What distinguishes
   the kinds visually is `data-kind`, which the stylesheet reads. */
const KIND_META: Record<string, { label: string }> = {
  source: { label: "מקור מידע" },
  table: { label: "טבלת מסד" },
  view: { label: "היטל קריאה" },
  guard: { label: "מחסום אבטחה" },
  trigger: { label: "טריגר SQL" },
  cron: { label: "מתזמן אוטומטי" },
  queue: { label: "תור הודעות" },
  connector: { label: "מחבר נתונים" },
  service: { label: "שירות ליבה" },
  model: { label: "מודל שפה (AI)" },
  gateway: { label: "שער AI" },
  storage: { label: "אחסון ענן (Blob)" },
};

const BASE_LANES = [
  {
    id: "ingest",
    titleHe: "1. איסוף ואחסון גולמי",
    titleEn: "Ingestion & Raw Blob",
    descHe: "לכידת עמודי מקור, חישוב חתימת SHA-256 ומניעת כפילויות",
    laneIndex: 0,
  },
  {
    id: "evidence",
    titleHe: "2. מאגר ראיות וטענות",
    titleEn: "Evidence & Claims",
    descHe: "רישום פריטי מידע, הצלבת עובדות ושובל ייחוס ראייתי",
    laneIndex: 1,
  },
  {
    id: "model",
    titleHe: "3. מנוע אימות ושער פרסום",
    titleEn: "Verification & Gate",
    descHe: "מנוע חוקים טהור ושער 2 בני אדם לפני פרסום לציבור",
    laneIndex: 2,
  },
  {
    id: "briefing",
    titleHe: "4. צינור בריף אוטומטי",
    titleEn: "Daily Brief Machine",
    descHe: "איסוף, אשכול, סינון, ניסוח ו־17 בדיקות איכות ב־07:00",
    laneIndex: 3,
  },
  {
    id: "search",
    titleHe: "5. חיפוש ואינדוקס",
    titleEn: "Search & Outbox",
    descHe: "תיבת יוצא, אינדוקס רב-לשוני והטמעות וקטוריות",
    laneIndex: 4,
  },
  {
    id: "ai",
    titleHe: "6. שער AI וצ'אט מודיעיני",
    titleEn: "AI Gateway & Chat",
    descHe: "תשובות מעוגנות מסמכים ושומר ציטוטים למניעת הזיות",
    laneIndex: 5,
  },
  {
    id: "infra",
    titleHe: "7. משילות, RLS וציבור",
    titleEn: "Governance & Public",
    descHe: "אבטחת שורות במסד (RLS), הגבלת קצב ודיווחי ציבור",
    laneIndex: 6,
  },
];

const BASE_NODE_POSITIONS: Record<string, { laneIdx: number; rowIdx: number }> = {
  /* Lane 0: Ingest */
  family: { laneIdx: 0, rowIdx: 0 },
  source: { laneIdx: 0, rowIdx: 1 },
  cron_ingest: { laneIdx: 0, rowIdx: 2 },
  connector: { laneIdx: 0, rowIdx: 3 },
  blob_storage: { laneIdx: 0, rowIdx: 4 },
  source_fetch: { laneIdx: 0, rowIdx: 5 },
  evidence_discovery: { laneIdx: 0, rowIdx: 6 },

  /* Lane 1: Evidence */
  evidence: { laneIdx: 1, rowIdx: 0.5 },
  evidence_provenance: { laneIdx: 1, rowIdx: 1.8 },
  status_axes: { laneIdx: 1, rowIdx: 3.1 },
  item: { laneIdx: 1, rowIdx: 4.4 },
  item_evidence: { laneIdx: 1, rowIdx: 5.7 },

  /* Lane 2: Verification */
  verdict_rules: { laneIdx: 2, rowIdx: 0.5 },
  item_assessment: { laneIdx: 2, rowIdx: 1.8 },
  review_queue: { laneIdx: 2, rowIdx: 3.1 },
  enforce_publish_gate: { laneIdx: 2, rowIdx: 4.4 },
  published_item_view: { laneIdx: 2, rowIdx: 5.7 },

  /* Lane 3: Briefing */
  cron_briefing: { laneIdx: 3, rowIdx: 0 },
  briefing_collect_q: { laneIdx: 3, rowIdx: 0.9 },
  briefing_enrich_q: { laneIdx: 3, rowIdx: 1.8 },
  briefing_cluster_q: { laneIdx: 3, rowIdx: 2.7 },
  briefing_triage_model: { laneIdx: 3, rowIdx: 3.6 },
  briefing_draft_model: { laneIdx: 3, rowIdx: 4.5 },
  briefing_quality_gate: { laneIdx: 3, rowIdx: 5.4 },
  briefing_quarantine: { laneIdx: 3, rowIdx: 6.3 },
  briefing_alert: { laneIdx: 3, rowIdx: 7.2 },

  /* Lane 4: Search */
  outbox: { laneIdx: 4, rowIdx: 0 },
  cron_outbox_drain: { laneIdx: 4, rowIdx: 1 },
  outbox_dispatch_q: { laneIdx: 4, rowIdx: 2 },
  search_document: { laneIdx: 4, rowIdx: 3 },
  cron_embed: { laneIdx: 4, rowIdx: 4 },
  search_hybrid: { laneIdx: 4, rowIdx: 5 },
  rrf_fusion: { laneIdx: 4, rowIdx: 6 },

  /* Lane 5: AI & Chat */
  ai_gateway: { laneIdx: 5, rowIdx: 0 },
  ai_run_ledger: { laneIdx: 5, rowIdx: 1 },
  ai_suggestion: { laneIdx: 5, rowIdx: 2 },
  human_approval_gate: { laneIdx: 5, rowIdx: 3 },
  chat_thread: { laneIdx: 5, rowIdx: 4 },
  chat_tool_run: { laneIdx: 5, rowIdx: 5 },
  citation_guard: { laneIdx: 5, rowIdx: 6 },

  /* Lane 6: Governance */
  publication: { laneIdx: 6, rowIdx: 0 },
  rls_policy: { laneIdx: 6, rowIdx: 1 },
  entity_version: { laneIdx: 6, rowIdx: 2 },
  audit_log: { laneIdx: 6, rowIdx: 3 },
  rate_limit_guard: { laneIdx: 6, rowIdx: 4 },
  public_reports: { laneIdx: 6, rowIdx: 5 },
  briefing_control: { laneIdx: 6, rowIdx: 6 },
};

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
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Custom dragged positions override
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Filter visible nodes based on category / perspective
  const visibleNodes = useMemo(() => {
    return PIPELINE_NODES.filter((n) => {
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

  // Handle Wheel: Normal scrolling pans vertically/horizontally. Ctrl/Cmd+Wheel zooms.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((prev) => Math.max(0.3, Math.min(2.5, prev * zoomFactor)));
    } else {
      // Natural pan without scroll trapping
      setPan((prev) => ({
        x: prev.x - (e.shiftKey ? e.deltaY : e.deltaX),
        y: prev.y - (e.shiftKey ? 0 : e.deltaY),
      }));
    }
  }, []);

  // Pan start on background
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== containerRef.current && !(e.target as HTMLElement).classList.contains(styles.canvasPlane)) {
      return;
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  // Pan & Card Drag Move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (draggingNodeId) {
      const newX = (e.clientX - pan.x) / zoom - dragOffset.x;
      const newY = (e.clientY - pan.y) / zoom - dragOffset.y;

      setCustomPositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: Math.max(10, newX),
          y: Math.max(10, newY),
        },
      }));
    }
  }, [isPanning, panStart, draggingNodeId, pan, zoom, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNodeId(null);
  }, []);

  // Card Drag Start
  const handleCardMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const layout = nodeLayouts[nodeId];
    if (!layout) return;

    const mouseCanvasX = (e.clientX - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - pan.y) / zoom;

    setDraggingNodeId(nodeId);
    setDragOffset({
      x: mouseCanvasX - layout.x,
      y: mouseCanvasY - layout.y,
    });
  }, [nodeLayouts, pan, zoom]);

  // Reset custom card positions
  const resetCardPositions = () => {
    setCustomPositions({});
  };

  return (
    <div
      ref={containerRef}
      className={styles.interactiveCanvasContainer}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      dir="ltr"
    >
      {/* ── Top Floating Canvas Toolbar ── */}
      <div className={styles.canvasFloatingToolbar} dir="rtl">
        {/* Zoom Controls */}
        <div className={styles.toolbarButtonGroup}>
          <button
            type="button"
            className={styles.canvasToolBtn}
            onClick={() => setZoom((z) => Math.min(2.5, z * 1.2))}
            title="הגדל תצוגה"
          >
            + הגדל
          </button>
          <span className={styles.zoomPercentageBadge}>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className={styles.canvasToolBtn}
            onClick={() => setZoom((z) => Math.max(0.3, z * 0.8))}
            title="הקטן תצוגה"
          >
            − הקטן
          </button>
          <button
            type="button"
            className={styles.canvasToolBtn}
            onClick={() => {
              setZoom(0.7);
              setPan({ x: 30, y: 30 });
            }}
            title="איפוס גודל ומיקום"
          >
            ↺ איפוס 100%
          </button>
          <button
            type="button"
            className={styles.canvasToolBtn}
            onClick={() => {
              setZoom(0.48);
              setPan({ x: 10, y: 10 });
            }}
            title="התאם את כל המערכת למסך"
          >
            התאם הכל
          </button>
        </div>

        {/* Spacing Controls (הרחקה וריווח קופסאות) */}
        <div className={styles.toolbarButtonGroup}>
          <span className={styles.toolbarGroupLabel}>ריווח קופסאות:</span>
          <button
            type="button"
            className={`
              ${styles.canvasToolBtn}
              ${spacingMultiplier === 1.0 ? styles.canvasToolBtnActive : ""}
            `}
            onClick={() => setSpacingMultiplier(1.0)}
          >
            צפוף
          </button>
          <button
            type="button"
            className={`
              ${styles.canvasToolBtn}
              ${spacingMultiplier === 1.3 ? styles.canvasToolBtnActive : ""}
            `}
            onClick={() => setSpacingMultiplier(1.3)}
          >
            מרווח (רגיל)
          </button>
          <button
            type="button"
            className={`
              ${styles.canvasToolBtn}
              ${spacingMultiplier === 1.8 ? styles.canvasToolBtnActive : ""}
            `}
            onClick={() => setSpacingMultiplier(1.8)}
          >
            רחב במיוחד ↔
          </button>
          {Object.keys(customPositions).length > 0 && (
            <button
              type="button"
              className={styles.canvasToolBtn}
              onClick={resetCardPositions}
              title="החזר את כל הקופסאות לסידור האוטומטי"
            >
              סדר מחדש
            </button>
          )}
        </div>

        <div className={styles.canvasToolbarHint}>
          גלילת עכבר מזיזה את המפה | החזק Ctrl/Cmd עם גלגלת לזום | לחץ וגרור כרטיסיות לשינוי מיקום
        </div>
      </div>

      {/* ── Transformable Canvas Plane ── */}
      <div
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
            dir="rtl"
          >
            <div className={styles.htmlLaneHeader}>
              <div className={styles.htmlLaneBadgeRow}>
                <span className={styles.htmlLaneBadge}>מסלול {lane.laneIndex + 1}</span>
              </div>
              <h4 className={styles.htmlLaneTitleHe}>{lane.titleHe}</h4>
              <span className={styles.htmlLaneTitleEn} dir="ltr">
                {lane.titleEn}
              </span>
              <p className={styles.htmlLaneDesc}>{lane.descHe}</p>
            </div>
          </div>
        ))}

        {/* ── SVG Connection Overlay Layer (Cubic Bezier Edges & Traveling Packets) ── */}
        <svg
          className={styles.htmlSvgOverlay}
          style={{ width: `${totalCanvasWidth}px`, height: `${totalCanvasHeight}px` }}
          fill="none"
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
                  className={`
                    ${styles.edgePath}
                    ${isEdgeActive ? styles.edgePathActive : ""}
                    ${edge.isQuarantine ? styles.edgePathQuarantine : ""}
                  `}
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
          const kindMeta = KIND_META[node.kind] ?? { label: node.kind };

          return (
            <div
              key={node.id}
              className={`
                ${styles.htmlNodeCard}
                ${isActive ? styles.htmlNodeCardActive : ""}
                ${isSelected ? styles.htmlNodeCardSelected : ""}
                ${isQuarantined ? styles.htmlNodeCardQuarantined : ""}
                ${draggingNodeId === node.id ? styles.htmlNodeCardDragging : ""}
              `}
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
              onMouseDown={(e) => handleCardMouseDown(e, node.id)}
              onClick={() => onSelectNode(node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectNode(node.id);
                }
              }}
              dir="rtl"
            >
              {/* Top Row: Kind Badge in Hebrew & Active Pulse */}
              <div className={styles.htmlCardTopRow}>
                <span className={styles.htmlKindBadge}>{kindMeta.label}</span>

                <div className={styles.htmlCardActions}>
                  {node.terms.length > 0 && (
                    <button
                      type="button"
                      className={styles.cardGlossaryBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenGlossary(node.nameEn);
                      }}
                      title="לחץ להסבר מונח במילון"
                    >
                      ? הסבר
                    </button>
                  )}
                  {isActive && <span className={styles.activePulseDot} />}
                </div>
              </div>

              {/* Main Hebrew Title */}
              <h5 className={styles.htmlNodeTitleHe}>{node.nameHe}</h5>

              {/* Technical English identifier with code badge */}
              <div className={styles.htmlNodeTitleEnRow}>
                <code className={styles.htmlCodeBadge} dir="ltr">
                  {node.nameEn}
                </code>
                {node.dbTable && (
                  <span className={styles.htmlTablePill} dir="ltr">
                    {node.dbTable}
                  </span>
                )}
              </div>

              {/* Clear Summary in Hebrew */}
              <p className={styles.htmlNodeSnippet}>
                {node.what.length > 70 ? node.what.substring(0, 70) + "…" : node.what}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
