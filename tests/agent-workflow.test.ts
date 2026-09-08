import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVerificationPlan } from "@/scripts/verify-changed";

const root = process.cwd();
const read = (path: string) => readFile(join(root, path), "utf8");
const nextManagedBlock = `<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in \`node_modules/next/dist/docs/\` (resolved from this file's directory; in monorepos the \`next\` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by \`next dev\` — verify at \`node_modules/next/dist/server/lib/generate-agent-files.js\`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->`;

describe("agent workflow contract", () => {
  it("preserves the managed Next.js block and records owner authority", async () => {
    const agents = await read("AGENTS.md");
    expect(agents.match(/<!-- BEGIN:nextjs-agent-rules -->/g)).toHaveLength(1);
    expect(agents.match(/<!-- END:nextjs-agent-rules -->/g)).toHaveLength(1);
    expect(agents).toContain(nextManagedBlock);
    expect(agents).toContain("There is one developer and project owner");
    expect(agents).toContain("Their direct instruction is the authority");
    expect(agents).toContain("no delegation is required");
  });

  it("keeps the workflow optional", async () => {
    const workflow = await read(".ai/WORKFLOW.md");
    expect(workflow).toContain("Optional working notes");
    expect(workflow).toContain("not prerequisites or gates");
  });

  /* CI stopped running `verify:full` on 2026-09-08 — it runs the jobs the
     classifier selects instead. What has to stay true is the reason that is
     safe: **both callers classify with the same script**, so a local pass and
     a green pipeline cannot disagree about whether a change was risky.
     `verify:full` itself is unchanged and still the full gate. */
  it("keeps the full local gate available and unchanged", async () => {
    const packageJson = JSON.parse(await read("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["verify:full"]).toBe(
      "npm run typecheck && npm run lint && npm test && npm run build",
    );
    expect(packageJson.scripts["verify:changed"]).toBe("tsx scripts/verify-changed.ts");
  });

  it("makes CI and the local agent share one change classifier", async () => {
    const ci = await read(".github/workflows/ci.yml");
    expect(ci).toContain("scripts/verify-changed.ts");
    /* Every conditional job reads the classifier's output rather than a
       hand-written path filter that could drift away from it. */
    for (const output of ["code", "highRisk", "relatedOnly"]) {
      expect(ci).toContain(`needs.classify.outputs.${output}`);
    }
  });

  it("builds the application exactly once per CI run", async () => {
    const ci = await read(".github/workflows/ci.yml");
    /* It ran twice until 2026-09-08 — once in the gate and again in the smoke
       job — serialised, with the first result discarded. */
    expect(ci.match(/run: npm run build/g)).toHaveLength(1);
    expect(ci).toContain("actions/upload-artifact");
    expect(ci).toContain("actions/download-artifact");
  });
});

describe("changed-file verification planning", () => {
  it("does not turn a documentation edit into a full build", () => {
    const plan = buildVerificationPlan([{ path: "docs/operations.md" }]);
    expect(plan.steps).toEqual([]);
  });

  it("checks types, lint, tests and the build for shared application code", () => {
    const plan = buildVerificationPlan([{ path: "server/core/config.ts" }]);
    /* `server/core` is high risk — everything imports it — and the build is
       in the list because `next build` is what Vercel runs. */
    expect(plan.steps.map((step) => step.id)).toEqual(["typecheck", "lint", "test", "build"]);
    expect(plan.classes.highRisk).toBe(true);
  });

  it("runs the whole gate for a new migration", () => {
    const plan = buildVerificationPlan([
      { path: "server/db/migrations/0023_example.sql", structural: true },
    ]);
    /* The build carries `scripts/check-deployment-schema.ts --build`, which is
       precisely the check a migration needs, so it is not padding here. */
    expect(plan.steps.map((step) => step.id)).toEqual(["typecheck", "lint", "test", "build"]);
    expect(plan.classes.migration).toBe(true);
  });

  it("narrows an isolated component edit to the tests that import it", () => {
    const plan = buildVerificationPlan([{ path: "components/home/HomeNewsSection.tsx" }]);
    expect(plan.steps.map((step) => step.id)).toEqual(["typecheck", "lint", "test:related", "build"]);
    expect(plan.steps.find((step) => step.id === "test:related")?.args)
      .toContain("components/home/HomeNewsSection.tsx");
  });

  it("never narrows a new file, because no test imports it yet", () => {
    const plan = buildVerificationPlan([
      { path: "components/home/BrandNew.tsx", structural: true },
    ]);
    expect(plan.steps.map((step) => step.id)).toEqual(["typecheck", "lint", "test", "build"]);
  });

  it("escalates a path it cannot classify rather than skipping it", () => {
    const plan = buildVerificationPlan([{ path: "some/unknown/thing.bin" }]);
    expect(plan.classes.highRisk).toBe(true);
    expect(plan.steps.map((step) => step.id)).toEqual(["typecheck", "lint", "test", "build"]);
  });
});
