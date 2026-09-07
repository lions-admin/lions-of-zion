import { describe, expect, it } from "vitest";
import { describeEditorialRunPhase, isTerminalEditorialRunStatus } from "@/server/contracts/editorial-update";
import { formatFailureDiagnostics, formatRunStatusLine, formatTerminalReport, formatTimeout, isTerminal, runFailed } from "../scripts/editorial-run-status";

const delivery = (over: Partial<{ publishedAt: string | null; attempts: number; lastError: string | null }> = {}) => ({
  outboxId: "3568", createdAt: "2026-09-06T21:20:04.307Z", availableAt: "2026-09-06T21:20:04.307Z",
  publishedAt: null, attempts: 0, lastError: null, ...over,
});

/**
 * What the GitHub poller can now say between `accepted` and the end.
 *
 * Three runs read `status=queued` for twenty minutes each and the Action
 * printed nothing. The distinction that was missing lives in the outbox row:
 * not yet drained, drained and refused, or handed over and not yet claimed.
 */
describe("the run phase", () => {
  it("tells a run awaiting the drain from one the queue refuses from one handed over", () => {
    expect(describeEditorialRunPhase({ status: "queued", stage: "media" }, delivery())).toBe("queued:awaiting-drain");
    expect(describeEditorialRunPhase({ status: "queued", stage: "media" }, delivery({ attempts: 27, lastError: "Invalid V3 queue name" }))).toBe("queued:drain-failing");
    expect(describeEditorialRunPhase({ status: "queued", stage: "media" }, delivery({ publishedAt: "2026-09-06T21:30:16.000Z" }))).toBe("queued:dispatched");
    expect(describeEditorialRunPhase({ status: "queued", stage: "media" }, null)).toBe("queued:awaiting-drain");
  });

  it("names the stage a running worker is inside, and the terminal state itself", () => {
    expect(describeEditorialRunPhase({ status: "running", stage: "publication" }, null)).toBe("running:publication");
    expect(describeEditorialRunPhase({ status: "running", stage: "homepage" }, null)).toBe("running:homepage");
    expect(describeEditorialRunPhase({ status: "running", stage: "research" }, null)).toBe("running:media");
    for (const status of ["completed", "partial", "failed"]) {
      expect(describeEditorialRunPhase({ status, stage: "report" }, null)).toBe(status);
      expect(isTerminalEditorialRunStatus(status)).toBe(true);
    }
    expect(isTerminalEditorialRunStatus("queued")).toBe(false);
    expect(isTerminalEditorialRunStatus("running")).toBe(false);
  });
});

