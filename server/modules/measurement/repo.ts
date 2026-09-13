import "server-only";

import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import {
  measurementEvent,
  measurementPresence,
  measurementVisit,
  measurementVisitor,
} from "@/server/db/schema";
import type {
  MeasurementClientEvent,
  MeasurementConsoleFilter,
  MeasurementEventName,
} from "@/server/contracts/measurement";

export type VisitUpsert = {
  visitId: string;
  visitorId: string;
  entryPath?: string | null;
  lastPath?: string | null;
  referrer?: string | null;
  source: string;
  medium?: string | null;
  campaign?: string | null;
  contentLink?: string | null;
  device?: string | null;
  os?: string | null;
  browser?: string | null;
  locale?: string | null;
  viewport?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  isStaff: boolean;
  isBot: boolean;
  sourceUnknown: boolean;
};

export type EventInsert = {
  occurredAt: Date;
  visitId: string;
  visitorId: string;
  name: MeasurementEventName;
  pagePath?: string | null;
  contentId?: string | null;
  contentType?: string | null;
  section?: string | null;
  componentId?: string | null;
  placement?: string | null;
  source?: string | null;
  campaign?: string | null;
  device?: string | null;
  siteRevision?: string | null;
  clientOrServer: "browser" | "server";
  headlineVersion?: string | null;
  imageId?: string | null;
  placementVersion?: string | null;
  queryRedacted?: string | null;
  payload: Record<string, unknown>;
  x?: number | null;
  y?: number | null;
  scrollPct?: number | null;
};

