export type LaneId = "ingest" | "model" | "evidence" | "briefing" | "ai" | "search" | "publish" | "infra";

export type NodeKind =
  | "source"
  | "table"
  | "view"
  | "guard"
  | "trigger"
  | "cron"
  | "queue"
  | "connector"
  | "service"
  | "model"
  | "gateway"
  | "storage";

export type NodeCategory =
  | "ingest"
  | "model"
  | "evidence"
  | "briefing"
  | "ai"
  | "search"
  | "publish"
  | "infra";

export interface PipelineNodeTerm {
  en: string;
  he: string;
}

export interface PipelineNode {
  id: string;
  lane: LaneId;
  cat: NodeCategory;
  kind: NodeKind;
  nameEn: string;
  nameHe: string;
  what: string;
  why: string;
  input: string;
  does: string;
  output: string;
  failureMode: string;
  dbTable?: string;
  sqlConstraintOrTrigger?: string;
  codePath?: string;
  terms: PipelineNodeTerm[];
  // Graph layout coordinates (in virtual canvas space)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface PipelineEdge {
  from: string;
  to: string;
  label?: string;
  isAsync?: boolean;
  isTrigger?: boolean;
  isQuarantine?: boolean;
}

export interface JourneyStep {
  nodeId: string;
  titleHe: string;
  titleEn: string;
  descriptionHe: string;
  descriptionEn: string;
  payloadSnippet?: Record<string, unknown> | string;
  logEvent?: {
    level: "info" | "warn" | "error" | "success";
    message: string;
    metrics?: Record<string, string | number>;
  };
}

export interface PipelineJourney {
  id: string;
  titleHe: string;
  titleEn: string;
  descriptionHe: string;
  descriptionEn: string;
  category: NodeCategory;
  steps: JourneyStep[];
}

export interface SimulationPacket {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  progress: number; // 0 to 1
  label: string;
  color?: string;
  kind?: "data" | "trigger" | "queue" | "alert" | "quarantine";
}

export interface SimulationEventLog {
  id: string;
  timestamp: string;
  stepIndex: number;
  nodeId: string;
  nodeName: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  detail?: string;
  metrics?: Record<string, string | number>;
}

export type ViewPerspective = "pipelines" | "topology" | "briefing";
