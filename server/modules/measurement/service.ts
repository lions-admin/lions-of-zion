import "server-only";

import { createHash } from "node:crypto";
import { siteRevision } from "@/server/core/config";
import type { Database } from "@/server/db/client";
import type {
  MeasurementCollect,
  MeasurementConsoleFilter,
  MeasurementConsoleResponse,
  MeasurementEventName,
  MeasurementScreen,
} from "@/server/contracts/measurement";
import { measurementConsoleResponseSchema } from "@/server/contracts/measurement";
import {
  clientEventToInsert,
  measurementRepo,
  type EventInsert,
} from "./repo";

const BOT_UA =
  /bot|crawler|spider|crawling|preview|slurp|facebookexternalhit|bingpreview|yandex|baidu|duckduck|semrush|ahrefs|petalbot|bytespider|gptbot|claudebot|anthropic|openai/i;

const EMPTY_HE = {
  no_data_yet: "אין עדיין נתונים מאז הפעלת המדידה",
  not_connected: "המדידה לא מחוברת",
} as const;

/** Resolve traffic source. Unknown stays unknown — never "direct". */
export function resolveTrafficSource(input: {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  contentLink?: string | null;
  referrer?: string | null;
}): { source: string; sourceUnknown: boolean } {
  const tagged = [input.source, input.medium, input.campaign, input.contentLink]
    .map((v) => v?.trim())
    .find(Boolean);
  if (tagged) {
    return { source: (input.source?.trim() || tagged).toLowerCase(), sourceUnknown: false };
  }
  const ref = input.referrer?.trim();
  if (ref) {
    try {
      const host = new URL(ref).hostname.replace(/^www\./, "");
      if (host) return { source: host.toLowerCase(), sourceUnknown: false };
    } catch {
      return { source: "unknown", sourceUnknown: true };
    }
  }
  return { source: "unknown", sourceUnknown: true };
}

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return BOT_UA.test(ua);
}

/** Redact search/Ask free text: truncate, strip emails/phones. Never store raw Ask. */
export function redactQuery(raw: string | null | undefined, max = 120): string | null {
  if (!raw) return null;
  let text = raw.trim().slice(0, max);
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
  text = text.replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");
  return text || null;
}

export function hashQuery(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return createHash("sha256").update(raw.trim().toLowerCase()).digest("hex").slice(0, 32);
}

function stampEventTime(clientTime: number | undefined, now: Date): Date {
  if (clientTime == null || !Number.isFinite(clientTime)) return now;
  const client = new Date(clientTime);
  if (Number.isNaN(client.getTime())) return now;
  const drift = Math.abs(client.getTime() - now.getTime());
  /* More than 24h off → trust server clock. */
  if (drift > 86_400_000) return now;
  return client;
}

function geoFromHeaders(headers: Headers): { country: string | null; region: string | null; city: string | null } {
  return {
    country: headers.get("x-vercel-ip-country"),
    region: headers.get("x-vercel-ip-country-region"),
    city: headers.get("x-vercel-ip-city"),
  };
}

