/**
 * The three routes on `/information-war` are anchored to the pipeline spine by
 * a stage `number`, and nothing in TypeScript stops that string from naming a
 * stage that does not exist — `at: "08"` typechecks. A route that points at
 * nothing renders a stage with no steps and silently drops a step of the
 * explanation, which is exactly the class of bug this page cannot afford:
 * it would be the page about traceability quietly failing to trace.
 *
 * These are also what keeps the merge honest. Four ordered lists were folded
 * into one spine and three routes; the count assertions pin that every step
 * the old lists carried is still carried by a route.
 */
import { describe, expect, it } from "vitest";
import {
  PIPELINE_ROUTES,
  PIPELINE_STAGES,
} from "@/components/briefs/information-war/pipeline-data";

const STAGE_NUMBERS = new Set(PIPELINE_STAGES.map((stage) => stage.number));

describe("information-war pipeline routes", () => {
  it("anchors every step to a stage that exists", () => {
    const dangling = PIPELINE_ROUTES.flatMap((route) =>
      route.steps
        .filter((step) => !STAGE_NUMBERS.has(step.at))
        .map((step) => `${route.id}: "${step.step}" -> ${step.at}`),
    );
    expect(dangling).toEqual([]);
  });

  it("keeps each route's steps in spine order", () => {
    for (const route of PIPELINE_ROUTES) {
      const positions = route.steps.map((step) =>
        PIPELINE_STAGES.findIndex((stage) => stage.number === step.at),
      );
      const sorted = [...positions].sort((a, b) => a - b);
      expect(positions, `${route.id} runs backwards along the spine`).toEqual(sorted);
    }
  });

  it("ends every route at publication", () => {
    const last = PIPELINE_STAGES[PIPELINE_STAGES.length - 1].number;
    for (const route of PIPELINE_ROUTES) {
      expect(route.steps.at(-1)?.at, `${route.id} does not reach the record`).toBe(last);
    }
  });

  it("carries the steps the four merged lists used to carry", () => {
    const byId = Object.fromEntries(PIPELINE_ROUTES.map((r) => [r.id, r.steps.length]));
    /* signal was eight steps and gains one — `Cited`, which is stage 05's own
       job and was previously stated only inside a stage `mechanism`. */
    expect(byId.signal).toBe(9);
    expect(byId.narrative).toBe(5);
    expect(byId.claim).toBe(7);
  });

  it("gives each route a distinct id and a subject", () => {
    const ids = PIPELINE_ROUTES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const route of PIPELINE_ROUTES) {
      expect(route.subject.length, `${route.id} has no subject`).toBeGreaterThan(0);
      expect(route.name.length).toBeGreaterThan(0);
    }
  });
});
