import type { PipelineNode } from "../types";
import { LANE_COPY } from "../copy";
import { PIPELINE_NODES } from "./nodes";

/**
 * Where each component sits in the seven-lane diagram.
 *
 * This used to live inside `PipelineCanvas`, which made the canvas the only
 * surface that knew the architecture's shape. The structure list needs the
 * same grouping — it is the reading of this diagram that works without
 * panning — so the coordinates moved here and both surfaces read them.
 *
 * `laneIdx` indexes `LANE_COPY`; `rowIdx` is a row in that lane, fractional
 * where a lane packs more rows than its neighbours.
 *
 * Note this is not `node.lane`. That field carries eight values including
 * `publish`, which has no lane column of its own — grouping the list by it
 * would quietly drop three components off the page. Grouping by the drawn
 * position is what keeps the list and the map showing the same 47 things.
 */
export const BASE_NODE_POSITIONS: Record<string, { laneIdx: number; rowIdx: number }> = {
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

export interface LaneGroup {
  id: string;
  laneIndex: number;
  title: string;
  description: string;
  nodes: PipelineNode[];
}

/**
 * Group nodes by drawn lane, in lane then row order.
 *
 * A component with no entry in `BASE_NODE_POSITIONS` is not dropped: it
 * lands in a trailing group of its own. The map cannot draw such a node, so
 * without this the list would be the only place it could appear and the two
 * surfaces would disagree about what the system contains.
 */
export function groupNodesByLane(nodes: readonly PipelineNode[]): LaneGroup[] {
  const groups: LaneGroup[] = LANE_COPY.map((lane) => ({
    id: lane.id,
    laneIndex: lane.laneIndex,
    title: lane.title,
    description: lane.description,
    nodes: [],
  }));

  const unplaced: PipelineNode[] = [];

  for (const node of nodes) {
    const position = BASE_NODE_POSITIONS[node.id];
    const group = position ? groups[position.laneIdx] : undefined;
    if (group) group.nodes.push(node);
    else unplaced.push(node);
  }

  for (const group of groups) {
    group.nodes.sort(
      (a, b) =>
        (BASE_NODE_POSITIONS[a.id]?.rowIdx ?? 0) -
        (BASE_NODE_POSITIONS[b.id]?.rowIdx ?? 0),
    );
  }

  const placed = groups.filter((group) => group.nodes.length > 0);

  if (unplaced.length > 0) {
    placed.push({
      id: "unplaced",
      laneIndex: LANE_COPY.length,
      title: "Not on the diagram",
      description:
        "These components have no lane position, so the map cannot draw them.",
      nodes: unplaced,
    });
  }

  return placed;
}

/**
 * Every node in the order the diagram reads: lane by lane, row by row.
 * The map renders in this order so that tabbing through the cards follows
 * the eye rather than the order the data file happens to declare them in.
 */
export const NODES_IN_DIAGRAM_ORDER: readonly PipelineNode[] = [...PIPELINE_NODES].sort(
  (a, b) => {
    const pa = BASE_NODE_POSITIONS[a.id];
    const pb = BASE_NODE_POSITIONS[b.id];
    if (!pa && !pb) return 0;
    if (!pa) return 1;
    if (!pb) return -1;
    return pa.laneIdx - pb.laneIdx || pa.rowIdx - pb.rowIdx;
  },
);
