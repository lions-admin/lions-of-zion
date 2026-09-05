import { describe, expect, it } from "vitest";
import { PIPELINE_ROUTES, PIPELINE_STAGES, SYSTEM_EDGES, SYSTEM_NODES } from "@/components/briefs/information-war/pipeline-data";

const nodeIds = new Set<string>(SYSTEM_NODES.map((node) => node.id));

describe("information-war architecture journeys", () => {
  it("every step names a real, inspectable node", () => {
    for (const route of PIPELINE_ROUTES) {
      expect(route.steps.length).toBeGreaterThan(1);
      for (const id of route.steps) expect(nodeIds.has(id), `${route.id}: ${id}`).toBe(true);
    }
    for (const node of SYSTEM_NODES) {
      expect(node.detail.length).toBeGreaterThan(0);
      expect(node.input.length).toBeGreaterThan(0);
      expect(node.output.length).toBeGreaterThan(0);
    }
  });

  it("every consecutive step has an actual connector", () => {
    for (const route of PIPELINE_ROUTES) {
      route.steps.slice(1).forEach((to, i) => {
        expect(SYSTEM_EDGES.some((edge) => edge.from === route.steps[i] && edge.to === to), `${route.id}: ${route.steps[i]} → ${to}`).toBe(true);
      });
    }
  });

  it("does not draw a quality evaluation on the direct-import or archive path", () => {
    const routes = Object.fromEntries(PIPELINE_ROUTES.map((route) => [route.id, route]));
    expect(routes.briefing.steps).toContain("quality");
    expect(routes.package.steps).toContain("quality");
    expect(routes.import.steps).not.toContain("quality");
    expect(routes.archive.steps).toEqual(["research", "archive"]);
    expect(routes.import.note).toContain("does not run the same quality evaluator");
  });

  it("shows every system node in at least one mobile journey", () => {
    const accessible = new Set(PIPELINE_ROUTES.flatMap((route) => route.steps));
    expect([...nodeIds].filter((id) => !accessible.has(id as typeof SYSTEM_NODES[number]["id"]))).toEqual([]);
  });

  it("has unique routes, nodes and connectors", () => {
    expect(new Set(PIPELINE_ROUTES.map((route) => route.id)).size).toBe(PIPELINE_ROUTES.length);
    expect(nodeIds.size).toBe(SYSTEM_NODES.length);
    expect(new Set(SYSTEM_EDGES.map((edge) => `${edge.from}:${edge.to}`)).size).toBe(SYSTEM_EDGES.length);
  });

  it("retains the actual seven job stages without claiming they run for every route", () => {
    expect(PIPELINE_STAGES.map((stage) => stage.job)).toEqual(["collect", "enrich", "cluster", "triage", "draft", "quality", "publish"]);
    expect(PIPELINE_ROUTES.find((r) => r.id === "claim")?.note).toContain("does not automatically");
  });
});
