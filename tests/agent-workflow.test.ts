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
  it("preserves the managed Next.js block and routes every agent to the shared workflow", async () => {
    const agents = await read("AGENTS.md");
    expect(agents.match(/<!-- BEGIN:nextjs-agent-rules -->/g)).toHaveLength(1);
    expect(agents.match(/<!-- END:nextjs-agent-rules -->/g)).toHaveLength(1);
    expect(agents).toContain(nextManagedBlock);
    expect(agents).toContain("Read [`.ai/WORKFLOW.md`](.ai/WORKFLOW.md) in full");
    expect(agents).toContain("Every task, including a small one, must be split across agents");
    expect(agents).toContain("The agent that");
    expect(agents).toContain("receives the user's request is the manager");
    expect(agents).toContain("at least one concrete, bounded subtask to another agent");
    expect(agents).toContain("stop before implementation");
    expect(agents).toContain("Never commit, push, deploy, publish");
  });

  it("makes the manager accountable for delegation, integration, and verification", async () => {
    const workflow = await read(".ai/WORKFLOW.md");
    expect(workflow).toContain("The agent receiving the user's request is always the manager");
    expect(workflow).toContain("non-overlapping workstreams");
    expect(workflow).toContain("Treat worker summaries as leads, not proof");
    expect(workflow).toContain("what the manager independently verified");
  });

  it("keeps the full local gate identical to the CI entry point", async () => {
    const packageJson = JSON.parse(await read("package.json")) as {
      scripts: Record<string, string>;
    };
    const ci = await read(".github/workflows/ci.yml");
    expect(packageJson.scripts["verify:full"]).toBe(
      "npm run typecheck && npm run lint && npm test && npm run build && npm run map:check",
    );
    expect(ci).toContain("run: npm run verify:full");
  });
});

describe("changed-file verification planning", () => {
  it("does not turn a documentation edit into a full build", () => {
    const plan = buildVerificationPlan([{ path: "docs/operations.md" }]);
    expect(plan.steps).toEqual([]);
    expect(plan.visual).toBe(false);
  });

  it("checks types, lint, and tests for application code", () => {
    const plan = buildVerificationPlan([{ path: "server/core/config.ts" }]);
    expect(plan.steps.map((step) => step.id)).toEqual(["typecheck", "lint", "test"]);
  });

  it("checks map drift when a route is added", () => {
    const plan = buildVerificationPlan([{ path: "app/new-route/page.tsx", structural: true }]);
    expect(plan.steps.map((step) => step.id)).toContain("map");
    expect(plan.visual).toBe(true);
  });

  it("runs migration-aware tests and the map check for a new migration", () => {
    const plan = buildVerificationPlan([
      { path: "server/db/migrations/0023_example.sql", structural: true },
    ]);
    expect(plan.steps.map((step) => step.id)).toEqual(["test", "map"]);
  });

  it("requires browser evidence for visual and intro changes", () => {
    const visual = buildVerificationPlan([{ path: "components/home/home.module.css" }]);
    expect(visual.visual).toBe(true);
    expect(visual.intro).toBe(false);

    const intro = buildVerificationPlan([{ path: "components/intro/story-timeline.ts" }]);
    expect(intro.visual).toBe(true);
    expect(intro.intro).toBe(true);
    expect(intro.visualGuidance.join(" ")).toContain("--mobile");
  });
});
