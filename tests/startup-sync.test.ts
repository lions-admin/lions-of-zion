import { describe, expect, it } from "vitest";
import { decideSync, parseAheadBehind } from "@/scripts/startup-sync.mjs";

describe("startup repository synchronization", () => {
  it("parses git ahead/behind output", () => {
    expect(parseAheadBehind("2\t5")).toEqual({ ahead: 2, behind: 5 });
  });

  it("fast-forwards only a clean branch that is behind", () => {
    expect(decideSync({ dirty: false, ahead: 0, behind: 3 })).toEqual({
      status: "update",
      reason: "clean branch is behind upstream and can fast-forward",
    });
  });

  it("preserves dirty work when the upstream is current or behind", () => {
    expect(decideSync({ dirty: true, ahead: 0, behind: 0 }).status).toBe("ready");
    expect(decideSync({ dirty: true, ahead: 2, behind: 0 }).status).toBe("ready");
  });

  it("blocks dirty-behind and diverged branches", () => {
    expect(decideSync({ dirty: true, ahead: 0, behind: 1 }).status).toBe("blocked");
    expect(decideSync({ dirty: false, ahead: 2, behind: 1 }).status).toBe("blocked");
  });

  it("fails closed when there is no branch, upstream, or remote freshness", () => {
    expect(decideSync({ fetchOk: false, dirty: false, ahead: 0, behind: 0 }).status).toBe("blocked");
    expect(decideSync({ detached: true, dirty: false, ahead: 0, behind: 0 }).status).toBe("blocked");
    expect(decideSync({ upstream: false, dirty: false, ahead: 0, behind: 0 }).status).toBe("blocked");
  });

  it("keeps repository sync ahead of journal loading in the session hook", async () => {
    const { readFile } = await import("node:fs/promises");
    const settings = await readFile(".claude/settings.json", "utf8");
    expect(settings.indexOf("startup-sync.mjs")).toBeGreaterThan(-1);
    expect(settings.indexOf("startup-sync.mjs")).toBeLessThan(
      settings.indexOf("session-context.mjs"),
    );
  });
});
