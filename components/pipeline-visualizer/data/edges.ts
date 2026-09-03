import type { PipelineEdge } from "../types";

export const PIPELINE_EDGES: PipelineEdge[] = [
  /* ── Ingestion & Storage ── */
  { from: "family", to: "source", label: "Grouped Under" },
  { from: "cron_ingest", to: "connector", label: "Triggers Fetch", isAsync: true },
  { from: "source", to: "connector", label: "Config & URL" },
  { from: "connector", to: "blob_storage", label: "Raw Bytes Upload", isAsync: true },
  { from: "connector", to: "source_fetch", label: "Fetch Result" },
  { from: "blob_storage", to: "source_fetch", label: "SHA-256 Reference" },
  { from: "source_fetch", to: "evidence_discovery", label: "Parsed Items" },
  { from: "evidence_discovery", to: "evidence", label: "Deduplicated Record" },
  { from: "evidence", to: "evidence_provenance", label: "Immutable Trail" },

  /* ── Information Model & Verification ── */
  { from: "evidence", to: "item_evidence", label: "Linked as Evidence" },
  { from: "item", to: "status_axes", label: "Workflow Status" },
  { from: "status_axes", to: "item_evidence", label: "Active Claims" },
  { from: "item_evidence", to: "verdict_rules", label: "Confirmed Edges" },
  { from: "verdict_rules", to: "item_assessment", label: "Allowed Verdicts" },
  { from: "item_assessment", to: "review_queue", label: "Awaiting Peer Review" },
  { from: "review_queue", to: "enforce_publish_gate", label: "2nd Human Review" },
  { from: "item_assessment", to: "enforce_publish_gate", label: "Frozen Confidence" },
  { from: "enforce_publish_gate", to: "published_item_view", label: "Publish Trigger", isTrigger: true },
  { from: "enforce_publish_gate", to: "publication", label: "Public Materialization" },

  /* ── Daily Briefing Automation ── */
  { from: "cron_briefing", to: "briefing_collect_q", label: "07:00 Israel Tick", isAsync: true },
  { from: "briefing_collect_q", to: "connector", label: "Window Ingestion" },
  { from: "connector", to: "briefing_enrich_q", label: "Shallow Text" },
  { from: "briefing_enrich_q", to: "briefing_cluster_q", label: "Full Text Packet" },
  { from: "briefing_cluster_q", to: "briefing_triage_model", label: "Story Clusters" },
  { from: "briefing_triage_model", to: "ai_gateway", label: "Classify Prompt", isAsync: true },
  { from: "briefing_triage_model", to: "briefing_draft_model", label: "Selected Stories" },
  { from: "briefing_draft_model", to: "ai_gateway", label: "Structured Draft", isAsync: true },
  { from: "briefing_draft_model", to: "publication", label: "Automatic Publication" },
  { from: "briefing_control", to: "publication", label: "Auto-Publish Switch" },
  { from: "briefing_quarantine", to: "briefing_alert", label: "Durable Alert", isTrigger: true },

  /* ── Search, Outbox & Embeddings ── */
  { from: "item", to: "outbox", label: "Transactional Event" },
  { from: "evidence", to: "outbox", label: "Transactional Event" },
  { from: "publication", to: "outbox", label: "Cache Invalidate" },
  { from: "outbox", to: "cron_outbox_drain", label: "Pending Events" },
  { from: "cron_outbox_drain", to: "outbox_dispatch_q", label: "Queue Drain (15m)", isAsync: true },
  { from: "outbox_dispatch_q", to: "search_document", label: "searchReindex Consumer" },
  { from: "search_document", to: "cron_embed", label: "indexed_content_hash mismatch" },
  { from: "cron_embed", to: "ai_gateway", label: "text-embedding-3-small", isAsync: true },
  { from: "cron_embed", to: "search_document", label: "Vector Updated" },
  { from: "search_document", to: "search_hybrid", label: "4-Arm Parallel Query" },
  { from: "search_hybrid", to: "rrf_fusion", label: "Ranked Lists" },

  /* ── Grounded Chat & AI Ledgers ── */
  { from: "ai_gateway", to: "ai_run_ledger", label: "Token & USD Ledger", isTrigger: true },
  { from: "ai_gateway", to: "ai_suggestion", label: "Isolated Output" },
  { from: "ai_suggestion", to: "human_approval_gate", label: "Awaiting Human Decision" },
  { from: "human_approval_gate", to: "item_assessment", label: "Accepted Suggestion" },
  { from: "chat_thread", to: "search_hybrid", label: "Retrieve First" },
  { from: "rrf_fusion", to: "chat_tool_run", label: "Pre-Query Document IDs" },
  { from: "chat_tool_run", to: "ai_gateway", label: "Prompt with Sources" },
  { from: "ai_gateway", to: "citation_guard", label: "Generated Response" },
  { from: "citation_guard", to: "chat_thread", label: "Verified Citations Only", isTrigger: true },

  /* ── Public Reports & Governance ── */
  { from: "public_reports", to: "rate_limit_guard", label: "Submission Rate Check" },
  { from: "rate_limit_guard", to: "public_reports", label: "Atomic Counter (<10/hr)" },
  { from: "public_reports", to: "item", label: "Triaged & Converted to Claim" },
  { from: "publication", to: "rls_policy", label: "RLS Protection" },
  { from: "published_item_view", to: "rls_policy", label: "RLS Protection" },
  { from: "item_assessment", to: "entity_version", label: "Snapshot State" },
  { from: "entity_version", to: "audit_log", label: "Audit Log (Same Tx)" },
];
