/**
 * Server-side measurement: Ask outcomes, attribution to the reader's visit,
 * and the rule that no raw question text reaches the warehouse.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { chatService, type Answerer, type Retriever } from "@/server/modules/chat/service";
import { measurementService } from "@/server/modules/measurement/service";
import {
  MEASUREMENT_PATH_HEADER,
  MEASUREMENT_VISITOR_HEADER,
  MEASUREMENT_VISIT_HEADER,
  measurementContextFromHeaders,
  type MeasurementRequestContext,
} from "@/server/contracts/measurement";
import { ApiError } from "@/server/http/responses";
import { measureContentId, measureSection } from "@/components/measurement/attrs";

const actor = { label: "reader@example.org", userId: null };
const RAW_QUESTION = "Is it true? mail me at someone@example.org or call +972 50 123 4567";

const answer: Answerer = async () => ({
  text: "Here is what the record says.",
  citations: [],
  model: "anthropic/claude-sonnet-4.6",
  inputTokens: 400,
  outputTokens: 60,
  costUsd: 0.0012,
  latencyMs: 42,
});
const retrieve: Retriever = async () => [];

function context(visit = "s_visit_ask_0001", visitor = "v_visitor_ask_0001"): MeasurementRequestContext {
  return { visitId: visit, visitorId: visitor, pagePath: "/ask", optOut: false };
}

async function events(db: TestDatabase) {
  const result = await db.execute(sql`
    SELECT name, client_or_server, query_redacted, payload, section, page_path, visit_id
    FROM measurement_events ORDER BY name
  `);
  return result.rows as Array<{
    name: string;
    client_or_server: string;
    query_redacted: string | null;
    payload: Record<string, unknown>;
    section: string | null;
    page_path: string | null;
    visit_id: string;
  }>;
}

function askService(db: TestDatabase, opts: Partial<Parameters<typeof chatService>[1]> = {}) {
  const measure = measurementService(db as never);
  return chatService(db, {
    answer,
    retrieve,
    recordOutcome: (ctx, outcome) => measure.recordAskOutcome(ctx, outcome),
    ...opts,
  });
}

describe("measurement request context", () => {
  it("reads the visit, visitor and path headers", () => {
    const headers = new Headers({
      [MEASUREMENT_VISIT_HEADER]: "s_abcdef123456",
      [MEASUREMENT_VISITOR_HEADER]: "v_abcdef123456",
      [MEASUREMENT_PATH_HEADER]: "/articles/x",
    });
    expect(measurementContextFromHeaders(headers)).toEqual({
      visitId: "s_abcdef123456",
      visitorId: "v_abcdef123456",
      pagePath: "/articles/x",
      optOut: false,
    });
  });

  it("drops every id when the browser says DNT or GPC", () => {
    const optOuts: Record<string, string>[] = [{ dnt: "1" }, { "sec-gpc": "1" }];
    for (const optOut of optOuts) {
      const ctx = measurementContextFromHeaders(
        new Headers({ ...optOut, [MEASUREMENT_VISIT_HEADER]: "s_abcdef123456", [MEASUREMENT_VISITOR_HEADER]: "v_abcdef123456" }),
      );
      expect(ctx).toEqual({ visitId: null, visitorId: null, pagePath: null, optOut: true });
    }
  });

  it("reads malformed ids and off-site paths as absent", () => {
    const ctx = measurementContextFromHeaders(
      new Headers({ [MEASUREMENT_VISIT_HEADER]: "short", [MEASUREMENT_VISITOR_HEADER]: "v_bad id with spaces", [MEASUREMENT_PATH_HEADER]: "https://evil.example/" }),
    );
    expect(ctx.visitId).toBeNull();
    expect(ctx.visitorId).toBeNull();
    expect(ctx.pagePath).toBeNull();
  });

  it("the browser sends the header names the contract reads", () => {
    const client = readFileSync(path.join(process.cwd(), "components/measurement/headers.ts"), "utf8");
    for (const name of [MEASUREMENT_VISIT_HEADER, MEASUREMENT_VISITOR_HEADER, MEASUREMENT_PATH_HEADER]) {
      expect(client).toContain(`"${name}"`);
    }
    const ask = readFileSync(path.join(process.cwd(), "components/ask/useAskThread.ts"), "utf8");
    expect(ask).toContain("measurementHeaders()");
  });
});

describe("Ask outcomes as server events", () => {
  it("records ask_success, ask_latency and ask_cost against the reader's visit — never the raw question", async () => {
    const db = await freshDatabase();
    const svc = askService(db);
    const thread = await svc.createThread({}, actor);
    await svc.ask(thread.id, { content: RAW_QUESTION }, actor, context());

    const rows = await events(db);
    expect(rows.map((r) => r.name)).toEqual(["ask_cost", "ask_latency", "ask_success"]);
    expect(rows.every((r) => r.client_or_server === "server")).toBe(true);
    expect(rows.every((r) => r.visit_id === "s_visit_ask_0001" && r.section === "ask" && r.page_path === "/ask")).toBe(true);

    const success = rows.find((r) => r.name === "ask_success")!;
    expect(success.query_redacted).toBe("Is it true? mail me at [email] or call [phone]");
    expect(success.payload).toMatchObject({ success: true, result_count: 0 });
    expect(typeof success.payload.hashed_query).toBe("string");
    expect(rows.find((r) => r.name === "ask_cost")!.payload).toMatchObject({ cost_usd: 0.0012, model: "anthropic/claude-sonnet-4.6" });
    expect(rows.find((r) => r.name === "ask_latency")!.payload).toMatchObject({ duration_ms: 42 });

    /* Nowhere in the warehouse — not a column, not a payload value. */
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain("someone@example.org");
    expect(dump).not.toContain("123 4567");
  });

  it("records ask_fail with the error class and stage, and still throws", async () => {
    const db = await freshDatabase();
    const svc = askService(db, {
      guardBudget: async () => {
        throw new ApiError("RATE_LIMITED", "The daily AI budget is exhausted.");
      },
    });
    const thread = await svc.createThread({}, actor);
    await expect(svc.ask(thread.id, { content: RAW_QUESTION }, actor, context())).rejects.toThrow(/budget/);

    const rows = await events(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("ask_fail");
    expect(rows[0]!.payload).toMatchObject({ success: false, error_class: "rate_limited", status: "budget" });
    expect(JSON.stringify(rows)).not.toContain("someone@example.org");
  });

  it("records a missing thread as ask_fail at the thread stage", async () => {
    const db = await freshDatabase();
    const svc = askService(db);
    await expect(svc.ask(crypto.randomUUID(), { content: "Anything?" }, actor, context())).rejects.toThrow(/not found/);
    const rows = await events(db);
    expect(rows[0]).toMatchObject({ name: "ask_fail", payload: { error_class: "not_found", status: "thread" } });
  });

  it("records nothing for DNT/GPC, and nothing unattributed", async () => {
    const db = await freshDatabase();
    const svc = askService(db);
    const thread = await svc.createThread({}, actor);
    await svc.ask(thread.id, { content: "First" }, actor, { ...context(), optOut: true });
    await svc.ask(thread.id, { content: "Second" }, actor, { visitId: null, visitorId: null, pagePath: null, optOut: false });
    await svc.ask(thread.id, { content: "Third" }, actor);

    expect(await events(db)).toHaveLength(0);
    /* No visitor was synthesized either: an API call is not a person. */
    const visitors = await db.execute(sql`SELECT count(*)::int AS n FROM measurement_visitors`);
    expect((visitors.rows[0] as { n: number }).n).toBe(0);
  });

  it("a recorder that throws never fails the turn", async () => {
    const db = await freshDatabase();
    const svc = chatService(db, {
      answer,
      retrieve,
      recordOutcome: async () => {
        throw new Error("measurement is down");
      },
    });
    const thread = await svc.createThread({}, actor);
    const message = await svc.ask(thread.id, { content: "Still answered?" }, actor, context());
    expect(message.content).toBe("Here is what the record says.");
  });
});

