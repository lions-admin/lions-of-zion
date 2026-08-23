/**
 * What items are about, and what happened.
 *
 * `event` is the real-world occurrence; `topic` is the subject taxonomy. Both
 * are referenced by items, evidence, news and briefs, which is why they land in
 * Phase 2 rather than alongside the surfaces that use them.
 *
 * Coordinates are plain doubles rather than PostGIS. Nothing in the brief asks
 * a spatial question — no radius search, no polygon containment — and PostGIS
 * is an extension Neon supports but PGlite does not, which would cost the
 * in-process test database for a capability nobody uses.
 */

import { doublePrecision, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { createdAt, isLanguage, nonBlank, primaryId, tsCol, updatedAt } from "./_shared";

export const topic = pgTable(
  "topic",
  {
    id: primaryId(),
    slug: text("slug").notNull().unique(),
    label: text("label").notNull(),
    parentTopicId: uuid("parent_topic_id").references((): AnyPgColumn => topic.id),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [nonBlank(t.label, "topic_is_labelled")],
);

export const event = pgTable(
  "event",
  {
    id: primaryId(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary"),
    eventType: text("event_type"),
    occurredAt: tsCol("occurred_at"),
    occurredUntil: tsCol("occurred_until"),
    locationText: text("location_text"),
    country: text("country"),
    lat: doublePrecision("lat"),
    lon: doublePrecision("lon"),
    /** Events nest: a strike is part of an operation is part of a war. */
    parentEventId: uuid("parent_event_id").references((): AnyPgColumn => event.id),
    language: text("language").notNull().default("en"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("event_by_time").on(t.occurredAt),
    index("event_by_country").on(t.country),
    nonBlank(t.title, "event_is_titled"),
    isLanguage(t.language, "event_language_is_a_tag"),
  ],
);

export type Topic = typeof topic.$inferSelect;
export type Event = typeof event.$inferSelect;
