import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("environment example", () => {
  it("contains configuration names only and never an example secret", () => {
    const contents = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
    const assignments = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^#?\s*[A-Z][A-Z0-9_]*=/.test(line));

    expect(assignments.length).toBeGreaterThan(0);
    for (const line of assignments) {
      const assignment = line.replace(/^#\s?/, "");
      const value = assignment.slice(assignment.indexOf("=") + 1);
      expect(value, `Example environment assignment must be empty: ${line.split("=", 1)[0]}`).toBe("");
    }
  });
});
