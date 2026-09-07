import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { externalBriefingPackageSchema } from "@/server/contracts/external-briefing";

function run(args: string[]) {
  return spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/external-briefing-compose.ts", ...args], {
    cwd: process.cwd(), encoding: "utf8", timeout: 10_000,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test" },
  });
}

describe("retired legacy composer CLI", () => {
  it.each([[], ["--dry-run"]])("refuses live discovery, drafting and submission for %j", (...args) => {
    const result = run(args as string[]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Legacy editorial composition is retired");
    expect(result.stdout).toBe("");
  });

  it("keeps a database-free historical fixture that cannot submit", () => {
    const result = run(["--fixture"]);
    expect(result.status, result.stderr).toBe(0);
    expect(externalBriefingPackageSchema.safeParse(JSON.parse(result.stdout)).success).toBe(true);
  });
});