describe("visit attribution order", () => {
  it("a server event filed first is upgraded by the browser's tagged collect, never overwritten", async () => {
    const db = await freshDatabase();
    const service = measurementService(db as never);
    await service.recordServerEvent({
      visitId: "s_visit_race_0001",
      visitorId: "v_visitor_race_0001",
      name: "ask_fail",
      payload: { error_class: "internal", status: "model", not_allowed: "dropped" },
    });

    await service.collect(
      {
        visit_id: "s_visit_race_0001",
        visitor_id: "v_visitor_race_0001",
        entry_path: "/ask",
        source: "newsletter",
        medium: "email",
        device: "mobile",
        events: [{ name: "page_view", page_path: "/ask" }],
      },
      { headers: new Headers(), userAgent: "Mozilla/5.0 TestBrowser" },
    );

    const visit = await db.execute(sql`
      SELECT source, source_unknown, medium, device, entry_path FROM measurement_visits WHERE visit_id = 's_visit_race_0001'
    `);
    expect(visit.rows[0]).toMatchObject({ source: "newsletter", source_unknown: false, medium: "email", device: "mobile", entry_path: "/ask" });

    const payload = await db.execute(sql`SELECT payload FROM measurement_events WHERE name = 'ask_fail'`);
    expect((payload.rows[0] as { payload: Record<string, unknown> }).payload).toEqual({ error_class: "internal", status: "model" });
  });

  it("an untagged browser collect leaves an unknown source unknown", async () => {
    const db = await freshDatabase();
    const service = measurementService(db as never);
    const body = {
      visit_id: "s_visit_unknown_01",
      visitor_id: "v_visitor_unknown_01",
      entry_path: "/",
      events: [{ name: "page_view" as const, page_path: "/" }],
    };
    await service.collect(body, { headers: new Headers() });
    await service.collect(body, { headers: new Headers() });
    const visit = await db.execute(sql`SELECT source, source_unknown FROM measurement_visits`);
    expect(visit.rows).toEqual([{ source: "unknown", source_unknown: true }]);
  });

  it("redacts browser-sent query text at the sink as well", async () => {
    const db = await freshDatabase();
    const service = measurementService(db as never);
    await service.collect(
      {
        visit_id: "s_visit_redact_01",
        visitor_id: "v_visitor_redact_01",
        events: [{ name: "search_query", query_redacted: "reach me at a@b.co" }],
      },
      { headers: new Headers() },
    );
    const rows = await events(db);
    expect(rows[0]!.query_redacted).toBe("reach me at [email]");
  });
});

