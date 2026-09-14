/**
 * First-party browsing measurement tables.
 *
 * visitor_id is an opaque client id — not a legal identity. Events are
 * append-only facts (see migration 0067); do not run them through recordVersion().
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
import { nonBlank, primaryId, tsCol } from "./_shared";
import type { MeasurementEventName, MeasurementClientOrServer } from "@/server/contracts/measurement";

export const measurementVisitor = pgTable(
  "measurement_visitors",
  {
    visitorId: text("visitor_id").primaryKey(),
    firstSeenAt: tsCol("first_seen_at").notNull().defaultNow(),
    lastSeenAt: tsCol("last_seen_at").notNull().defaultNow(),
    visitCount: integer("visit_count").notNull().default(0),
  },
  (t) => [
    nonBlank(t.visitorId, "measurement_visitors_has_id"),
    check("measurement_visitors_visit_count_nonnegative", sql`${t.visitCount} >= 0`),
  ],
);

export const measurementVisit = pgTable(
  "measurement_visits",
  {
    visitId: text("visit_id").primaryKey(),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => measurementVisitor.visitorId, { onDelete: "cascade" }),
    startedAt: tsCol("started_at").notNull().defaultNow(),
    endedAt: tsCol("ended_at"),
    entryPath: text("entry_path"),
    lastPath: text("last_path"),
    referrer: text("referrer"),
    source: text("source").notNull().default("unknown"),
    medium: text("medium"),
    campaign: text("campaign"),
    contentLink: text("content_link"),
    device: text("device"),
    os: text("os"),
    browser: text("browser"),
    locale: text("locale"),
    viewport: text("viewport"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    isStaff: boolean("is_staff").notNull().default(false),
    isBot: boolean("is_bot").notNull().default(false),
    sourceUnknown: boolean("source_unknown").notNull().default(true),
  },
  (t) => [
    nonBlank(t.visitId, "measurement_visits_has_id"),
    index("measurement_visits_by_visitor").on(t.visitorId, t.startedAt.desc()),
    index("measurement_visits_by_started").on(t.startedAt.desc()),
    index("measurement_visits_by_source").on(t.source, t.startedAt.desc()),
  ],
);

export const measurementEvent = pgTable(
  "measurement_events",
  {
    id: primaryId(),
    occurredAt: tsCol("occurred_at").notNull().defaultNow(),
    visitId: text("visit_id")
      .notNull()
      .references(() => measurementVisit.visitId, { onDelete: "cascade" }),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => measurementVisitor.visitorId, { onDelete: "cascade" }),
    name: text("name").$type<MeasurementEventName>().notNull(),
    pagePath: text("page_path"),
    contentId: text("content_id"),
    contentType: text("content_type"),
    section: text("section"),
    componentId: text("component_id"),
    placement: text("placement"),
    source: text("source"),
    campaign: text("campaign"),
    device: text("device"),
    siteRevision: text("site_revision"),
    clientOrServer: text("client_or_server").$type<MeasurementClientOrServer>().notNull().default("browser"),
    headlineVersion: text("headline_version"),
    imageId: text("image_id"),
    placementVersion: text("placement_version"),
    queryRedacted: text("query_redacted"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    x: doublePrecision("x"),
    y: doublePrecision("y"),
    scrollPct: integer("scroll_pct"),
  },
  (t) => [
    index("measurement_events_by_time").on(t.occurredAt.desc()),
    index("measurement_events_by_visit").on(t.visitId, t.occurredAt),
    index("measurement_events_by_name").on(t.name, t.occurredAt.desc()),
    index("measurement_events_by_content").on(t.contentId, t.occurredAt.desc()),
    index("measurement_events_by_section").on(t.section, t.occurredAt.desc()),
    index("measurement_events_by_path").on(t.pagePath, t.occurredAt.desc()),
    check(
      "measurement_events_client_or_server_known",
      sql`${t.clientOrServer} IN ('browser','server')`,
    ),
    check(
      "measurement_events_scroll_pct_range",
      sql`${t.scrollPct} IS NULL OR (${t.scrollPct} >= 0 AND ${t.scrollPct} <= 100)`,
    ),
  ],
);

export const measurementPresence = pgTable(
  "measurement_presence",
  {
    visitId: text("visit_id")
      .primaryKey()
      .references(() => measurementVisit.visitId, { onDelete: "cascade" }),
    visitorId: text("visitor_id")
      .notNull()
      .references(() => measurementVisitor.visitorId, { onDelete: "cascade" }),
    path: text("path").notNull(),
    lastSeenAt: tsCol("last_seen_at").notNull().defaultNow(),
    visible: boolean("visible").notNull().default(true),
  },
  (t) => [index("measurement_presence_by_seen").on(t.lastSeenAt.desc())],
);

