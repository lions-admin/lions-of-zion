import { describe, expect, it } from "vitest";
import { PIPELINE_ROUTES, PIPELINE_STAGES, SYSTEM_NODES, SYSTEM_STAGES } from "@/components/briefs/information-war/pipeline-data";

const nodeIds = new Set<string>(SYSTEM_NODES.map((node) => node.id));
const stageRank = new Map(SYSTEM_STAGES.map((stage, index) => [stage.id, index]));
const rankOf = (id: string) =>
  stageRank.get(SYSTEM_NODES.find((node) => node.id === id)!.stage)!;

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

  /* This asserted that every consecutive pair had a drawn connector in
     `SYSTEM_EDGES` — eleven hand-written SVG paths over a 1000×550 canvas
     that only read at 1320px and hid four of the nine nodes below 700px. The
     canvas is a ruled ledger now (2026-09-16) and the paths are gone; the
     property they encoded is kept and stated directly: a journey only ever
     moves forward through the three stages, material in → work on the
     evidence → public access, so no route can quietly claim that something
     published feeds back into collection. */
  it("every journey moves forward through the three stages", () => {
    for (const route of PIPELINE_ROUTES) {
      route.steps.slice(1).forEach((to, i) => {
        const from = route.steps[i];
        expect(rankOf(to), `${route.id}: ${from} → ${to}`).toBeGreaterThanOrEqual(rankOf(from));
      });
    }
  });

  it("keeps collection separate from editorial publication and the archive", () => {
    const routes = Object.fromEntries(PIPELINE_ROUTES.map((route) => [route.id, route]));
    expect(routes.editorial.steps).toContain("quality");
    expect(routes.collection.steps).not.toContain("publication");
    expect(routes.collection.note).toContain("never composes or publishes");
    expect(routes.assessment.steps).toContain("quality");
    expect(routes.archive.steps).toEqual(["research", "archive"]);
  });

  it("reaches every system node from at least one journey", () => {
    const accessible = new Set(PIPELINE_ROUTES.flatMap((route) => route.steps));
    expect([...nodeIds].filter((id) => !accessible.has(id as typeof SYSTEM_NODES[number]["id"]))).toEqual([]);
  });

  it("has unique routes, nodes and connectors", () => {
    expect(new Set(PIPELINE_ROUTES.map((route) => route.id)).size).toBe(PIPELINE_ROUTES.length);
    expect(nodeIds.size).toBe(SYSTEM_NODES.length);
    /* Every node stands in one of the three named stages, and every stage has
       nodes in it: the ledger renders all nine at every width, so a node with
       an unknown stage would simply not be drawn. */
    for (const node of SYSTEM_NODES) expect(stageRank.has(node.stage), node.id).toBe(true);
    for (const stage of SYSTEM_STAGES) {
      expect(SYSTEM_NODES.filter((node) => node.stage === stage.id).length, stage.id).toBeGreaterThan(0);
    }
  });

  it("names the public provenance stages without claiming a live run", () => {
    expect(PIPELINE_STAGES.map((stage) => stage.job)).toEqual(["collect", "evidence", "editorial", "publish", "search"]);
    expect(PIPELINE_ROUTES.find((r) => r.id === "assessment")?.note).toContain("not an automatic result");
  });
});