export function measurementRepo(db: Database) {
  return {
    async upsertVisitor(visitorId: string, at: Date): Promise<void> {
      await db
        .insert(measurementVisitor)
        .values({
          visitorId,
          firstSeenAt: at,
          lastSeenAt: at,
          visitCount: 0,
        })
        .onConflictDoUpdate({
          target: measurementVisitor.visitorId,
          set: {
            lastSeenAt: at,
          },
        });
    },

    async bumpVisitCount(visitorId: string): Promise<void> {
      await db
        .update(measurementVisitor)
        .set({ visitCount: sql`${measurementVisitor.visitCount} + 1` })
        .where(eq(measurementVisitor.visitorId, visitorId));
    },

    async upsertVisit(input: VisitUpsert, at: Date): Promise<{ created: boolean }> {
      const existing = await db
        .select({ visitId: measurementVisit.visitId })
        .from(measurementVisit)
        .where(eq(measurementVisit.visitId, input.visitId))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(measurementVisit).values({
          visitId: input.visitId,
          visitorId: input.visitorId,
          startedAt: at,
          entryPath: input.entryPath ?? null,
          lastPath: input.lastPath ?? input.entryPath ?? null,
          referrer: input.referrer ?? null,
          source: input.source,
          medium: input.medium ?? null,
          campaign: input.campaign ?? null,
          contentLink: input.contentLink ?? null,
          device: input.device ?? null,
          os: input.os ?? null,
          browser: input.browser ?? null,
          locale: input.locale ?? null,
          viewport: input.viewport ?? null,
          country: input.country ?? null,
          region: input.region ?? null,
          city: input.city ?? null,
          isStaff: input.isStaff,
          isBot: input.isBot,
          sourceUnknown: input.sourceUnknown,
        });
        await this.bumpVisitCount(input.visitorId);
        return { created: true };
      }
      await db
        .update(measurementVisit)
        .set({
          lastPath: input.lastPath ?? input.entryPath ?? null,
          endedAt: at,
          country: sql`COALESCE(${measurementVisit.country}, ${input.country ?? null})`,
          region: sql`COALESCE(${measurementVisit.region}, ${input.region ?? null})`,
          city: sql`COALESCE(${measurementVisit.city}, ${input.city ?? null})`,
          isStaff: sql`${measurementVisit.isStaff} OR ${input.isStaff}`,
          isBot: sql`${measurementVisit.isBot} OR ${input.isBot}`,
        })
        .where(eq(measurementVisit.visitId, input.visitId));
      return { created: false };
    },

    async insertEvents(rows: EventInsert[]): Promise<number> {
      if (rows.length === 0) return 0;
      await db.insert(measurementEvent).values(
        rows.map((row) => ({
          occurredAt: row.occurredAt,
          visitId: row.visitId,
          visitorId: row.visitorId,
          name: row.name,
          pagePath: row.pagePath ?? null,
          contentId: row.contentId ?? null,
          contentType: row.contentType ?? null,
          section: row.section ?? null,
          componentId: row.componentId ?? null,
          placement: row.placement ?? null,
          source: row.source ?? null,
          campaign: row.campaign ?? null,
          device: row.device ?? null,
          siteRevision: row.siteRevision ?? null,
          clientOrServer: row.clientOrServer,
          headlineVersion: row.headlineVersion ?? null,
          imageId: row.imageId ?? null,
          placementVersion: row.placementVersion ?? null,
          queryRedacted: row.queryRedacted ?? null,
          payload: row.payload,
          x: row.x ?? null,
          y: row.y ?? null,
          scrollPct: row.scrollPct ?? null,
        })),
      );
      return rows.length;
    },

    async upsertPresence(input: {
      visitId: string;
      visitorId: string;
      path: string;
      at: Date;
      visible: boolean;
    }): Promise<void> {
      await db
        .insert(measurementPresence)
        .values({
          visitId: input.visitId,
          visitorId: input.visitorId,
          path: input.path,
          lastSeenAt: input.at,
          visible: input.visible,
        })
        .onConflictDoUpdate({
          target: measurementPresence.visitId,
          set: {
            path: input.path,
            lastSeenAt: input.at,
            visible: input.visible,
          },
        });
    },

    async tablesExist(): Promise<boolean> {
      const result = await db.execute(sql`
        SELECT to_regclass('public.measurement_events') IS NOT NULL AS ok
      `);
      const row = result.rows[0] as { ok: boolean } | undefined;
      return Boolean(row?.ok);
    },

    async hasAnyEvents(): Promise<boolean> {
      const result = await db.execute(sql`SELECT 1 FROM measurement_events LIMIT 1`);
      return result.rows.length > 0;
    },

    visitAudienceFilter(filters: MeasurementConsoleFilter): SQL | undefined {
      const parts: SQL[] = [];
      if (!filters.includeStaff) parts.push(sql`v.is_staff = false`);
      if (!filters.includeBots) parts.push(sql`v.is_bot = false`);
      if (filters.source) parts.push(sql`v.source = ${filters.source}`);
      if (filters.campaign) parts.push(sql`v.campaign = ${filters.campaign}`);
      if (filters.country) parts.push(sql`v.country = ${filters.country}`);
      if (filters.device) parts.push(sql`v.device = ${filters.device}`);
      if (filters.audience === "new") parts.push(sql`vis.visit_count = 1`);
      if (filters.audience === "returning") parts.push(sql`vis.visit_count > 1`);
      if (parts.length === 0) return undefined;
      return and(...parts);
    },

    eventTimeFilter(filters: MeasurementConsoleFilter, alias = "e"): SQL | undefined {
      const parts: SQL[] = [];
      if (filters.from) parts.push(sql`${sql.raw(alias)}.occurred_at >= ${filters.from}::timestamptz`);
      if (filters.to) parts.push(sql`${sql.raw(alias)}.occurred_at < ${filters.to}::timestamptz`);
      if (filters.section) parts.push(sql`${sql.raw(alias)}.section = ${filters.section}`);
      if (filters.contentId) parts.push(sql`${sql.raw(alias)}.content_id = ${filters.contentId}`);
      if (filters.path) parts.push(sql`${sql.raw(alias)}.page_path = ${filters.path}`);
      if (parts.length === 0) return undefined;
      return and(...parts);
    },

    async activeNow(filters: MeasurementConsoleFilter) {
      const audience = this.visitAudienceFilter(filters);
      const result = await db.execute(sql`
        SELECT
          p.visit_id,
          p.path,
          p.last_seen_at,
          v.source,
          v.device,
          v.country
        FROM measurement_presence p
        JOIN measurement_visits v ON v.visit_id = p.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = p.visitor_id
        WHERE p.last_seen_at >= now() - interval '60 seconds'
          AND p.visible = true
          ${audience ? sql`AND ${audience}` : sql``}
        ORDER BY p.last_seen_at DESC
        LIMIT 200
      `);
      return result.rows as Array<Record<string, unknown>>;
    },

    async todaySnapshot(filters: MeasurementConsoleFilter) {
      const audience = this.visitAudienceFilter(filters);
      const result = await db.execute(sql`
        WITH bounds AS (
          SELECT
            date_trunc('day', now()) AS today_start,
            date_trunc('day', now()) - interval '1 day' AS yesterday_start,
            date_trunc('day', now()) - interval '7 day' AS week_ago_start
        ),
        base AS (
          SELECT e.occurred_at, e.name, e.visit_id, e.visitor_id
          FROM measurement_events e
          JOIN measurement_visits v ON v.visit_id = e.visit_id
          JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
          WHERE true
            ${audience ? sql`AND ${audience}` : sql``}
        )
        SELECT
          (SELECT count(DISTINCT visitor_id) FROM base, bounds WHERE occurred_at >= bounds.today_start) AS visitors_today,
          (SELECT count(DISTINCT visit_id) FROM base, bounds WHERE occurred_at >= bounds.today_start) AS visits_today,
          (SELECT count(*) FROM base, bounds WHERE occurred_at >= bounds.today_start AND name = 'page_view') AS pageviews_today,
          (SELECT count(DISTINCT visitor_id) FROM base, bounds WHERE occurred_at >= bounds.yesterday_start AND occurred_at < bounds.today_start) AS visitors_yesterday,
          (SELECT count(DISTINCT visit_id) FROM base, bounds WHERE occurred_at >= bounds.yesterday_start AND occurred_at < bounds.today_start) AS visits_yesterday,
          (SELECT count(*) FROM base, bounds WHERE occurred_at >= bounds.yesterday_start AND occurred_at < bounds.today_start AND name = 'page_view') AS pageviews_yesterday,
          (SELECT count(DISTINCT visitor_id) FROM base, bounds WHERE occurred_at >= bounds.week_ago_start AND occurred_at < bounds.today_start) AS visitors_prev_week,
          (SELECT count(DISTINCT visit_id) FROM base, bounds WHERE occurred_at >= bounds.week_ago_start AND occurred_at < bounds.today_start) AS visits_prev_week,
          (SELECT count(*) FROM base, bounds WHERE occurred_at >= bounds.week_ago_start AND occurred_at < bounds.today_start AND name = 'page_view') AS pageviews_prev_week
      `);
      return (result.rows[0] ?? {}) as Record<string, unknown>;
    },

    async contentStats(filters: MeasurementConsoleFilter) {
      const audience = this.visitAudienceFilter(filters);
      const time = this.eventTimeFilter(filters);
      const result = await db.execute(sql`
        SELECT
          e.content_id,
          e.section,
          e.content_type,
          count(*) FILTER (WHERE e.name = 'page_view') AS views,
          count(*) FILTER (WHERE e.name = 'exposure') AS exposures,
          count(*) FILTER (WHERE e.name LIKE 'click_%') AS clicks,
          count(*) FILTER (WHERE e.name = 'estimated_read') AS estimated_reads,
          count(*) FILTER (WHERE e.name IN ('share_click','share_copy')) AS shares,
          count(*) FILTER (WHERE e.name = 'evidence_open') AS evidence_opens,
          count(DISTINCT e.visitor_id) AS unique_visitors
        FROM measurement_events e
        JOIN measurement_visits v ON v.visit_id = e.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
        WHERE e.content_id IS NOT NULL
          ${audience ? sql`AND ${audience}` : sql``}
          ${time ? sql`AND ${time}` : sql``}
        GROUP BY e.content_id, e.section, e.content_type
        ORDER BY views DESC
        LIMIT 200
      `);
      return result.rows as Array<Record<string, unknown>>;
    },

    async homeStats(filters: MeasurementConsoleFilter) {
      const audience = this.visitAudienceFilter(filters);
      const time = this.eventTimeFilter(filters);
      const result = await db.execute(sql`
        SELECT
          e.component_id,
          e.placement,
          e.section,
          e.device,
          count(*) FILTER (WHERE e.name = 'exposure') AS exposures,
          count(DISTINCT e.visitor_id) FILTER (WHERE e.name = 'exposure') AS unique_exposed,
          count(*) FILTER (WHERE e.name LIKE 'click_%') AS clicks,
          count(*) FILTER (WHERE e.name IN ('share_click','share_copy')) AS shares,
          avg((e.payload->>'active_ms')::float) FILTER (WHERE e.name = 'page_hide') AS avg_dwell_ms
        FROM measurement_events e
        JOIN measurement_visits v ON v.visit_id = e.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
        WHERE e.page_path = '/'
          AND e.component_id IS NOT NULL
          ${audience ? sql`AND ${audience}` : sql``}
          ${time ? sql`AND ${time}` : sql``}
        GROUP BY e.component_id, e.placement, e.section, e.device
        ORDER BY exposures DESC
        LIMIT 200
      `);
      return result.rows as Array<Record<string, unknown>>;
    },

    async audienceStats(filters: MeasurementConsoleFilter) {
      const audience = this.visitAudienceFilter(filters);
      const time = this.eventTimeFilter(filters);
      const result = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(v.source, ''), 'unknown') AS source,
          COALESCE(v.referrer, '') AS referrer,
          COALESCE(v.campaign, '') AS campaign,
          COALESCE(v.country, '') AS country,
          COALESCE(v.device, '') AS device,
          extract(dow FROM v.started_at)::int AS dow,
          extract(hour FROM v.started_at)::int AS hour,
          count(DISTINCT v.visit_id) AS visits,
          count(DISTINCT v.visitor_id) AS visitors
        FROM measurement_visits v
        JOIN measurement_visitors vis ON vis.visitor_id = v.visitor_id
        WHERE true
          ${audience ? sql`AND ${audience}` : sql``}
          ${filters.from ? sql`AND v.started_at >= ${filters.from}::timestamptz` : sql``}
          ${filters.to ? sql`AND v.started_at < ${filters.to}::timestamptz` : sql``}
        GROUP BY 1,2,3,4,5,6,7
        ORDER BY visits DESC
        LIMIT 500
      `);
      void time;
      return result.rows as Array<Record<string, unknown>>;
    },

    async pathStats(filters: MeasurementConsoleFilter) {
      const audience = this.visitAudienceFilter(filters);
      const time = this.eventTimeFilter(filters);
      const pairs = await db.execute(sql`
        SELECT
          a.page_path AS from_path,
          b.page_path AS to_path,
          count(*) AS transitions
        FROM measurement_events a
        JOIN measurement_events b
          ON a.visit_id = b.visit_id
         AND b.occurred_at > a.occurred_at
         AND a.name = 'page_view'
         AND b.name = 'page_view'
        JOIN measurement_visits v ON v.visit_id = a.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = a.visitor_id
        WHERE true
          ${audience ? sql`AND ${audience}` : sql``}
          ${time ? sql`AND ${time}` : sql``}
        GROUP BY a.page_path, b.page_path
        ORDER BY transitions DESC
        LIMIT 100
      `);

      const sequences = filters.visitId
        ? await db.execute(sql`
            SELECT e.occurred_at, e.name, e.page_path, e.component_id, e.content_id
            FROM measurement_events e
            WHERE e.visit_id = ${filters.visitId}
            ORDER BY e.occurred_at ASC
            LIMIT 500
          `)
        : { rows: [] };

      return {
        pairs: pairs.rows as Array<Record<string, unknown>>,
        sequence: sequences.rows as Array<Record<string, unknown>>,
      };
    },

    async searchAskStats(filters: MeasurementConsoleFilter) {
      const audience = this.visitAudienceFilter(filters);
      const time = this.eventTimeFilter(filters);
      const search = await db.execute(sql`
        SELECT
          e.query_redacted,
          e.name,
          count(*) AS n,
          avg(NULLIF(e.payload->>'rank','')::float) AS avg_rank
        FROM measurement_events e
        JOIN measurement_visits v ON v.visit_id = e.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
        WHERE e.name IN ('search_query','search_zero_results','search_result_click','search_refine','search_abandon')
          ${audience ? sql`AND ${audience}` : sql``}
          ${time ? sql`AND ${time}` : sql``}
        GROUP BY e.query_redacted, e.name
        ORDER BY n DESC
        LIMIT 200
      `);

      const ask = await db.execute(sql`
        SELECT
          e.name,
          count(*) AS n,
          avg(NULLIF(e.payload->>'latency_ms','')::float) AS avg_latency_ms,
          avg(NULLIF(e.payload->>'cost_usd','')::float) AS avg_cost_usd,
          sum(NULLIF(e.payload->>'cost_usd','')::float) AS sum_cost_usd
        FROM measurement_events e
        JOIN measurement_visits v ON v.visit_id = e.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
        WHERE e.name IN ('ask_open','ask_success','ask_fail','ask_latency','ask_cost','ask_source_click','ask_copy_answer','ask_feedback','ask_follow_up')
          ${audience ? sql`AND ${audience}` : sql``}
          ${time ? sql`AND ${time}` : sql``}
        GROUP BY e.name
        ORDER BY n DESC
      `);

      /* Join chat cost ledger when present — do not invent a second ledger. */
      let chatCosts: Array<Record<string, unknown>> = [];
      try {
        const costs = await db.execute(sql`
          SELECT
            date_trunc('day', created_at) AS day,
            count(*) AS runs,
            coalesce(sum(cost_usd), 0) AS cost_usd
          FROM ai_run
          WHERE kind = 'chat'
            ${filters.from ? sql`AND created_at >= ${filters.from}::timestamptz` : sql``}
            ${filters.to ? sql`AND created_at < ${filters.to}::timestamptz` : sql``}
          GROUP BY 1
          ORDER BY 1 DESC
          LIMIT 30
        `);
        chatCosts = costs.rows as Array<Record<string, unknown>>;
      } catch {
        chatCosts = [];
      }

      return {
        search: search.rows as Array<Record<string, unknown>>,
        ask: ask.rows as Array<Record<string, unknown>>,
        chatCosts,
      };
    },

    async uxStats(filters: MeasurementConsoleFilter) {
      const audience = this.visitAudienceFilter(filters);
      const time = this.eventTimeFilter(filters);
      const heatmap = await db.execute(sql`
        SELECT
          width_bucket(e.x, 0, 1, 20) AS bx,
          width_bucket(e.y, 0, 1, 20) AS by,
          count(*) AS n
        FROM measurement_events e
        JOIN measurement_visits v ON v.visit_id = e.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
        WHERE e.name LIKE 'click_%'
          AND e.x IS NOT NULL AND e.y IS NOT NULL
          ${audience ? sql`AND ${audience}` : sql``}
          ${time ? sql`AND ${time}` : sql``}
          ${filters.path ? sql`AND e.page_path = ${filters.path}` : sql``}
        GROUP BY 1, 2
        ORDER BY n DESC
        LIMIT 400
      `);

      const scrolls = await db.execute(sql`
        SELECT e.scroll_pct, count(*) AS n
        FROM measurement_events e
        JOIN measurement_visits v ON v.visit_id = e.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
        WHERE e.name = 'scroll' AND e.scroll_pct IS NOT NULL
          ${audience ? sql`AND ${audience}` : sql``}
          ${time ? sql`AND ${time}` : sql``}
        GROUP BY e.scroll_pct
        ORDER BY e.scroll_pct
      `);

      const reconstruction = filters.visitId
        ? await db
            .select({
              occurredAt: measurementEvent.occurredAt,
              name: measurementEvent.name,
              pagePath: measurementEvent.pagePath,
              componentId: measurementEvent.componentId,
              contentId: measurementEvent.contentId,
              scrollPct: measurementEvent.scrollPct,
              x: measurementEvent.x,
              y: measurementEvent.y,
            })
            .from(measurementEvent)
            .where(eq(measurementEvent.visitId, filters.visitId))
            .orderBy(measurementEvent.occurredAt)
            .limit(500)
        : [];

      return {
        heatmap: heatmap.rows as Array<Record<string, unknown>>,
        scrolls: scrolls.rows as Array<Record<string, unknown>>,
        reconstruction,
      };
    },

    async errorStats(filters: MeasurementConsoleFilter) {
      const audience = this.visitAudienceFilter(filters);
      const time = this.eventTimeFilter(filters);
      const result = await db.execute(sql`
        SELECT
          e.name,
          e.page_path,
          e.payload->>'metric' AS metric,
          e.payload->>'error_class' AS error_class,
          count(*) AS n,
          count(DISTINCT e.visit_id) AS visits_affected,
          avg(NULLIF(e.payload->>'value','')::float) AS avg_value
        FROM measurement_events e
        JOIN measurement_visits v ON v.visit_id = e.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
        WHERE e.name IN ('web_vital','resource_error','page_error','not_found','media_error')
          ${audience ? sql`AND ${audience}` : sql``}
          ${time ? sql`AND ${time}` : sql``}
        GROUP BY 1,2,3,4
        ORDER BY n DESC
        LIMIT 200
      `);
      return result.rows as Array<Record<string, unknown>>;
    },

    async insights(filters: MeasurementConsoleFilter) {
      const audience = this.visitAudienceFilter(filters);
      const cards: Array<Record<string, unknown>> = [];

      const traffic = await db.execute(sql`
        WITH bounds AS (
          SELECT
            now() - interval '1 day' AS cur_start,
            now() - interval '2 day' AS prev_start,
            now() - interval '1 day' AS prev_end
        ),
        cur AS (
          SELECT count(DISTINCT e.visit_id) AS n
          FROM measurement_events e
          JOIN measurement_visits v ON v.visit_id = e.visit_id
          JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
          , bounds
          WHERE e.occurred_at >= bounds.cur_start
            ${audience ? sql`AND ${audience}` : sql``}
        ),
        prev AS (
          SELECT count(DISTINCT e.visit_id) AS n
          FROM measurement_events e
          JOIN measurement_visits v ON v.visit_id = e.visit_id
          JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
          , bounds
          WHERE e.occurred_at >= bounds.prev_start AND e.occurred_at < bounds.prev_end
            ${audience ? sql`AND ${audience}` : sql``}
        )
        SELECT cur.n AS current_n, prev.n AS previous_n FROM cur, prev
      `);
      const t = traffic.rows[0] as { current_n: string | number; previous_n: string | number } | undefined;
      if (t) {
        const current = Number(t.current_n);
        const previous = Number(t.previous_n);
        const n = current + previous;
        cards.push({
          id: "traffic_change",
          metric: "visits_day_over_day",
          period: "1d vs prior 1d",
          n,
          current,
          previous,
          noteHe: n < 20 ? "מדגם קטן" : n < 50 ? null : current > previous * 1.5 ? "עלייה חדה יחסית לתקופה הקודמת" : current < previous * 0.5 ? "ירידה חדה יחסית לתקופה הקודמת" : null,
        });
      }

      const ctr = await db.execute(sql`
        SELECT
          e.component_id,
          count(*) FILTER (WHERE e.name = 'exposure') AS exposures,
          count(*) FILTER (WHERE e.name LIKE 'click_%') AS clicks
        FROM measurement_events e
        JOIN measurement_visits v ON v.visit_id = e.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
        WHERE e.page_path = '/' AND e.component_id IS NOT NULL
          ${audience ? sql`AND ${audience}` : sql``}
        GROUP BY e.component_id
        HAVING count(*) FILTER (WHERE e.name = 'exposure') >= 20
        ORDER BY (count(*) FILTER (WHERE e.name LIKE 'click_%')::float / NULLIF(count(*) FILTER (WHERE e.name = 'exposure'),0)) ASC
        LIMIT 10
      `);
      for (const row of ctr.rows as Array<Record<string, unknown>>) {
        const exposures = Number(row.exposures);
        const clicks = Number(row.clicks);
        cards.push({
          id: `low_ctr:${row.component_id}`,
          metric: "homepage_exposure_low_ctr",
          period: "all",
          n: exposures,
          componentId: row.component_id,
          exposures,
          clicks,
          ctr: exposures ? clicks / exposures : 0,
          noteHe: exposures < 20 ? "מדגם קטן" : "חשיפה גבוהה יחסית להקלקות — אין טענת סיבתיות",
        });
      }

      const zero = await db.execute(sql`
        SELECT count(*) AS n
        FROM measurement_events e
        JOIN measurement_visits v ON v.visit_id = e.visit_id
        JOIN measurement_visitors vis ON vis.visitor_id = e.visitor_id
        WHERE e.name = 'search_zero_results'
          ${audience ? sql`AND ${audience}` : sql``}
      `);
      const zeroN = Number((zero.rows[0] as { n: string | number } | undefined)?.n ?? 0);
      cards.push({
        id: "zero_results",
        metric: "search_zero_results",
        period: "all",
        n: zeroN,
        noteHe: zeroN < 20 ? "מדגם קטן" : null,
      });

      return cards;
    },

    async prune(): Promise<{ eventsDeleted: number; presenceDeleted: number }> {
      const result = await db.execute(sql`SELECT * FROM prune_measurement()`);
      const row = result.rows[0] as
        | { events_deleted: string | number; presence_deleted: string | number }
        | undefined;
      return {
        eventsDeleted: Number(row?.events_deleted ?? 0),
        presenceDeleted: Number(row?.presence_deleted ?? 0),
      };
    },
  };
}

export type MeasurementRepo = ReturnType<typeof measurementRepo>;

/** Map a client event onto an insert row (shared with service). */
export function clientEventToInsert(
  event: MeasurementClientEvent,
  ctx: {
    visitId: string;
    visitorId: string;
    siteRevision: string | null;
    occurredAt: Date;
    clientOrServer?: "browser" | "server";
  },
): EventInsert {
  return {
    occurredAt: ctx.occurredAt,
    visitId: ctx.visitId,
    visitorId: ctx.visitorId,
    name: event.name,
    pagePath: event.page_path ?? null,
    contentId: event.content_id ?? null,
    contentType: event.content_type ?? null,
    section: event.section ?? null,
    componentId: event.component_id ?? null,
    placement: event.placement ?? null,
    source: event.source ?? null,
    campaign: event.campaign ?? null,
    device: event.device ?? null,
    siteRevision: ctx.siteRevision,
    clientOrServer: ctx.clientOrServer ?? "browser",
    headlineVersion: event.headline_version ?? null,
    imageId: event.image_id ?? null,
    placementVersion: event.placement_version ?? null,
    queryRedacted: event.query_redacted ?? null,
    payload: event.payload ?? {},
    x: event.x ?? null,
    y: event.y ?? null,
    scrollPct: event.scroll_pct ?? null,
  };
}

// keep drizzle helpers available for typed selects above
void desc;
void eq;
void gte;
void lt;
