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

  it("keeps the full local gate identical to the CI entry point", async () => {
    const packageJson = JSON.parse(await read("package.json")) as {
      scripts: Record<string, string>;
    };
    const ci = await read(".github/workflows/ci.yml");
    expect(packageJson.scripts["verify:full"]).toBe(
      "npm run typecheck && npm run lint && npm test && npm run build",
    );
    expect(ci).toContain("run: npm run verify:full");
  });
});

describe("changed-file verification planning", () => {
  it("does not turn a documentation edit into a full build", () => {
    const plan = buildVerificationPlan([{ path: "docs/operations.md" }]);
    expect(plan.steps).toEqual([]);
  });

  it("checks types, lint, and tests for application code", () => {
    const plan = buildVerificationPlan([{ path: "server/core/config.ts" }]);
    expect(plan.steps.map((step) => step.id)).toEqual(["typecheck", "lint", "test"]);
  });

  it("runs migration-aware tests for a new migration", () => {
    const plan = buildVerificationPlan([
      { path: "server/db/migrations/0023_example.sql", structural: true },
    ]);
    expect(plan.steps.map((step) => step.id)).toEqual(["test"]);
  });
});