describe("content attribution", () => {
  it("a homepage key, a hub card and an article page view count as one record", async () => {
    expect(measureContentId("publication:abc-123")).toBe("abc-123");
    expect(measureContentId("hero:dana")).toBe("hero:dana");
    expect(measureSection("daily_brief")).toBe("news");
    expect(measureSection("narrative_watch")).toBe("fake-resistance");
    expect(measureSection("innovation")).toBe("people");

    const db = await freshDatabase();
    const service = measurementService(db as never);
    await service.collect(
      {
        visit_id: "s_visit_content_01",
        visitor_id: "v_visitor_content_01",
        events: [
          { name: "exposure", page_path: "/", content_id: "abc-123", section: "news", component_id: "home-news-publication:abc-123" },
          { name: "click_card", page_path: "/geopolitical-brief", content_id: "abc-123", section: "news" },
          { name: "page_view", page_path: "/articles/abc-123", content_id: "abc-123", content_type: "publication" },
        ],
      },
      { headers: new Headers() },
    );
    const screen = await service.consoleScreen("content", { includeStaff: false, includeBots: false });
    const rows = (screen.data as { rows: Array<Record<string, unknown>> }).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ content_id: "abc-123", section: "news", content_type: "publication" });
    expect(Number(rows[0]!.views)).toBe(1);
    expect(Number(rows[0]!.exposures)).toBe(1);
    expect(Number(rows[0]!.clicks)).toBe(1);
  });
});

describe("admin empty states", () => {
  it("reports not connected — with no data — when the tables cannot be read", async () => {
    const broken = {
      execute: async () => {
        throw new Error('relation "measurement_events" does not exist');
      },
    };
    const screen = await measurementService(broken as never).consoleScreen("today", {
      includeStaff: false,
      includeBots: false,
    });
    expect(screen).toMatchObject({ connected: false, empty: "not_connected", messageHe: "המדידה לא מחוברת", data: null });
  });

  it("the console shows 'not connected' when the endpoint itself fails, and ships no sample data", () => {
    const panel = readFileSync(path.join(process.cwd(), "app/admin/MeasurementPanel.tsx"), "utf8");
    expect(panel).toContain('read.state.kind === "failed" || read.state.kind === "unavailable"');
    expect(panel).toContain("המדידה לא מחוברת");
    expect(panel).toContain("אין עדיין נתונים מאז הפעלת המדידה");
    expect(panel).not.toMatch(/\b(sample|demo|mock|fake)Data\b/i);
  });
});