export function measurementService(db: Database) {
  const repo = measurementRepo(db);

  async function collect(
    body: MeasurementCollect,
    opts: {
      headers: Headers;
      isStaff?: boolean;
      userAgent?: string | null;
    },
  ): Promise<{ accepted: number }> {
    const now = new Date();
    const geo = geoFromHeaders(opts.headers);
    const resolved = resolveTrafficSource({
      source: body.source,
      medium: body.medium,
      campaign: body.campaign,
      contentLink: body.content_link,
      referrer: body.referrer,
    });
    const isBot = isBotUserAgent(opts.userAgent);
    const isStaff = Boolean(opts.isStaff);

    await repo.upsertVisitor(body.visitor_id, now);
    const lastPath =
      [...body.events].reverse().find((e) => e.page_path)?.page_path ?? body.entry_path ?? null;
    await repo.upsertVisit(
      {
        visitId: body.visit_id,
        visitorId: body.visitor_id,
        entryPath: body.entry_path,
        lastPath,
        referrer: body.referrer ?? null,
        source: resolved.source,
        medium: body.medium ?? null,
        campaign: body.campaign ?? null,
        contentLink: body.content_link ?? null,
        device: body.device ?? null,
        os: body.os ?? null,
        browser: body.browser ?? null,
        locale: body.locale ?? null,
        viewport: body.viewport ?? null,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        isStaff,
        isBot,
        sourceUnknown: resolved.sourceUnknown,
      },
      now,
    );

    const revision = siteRevision();
    const rows: EventInsert[] = [];
    for (const event of body.events) {
      if (event.name === "presence") {
        await repo.upsertPresence({
          visitId: body.visit_id,
          visitorId: body.visitor_id,
          path: event.page_path ?? body.entry_path ?? "/",
          at: stampEventTime(event.time, now),
          visible: event.payload?.visible !== false,
        });
      }
      rows.push(
        clientEventToInsert(event, {
          visitId: body.visit_id,
          visitorId: body.visitor_id,
          siteRevision: revision,
          occurredAt: stampEventTime(event.time, now),
          clientOrServer: "browser",
        }),
      );
    }
    const accepted = await repo.insertEvents(rows);
    return { accepted };
  }

  async function recordServerEvent(input: {
    visitId?: string | null;
    visitorId?: string | null;
    name: MeasurementEventName;
    pagePath?: string;
    contentId?: string;
    section?: string;
    queryRedacted?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    /* Server events without a browser visit still need ids — synthesize ephemeral ones. */
    const visitorId = input.visitorId?.trim() || `server:${createHash("sha256").update(String(Date.now())).digest("hex").slice(0, 16)}`;
    const visitId = input.visitId?.trim() || `server-visit:${visitorId}`;
    const now = new Date();
    await repo.upsertVisitor(visitorId, now);
    await repo.upsertVisit(
      {
        visitId,
        visitorId,
        entryPath: input.pagePath ?? null,
        lastPath: input.pagePath ?? null,
        source: "unknown",
        sourceUnknown: true,
        isStaff: false,
        isBot: false,
      },
      now,
    );
    await repo.insertEvents([
      {
        occurredAt: now,
        visitId,
        visitorId,
        name: input.name,
        pagePath: input.pagePath ?? null,
        contentId: input.contentId ?? null,
        section: input.section ?? null,
        queryRedacted: input.queryRedacted ?? null,
        payload: input.payload ?? {},
        siteRevision: siteRevision(),
        clientOrServer: "server",
      },
    ]);
  }

  async function consoleScreen(
    screen: MeasurementScreen,
    filters: MeasurementConsoleFilter,
  ): Promise<MeasurementConsoleResponse> {
    const generatedAt = new Date().toISOString();
    let connected = true;
    try {
      connected = await repo.tablesExist();
    } catch {
      connected = false;
    }
    if (!connected) {
      return measurementConsoleResponseSchema.parse({
        generatedAt,
        screen,
        connected: false,
        empty: "not_connected",
        messageHe: EMPTY_HE.not_connected,
        filters,
        data: null,
      });
    }

    const hasData = await repo.hasAnyEvents();
    if (!hasData) {
      return measurementConsoleResponseSchema.parse({
        generatedAt,
        screen,
        connected: true,
        empty: "no_data_yet",
        messageHe: EMPTY_HE.no_data_yet,
        filters,
        data: null,
      });
    }

    let data: unknown;
    switch (screen) {
      case "now": {
        const active = await repo.activeNow(filters);
        const byPath = new Map<string, number>();
        const bySource = new Map<string, number>();
        for (const row of active) {
          const path = String(row.path ?? "/");
          byPath.set(path, (byPath.get(path) ?? 0) + 1);
          const source = String(row.source ?? "unknown");
          bySource.set(source, (bySource.get(source) ?? 0) + 1);
        }
        data = {
          activeCount: active.length,
          activeWindowSeconds: 60,
          visits: active,
          topPaths: [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
          topSources: [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
        };
        break;
      }
      case "today":
        data = await repo.todaySnapshot(filters);
        break;
      case "content":
        data = { rows: await repo.contentStats(filters) };
        break;
      case "home":
        data = { rows: await repo.homeStats(filters) };
        break;
      case "audience":
        data = { rows: await repo.audienceStats(filters) };
        break;
      case "paths":
        data = await repo.pathStats(filters);
        break;
      case "search":
        data = await repo.searchAskStats(filters);
        break;
      case "ux":
        data = await repo.uxStats(filters);
        break;
      case "errors":
        data = { rows: await repo.errorStats(filters) };
        break;
      case "insights":
        data = { cards: await repo.insights(filters) };
        break;
    }

    return measurementConsoleResponseSchema.parse({
      generatedAt,
      screen,
      connected: true,
      empty: "ok",
      messageHe: null,
      filters,
      data,
    });
  }

  async function prune() {
    return repo.prune();
  }

  return { collect, recordServerEvent, consoleScreen, prune, resolveTrafficSource, redactQuery, hashQuery };
}

export type MeasurementService = ReturnType<typeof measurementService>;
