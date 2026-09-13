import { afterEach, describe, expect, it, vi } from "vitest";
import {
  measurementCollectSchema,
  measurementEventNameSchema,
} from "@/server/contracts/measurement";
import {
  resolveTrafficSource,
  redactQuery,
  isBotUserAgent,
} from "@/server/modules/measurement/service";
import { createExposureTracker } from "@/components/measurement/exposure";
import { freshDatabase } from "@/server/db/testing";
import { measurementService } from "@/server/modules/measurement/service";

describe("measurement contracts", () => {
  it("rejects unknown event names", () => {
    expect(() => measurementEventNameSchema.parse("click_submit_form")).toThrow();
  });

  it("rejects oversized event batches", () => {
    const events = Array.from({ length: 41 }, () => ({ name: "page_view" as const }));
    expect(() =>
      measurementCollectSchema.parse({
        visit_id: "visit_abcdefgh",
        visitor_id: "visitor_abcdefgh",
        events,
      }),
    ).toThrow();
  });

  it("rejects disallowed payload keys", () => {
    expect(() =>
      measurementCollectSchema.parse({
        visit_id: "visit_abcdefgh",
        visitor_id: "visitor_abcdefgh",
        events: [{ name: "page_view", payload: { password: "nope" } }],
      }),
    ).toThrow();
  });
});

describe("measurement source resolution", () => {
  it("keeps unknown as unknown — never direct", () => {
    expect(resolveTrafficSource({})).toEqual({ source: "unknown", sourceUnknown: true });
    expect(resolveTrafficSource({ referrer: null, source: null })).toEqual({
      source: "unknown",
      sourceUnknown: true,
    });
    expect(resolveTrafficSource({}).source).not.toBe("direct");
  });

  it("uses utm_source when tagged", () => {
    expect(resolveTrafficSource({ source: "newsletter", medium: "email" })).toEqual({
      source: "newsletter",
      sourceUnknown: false,
    });
  });

  it("uses referrer host when present and untagged", () => {
    expect(resolveTrafficSource({ referrer: "https://www.example.com/path" })).toEqual({
      source: "example.com",
      sourceUnknown: false,
    });
  });
});

describe("measurement redaction", () => {
  it("strips emails and phones", () => {
    expect(redactQuery("hello a@b.co call +1 555 123 4567 please")).toBe(
      "hello [email] call [phone] please",
    );
  });
});

describe("bot detection", () => {
  it("flags known bots conservatively", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120")).toBe(false);
  });
});

describe("exposure de-dupe", () => {
  it("marks a component seen only once", () => {
    const seen: string[] = [];
    const tracker = createExposureTracker((id) => seen.push(id));
    tracker.markSeen("card-1");
    expect(tracker.hasSeen("card-1")).toBe(true);
    expect(tracker.hasSeen("card-2")).toBe(false);
    tracker.disconnect();
  });
});

describe("measurement ingest persistence", () => {
  it("persists events to Postgres (PGlite) and keeps unknown source", async () => {
    const db = await freshDatabase();
    const service = measurementService(db as never);
    const headers = new Headers();
    const result = await service.collect(
      {
        visit_id: "visit_test_persist_01",
        visitor_id: "visitor_test_persist_01",
        entry_path: "/",
        events: [
          { name: "page_view", page_path: "/", time: Date.now() },
          { name: "exposure", component_id: "home-news-lead", page_path: "/" },
        ],
      },
      { headers, userAgent: "Mozilla/5.0 TestBrowser" },
    );
    expect(result.accepted).toBe(2);

    const screen = await service.consoleScreen("today", {
      includeStaff: false,
      includeBots: false,
    });
    expect(screen.connected).toBe(true);
    expect(screen.empty).toBe("ok");
    expect(Number((screen.data as { pageviews_today: number }).pageviews_today)).toBeGreaterThanOrEqual(1);

    const audience = await service.consoleScreen("audience", {
      includeStaff: false,
      includeBots: false,
    });
    const rows = (audience.data as { rows: Array<{ source: string }> }).rows;
    expect(rows.some((r) => r.source === "unknown" || r.source === "")).toBe(true);
    expect(rows.every((r) => r.source !== "direct")).toBe(true);
  });
});

describe("collector guards", () => {
  async function load() {
    const { startCollector } = await import("@/components/measurement/collector");
    const { measurementHeaders } = await import("@/components/measurement/headers");
    const { readTaggedSource } = await import("@/components/measurement/source");
    return { startCollector, measurementHeaders, readTaggedSource };
  }

  function stubBrowser(opts: { pathname?: string; dnt?: string; gpc?: boolean; admin?: boolean }) {
    const fetch = vi.fn(async () => new Response(null));
    vi.stubGlobal("window", { location: { pathname: opts.pathname ?? "/", search: "" } });
    vi.stubGlobal("document", {
      querySelector: (selector: string) => (opts.admin && selector.includes("data-surface") ? {} : null),
      documentElement: { querySelector: () => null },
    });
    vi.stubGlobal("navigator", { doNotTrack: opts.dnt, globalPrivacyControl: opts.gpc });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not start, send, or expose ids on the admin surface", async () => {
    const { startCollector, measurementHeaders } = await load();
    for (const opts of [{ pathname: "/admin" }, { admin: true }]) {
      const fetch = stubBrowser(opts);
      expect(startCollector()).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
      expect(measurementHeaders()).toEqual({});
    }
  });

  it("honours DNT and GPC: no collector, no send, no ids for Ask", async () => {
    const { startCollector, measurementHeaders } = await load();
    for (const opts of [{ dnt: "1" }, { gpc: true }]) {
      const fetch = stubBrowser(opts);
      expect(startCollector()).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
      expect(measurementHeaders()).toEqual({});
    }
  });

  it("reads tagged links and leaves an untagged one without a source", async () => {
    const { readTaggedSource } = await load();
    expect(readTaggedSource("?ref=telegram&m=social")).toEqual({
      source: "telegram",
      medium: "social",
      campaign: undefined,
      content_link: undefined,
    });
    expect(readTaggedSource("").source).toBeUndefined();
  });
});