describe("the publisher's polling output", () => {
  it("prints the same line for an unchanged state, so the caller can stay silent", () => {
    const run = { runId: "r", status: "queued", stage: "media", delivery: delivery() };
    expect(formatRunStatusLine(run)).toBe(formatRunStatusLine({ ...run }));
    expect(formatRunStatusLine(run)).toBe("runId=r status=queued phase=queued:awaiting-drain outboxAttempts=0");
  });

  it("changes the line on every transition, and carries the queue's refusal when there is one", () => {
    const lines = [
      formatRunStatusLine({ runId: "r", status: "queued", stage: "media", delivery: delivery() }),
      formatRunStatusLine({ runId: "r", status: "queued", stage: "media", delivery: delivery({ attempts: 3, lastError: "Invalid V3 queue name." }) }),
      formatRunStatusLine({ runId: "r", status: "queued", stage: "media", delivery: delivery({ publishedAt: "2026-09-06T21:30:16.000Z" }) }),
      formatRunStatusLine({ runId: "r", status: "running", stage: "publication", delivery: null }),
      formatRunStatusLine({ runId: "r", status: "completed", stage: "report", delivery: null }),
    ];
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines[1]).toContain('outboxError="Invalid V3 queue name."');
    expect(lines[2]).not.toContain("outboxAttempts");
    expect(lines[3]).toBe("runId=r status=running phase=running:publication");
  });

  it("prefers the server's phase when the status body carries one", () => {
    expect(formatRunStatusLine({ runId: "r", status: "queued", phase: "queued:dispatched" })).toContain("phase=queued:dispatched");
  });

  it("stops only on completed, partial or failed", () => {
    expect(isTerminal({ runId: "r", status: "queued" })).toBe(false);
    expect(isTerminal({ runId: "r", status: "running" })).toBe(false);
    for (const status of ["completed", "partial", "failed"]) expect(isTerminal({ runId: "r", status })).toBe(true);
  });

  it("reports counts and URLs, fails on publication execution errors, and keeps homepage refusals as warnings", () => {
    const success = { runId: "r", status: "completed", report: { publications: { created: 3, updated: 1, failed: 0 }, urls: ["/articles/a"], errors: [] } };
    expect(runFailed(success)).toBe(false);
    expect(formatTerminalReport(success)).toEqual({ out: ["runId=r status=completed created=3 updated=1 failed=0", "url=/articles/a"], err: [] });

    const partial = { runId: "r", status: "partial", report: { publications: { created: 2, updated: 1, failed: 1 }, urls: ["/articles/a"], errors: [{ operationKey: "b", stage: "media", message: "bad image" }] } };
    expect(runFailed(partial)).toBe(true);
    const report = formatTerminalReport(partial);
    expect(report.err[0]).toBe("error=b stage=media message=bad image");
    expect(report.err.at(-1)).toBe("[publication execution failure] Durable run r finished partial.");
    /* The diagnostics sit between the two, so the operator sees the run's own
       account before the summary line. */
    expect(report.err.join("\n")).toContain("--- diagnostics for r ---");

    const homepage = { runId: "r", status: "partial", report: { publications: { created: 1, updated: 0, failed: 0 }, errors: [{ operationKey: null, stage: "homepage", message: "slot refused" }] } };
    expect(runFailed(homepage)).toBe(false);
    expect(formatTerminalReport(homepage)).toEqual({
      out: ["runId=r status=partial created=1 updated=0 failed=0", "warning=homepage stage=homepage message=slot refused"],
      err: [],
    });

    expect(runFailed({ runId: "r", status: "failed", report: null })).toBe(true);
  });

  /* The regression this file exists for. Run
     `chatgpt-test-2026-09-07-0332-k4m9` ended `failed` with
     `created=0 updated=0 failed=0` and no operation marked failed, and the
     Action printed one sentence: "Durable run … finished failed." The stored
     exception was never on the wire. A terminal failure must now carry the
     run's own account of itself. */
  it("never reports a run-level failure without the stored exception", () => {
    const runLevel = {
      runId: "chatgpt-test-2026-09-07-0332-k4m9",
      status: "failed",
      stage: "report",
      phase: "failed",
      createdAt: "2026-09-07T00:30:13.000Z",
      startedAt: "2026-09-07T00:30:14.000Z",
      finishedAt: "2026-09-07T00:30:19.000Z",
      failure: {
        stage: "report",
        operationKey: null,
        message: "relation \"editorial_source\" does not exist",
        recovery: "Resume the run after resolving the report issue.",
      },
      report: { publications: { created: 0, updated: 0, failed: 0 } },
      operations: [
        { key: "lebanon", status: "pending", stage: "media", result: null, failure: null },
        { key: "west-bank", status: "pending", stage: "media", result: null, failure: null },
      ],
      delivery: { outboxId: "3646", createdAt: "2026-09-07T00:30:13.000Z", availableAt: "2026-09-07T00:30:13.000Z", publishedAt: "2026-09-07T00:30:13.500Z", attempts: 0, lastError: null },
    };
    expect(runFailed(runLevel)).toBe(true);
    const text = formatTerminalReport(runLevel).err.join("\n");
    /* The exception itself, its stage, and how to recover — the three things
       that were invisible. */
    expect(text).toContain('relation "editorial_source" does not exist');
    expect(text).toContain("failure.stage=report");
    expect(text).toContain("failure.operationKey=none (run-level)");
    expect(text).toContain("Resume the run after resolving the report issue.");
    /* And that no operation even started, which is what distinguishes a
       run-level failure from three failed publications. */
    expect(text).toContain("operation lebanon status=pending");
    expect(text).toContain("created=0 updated=0 failed=0 requested=2");
    expect(text).toContain("outbox id=3646");
  });

  it("says so plainly when a failed run recorded no failure at all", () => {
    const text = formatFailureDiagnostics({ runId: "r", status: "failed", report: null }).join("\n");
    expect(text).toContain("failure=none recorded on the run");
  });

  it("makes a timeout a failure that names the last thing it saw", () => {
    expect(formatTimeout("runId=r status=queued phase=queued:drain-failing outboxAttempts=4", 20))
      .toBe("Timed out after 20 minutes waiting for the editorial run to finish. Last observed: runId=r status=queued phase=queued:drain-failing outboxAttempts=4");
    expect(formatTimeout(null, 20)).toContain("no status read succeeded");
  });
});