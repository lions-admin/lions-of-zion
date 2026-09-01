import { describe, it, expect } from "vitest";
import { PIPELINE_NODES } from "@/components/pipeline-visualizer/data/nodes";
import { PIPELINE_EDGES } from "@/components/pipeline-visualizer/data/edges";
import { PIPELINE_JOURNEYS } from "@/components/pipeline-visualizer/data/journeys";

describe("Pipeline Visualizer Graph Integrity", () => {
  it("contains all core architectural nodes with required metadata", () => {
    expect(PIPELINE_NODES.length).toBeGreaterThanOrEqual(30);

    const nodeIds = new Set(PIPELINE_NODES.map((n) => n.id));
    expect(nodeIds.size).toBe(PIPELINE_NODES.length); // No duplicates

    for (const node of PIPELINE_NODES) {
      expect(node.id).toBeTruthy();
      expect(node.lane).toBeTruthy();
      expect(node.cat).toBeTruthy();
      expect(node.nameEn).toBeTruthy();
      expect(node.nameHe).toBeTruthy();
      expect(node.what).toBeTruthy();
      expect(node.why).toBeTruthy();
      expect(node.failureMode).toBeTruthy();
    }
  });

  it("validates that all edges connect existing nodes", () => {
    const nodeIds = new Set(PIPELINE_NODES.map((n) => n.id));
    expect(PIPELINE_EDGES.length).toBeGreaterThan(20);

    for (const edge of PIPELINE_EDGES) {
      expect(nodeIds.has(edge.from)).toBe(true);
      expect(nodeIds.has(edge.to)).toBe(true);
    }
  });

  it("validates that all journey steps reference valid nodes", () => {
    const nodeIds = new Set(PIPELINE_NODES.map((n) => n.id));
    expect(PIPELINE_JOURNEYS.length).toBeGreaterThanOrEqual(5);

    for (const journey of PIPELINE_JOURNEYS) {
      expect(journey.steps.length).toBeGreaterThanOrEqual(3);

      for (const step of journey.steps) {
        expect(nodeIds.has(step.nodeId)).toBe(true);
        expect(step.titleEn).toBeTruthy();
        expect(step.titleHe).toBeTruthy();
        expect(step.descriptionEn).toBeTruthy();
        expect(step.descriptionHe).toBeTruthy();
      }
    }
  });

  it("verifies critical system invariants in node definitions", () => {
    // 1. Dual Axes
    const statusAxesNode = PIPELINE_NODES.find((n) => n.id === "status_axes");
    expect(statusAxesNode).toBeDefined();

    // 2. Pure rules verdict engine
    const verdictRulesNode = PIPELINE_NODES.find((n) => n.id === "verdict_rules");
    expect(verdictRulesNode).toBeDefined();
    expect(verdictRulesNode?.codePath).toContain("rules.ts");

    // 3. Publish gate SQL trigger
    const publishGateNode = PIPELINE_NODES.find((n) => n.id === "enforce_publish_gate");
    expect(publishGateNode).toBeDefined();
    expect(publishGateNode?.kind).toBe("trigger");

    // 4. Briefing quality gate with quarantine
    const qualityGateNode = PIPELINE_NODES.find((n) => n.id === "briefing_quality_gate");
    const quarantineNode = PIPELINE_NODES.find((n) => n.id === "briefing_quarantine");
    expect(qualityGateNode).toBeDefined();
    expect(quarantineNode).toBeDefined();

    // 5. Chat citation guard
    const citationGuardNode = PIPELINE_NODES.find((n) => n.id === "citation_guard");
    expect(citationGuardNode).toBeDefined();
    expect(citationGuardNode?.sqlConstraintOrTrigger).toContain("chat_citation_must_be_retrieved");
  });
});
