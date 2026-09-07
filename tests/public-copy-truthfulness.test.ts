import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function publicCopy(file: string) {
  return readFileSync(path.join(ROOT, file), "utf8");
}

describe("public explanation of editorial provenance", () => {
  it("does not restore obsolete universal review or AI-publication claims", () => {
    const copy = [
      publicCopy("app/we-are/page.tsx"),
      publicCopy("app/methodology/page.tsx"),
      publicCopy("app/support-us/page.tsx"),
      publicCopy("components/briefs/information-war/pipeline-data.ts"),
      publicCopy("components/briefs/information-war/StorySections.tsx"),
      publicCopy("components/home/HomeSystemSection.tsx"),
    ].join("\n");

    for (const obsolete of [
      "Every published item passes a required, non-author human review",
      "Does AI publish anything on its own here?",
      "human review before anything is published",
      "all twelve checks",
      "direct Codex import",
      "The external-package publisher",
    ]) {
      expect(copy).not.toContain(obsolete);
    }
  });

  it("distinguishes evidence, machine-authored editorial runs and human assessments", () => {
    const weAre = publicCopy("app/we-are/page.tsx");
    const methodology = publicCopy("app/methodology/page.tsx");
    const informationWar = publicCopy("components/briefs/information-war/pipeline-data.ts");

    expect(weAre).toContain("AI output is never evidence");
    expect(weAre).toContain("machine provenance");
    expect(methodology).toContain("Machine-authored editorial runs may create or update");
    expect(informationWar).toContain("It never composes or publishes an editorial record on its own");
    expect(informationWar).toContain("Human assessments retain their separate review gate");
  });
});
