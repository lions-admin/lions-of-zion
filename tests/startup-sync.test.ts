import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("main synchronization contract", () => {
  it("starts from main, removes merged branches, and stops for open ones", async () => {
    const [script, packageJson, workflow] = await Promise.all([
      readFile("scripts/startup-sync.mjs", "utf8"),
      readFile("package.json", "utf8"),
      readFile(".ai/WORKFLOW.md", "utf8"),
    ]);
    expect(script).toContain('git(["switch", "main"])');
    expect(script).toContain('git(["merge", "--ff-only", "origin/main"])');
    expect(script).toContain('git(["push", "origin", "main"])');
    expect(script).toContain("cleanupMergedBranches");
    expect(script).toContain("unmergedRemoteBranches");
    expect(script).toContain("Open branches need a merge or deletion decision");
    expect(script).not.toContain("--force");
    expect(JSON.parse(packageJson).scripts["main:update"]).toBe(
      "node scripts/startup-sync.mjs --publish",
    );
    expect(workflow).toContain("Start every task from current main");
  });
});
