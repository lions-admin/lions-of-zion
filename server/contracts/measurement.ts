/**
 * First-party browsing measurement — zod contracts only.
 *
 * Event names are a stable enum (never button labels). Payload keys are an
 * allowlist; free-text form fields, passwords, tokens, and Ask raw text are
 * refused here.
 */

import { z } from "zod";

export const MEASUREMENT_EVENT_NAMES = [
  "page_view",
  "page_hide",
  "scroll",
  "presence",
  "exposure",
  "click_card",
  "click_nav",
  "click_button",
  "click_link",
  "click_other",
  "rage_click",
  "dead_click",
  "copy_content",
  "share_click",
  "share_copy",
  "open",
  "close",
  "estimated_read",
  "claim_exposure",
  "evidence_open",
  "verdict_reached",
  "sources_open",
  "search_query",
  "search_zero_results",
  "search_result_click",
  "search_refine",
  "search_abandon",
  "ask_open",
  "ask_source_click",
  "ask_copy_answer",
  "ask_feedback",
  "ask_follow_up",
  "ask_success",
  "ask_fail",
  "ask_latency",
  "ask_cost",
  "media_play",
  "media_pause",
  "media_resume",
  "media_progress",
  "media_complete",
  "media_seek",
  "media_mute",
  "media_captions",
  "media_fullscreen",
  "media_error",
  "image_expand",
  "image_gallery",
  "document_open",
  "document_download",
  "web_vital",
  "resource_error",
  "page_error",
  "not_found",
] as const;

export const measurementEventNameSchema = z.enum(MEASUREMENT_EVENT_NAMES);
export type MeasurementEventName = z.infer<typeof measurementEventNameSchema>;

export const measurementClientOrServerSchema = z.enum(["browser", "server"]);
export type MeasurementClientOrServer = z.infer<typeof measurementClientOrServerSchema>;

/** Strict allowlist for event payload keys — no free-text form fields. */
export const MEASUREMENT_PAYLOAD_KEYS = [
  "href",
  "rank",
  "result_count",
  "duration_ms",
  "active_ms",
  "metric",
  "value",
  "rating",
  "status",
  "error_class",
  "media_kind",
  "progress_pct",
  "muted",
  "fullscreen",
  "captions",
  "feedback",
  "zero_results",
  "visible",
  "checkpoint",
  "origin_path",
  "cost_usd",
  "model",
  "latency_ms",
  "success",
  "hashed_query",
  "topic",
] as const;

const payloadValue = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);

export const measurementPayloadSchema = z
  .record(z.string(), payloadValue)
  .superRefine((obj, ctx) => {
    const keys = Object.keys(obj);
    if (keys.length > 24) {
      ctx.addIssue({ code: "custom", message: "payload has too many keys" });
    }
    for (const key of keys) {
      if (!(MEASUREMENT_PAYLOAD_KEYS as readonly string[]).includes(key)) {
        ctx.addIssue({ code: "custom", message: `payload key not allowed: ${key}` });
      }
    }
  });

export const measurementClientEventSchema = z.object({
  name: measurementEventNameSchema,
  time: z.number().finite().optional(),
  page_path: z.string().max(2000).optional(),
  content_id: z.string().max(200).optional(),
  content_type: z.string().max(80).optional(),
  section: z.string().max(80).optional(),
  component_id: z.string().max(200).optional(),
  placement: z.string().max(200).optional(),
  source: z.string().max(120).optional(),
  campaign: z.string().max(120).optional(),
  device: z.string().max(40).optional(),
  headline_version: z.string().max(120).optional(),
  image_id: z.string().max(200).optional(),
  placement_version: z.string().max(120).optional(),
  query_redacted: z.string().max(200).optional(),
  payload: measurementPayloadSchema.optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  scroll_pct: z.number().int().min(0).max(100).optional(),
});
export type MeasurementClientEvent = z.infer<typeof measurementClientEventSchema>;

export const measurementCollectSchema = z
  .object({
    visit_id: z.string().trim().min(8).max(80),
    visitor_id: z.string().trim().min(8).max(80),
    referrer: z.string().max(2000).nullable().optional(),
    entry_path: z.string().max(2000).optional(),
    locale: z.string().max(40).optional(),
    viewport: z.string().max(40).optional(),
    device: z.string().max(40).optional(),
    os: z.string().max(60).optional(),
    browser: z.string().max(60).optional(),
    source: z.string().max(120).optional(),
    medium: z.string().max(120).optional(),
    campaign: z.string().max(120).optional(),
    content_link: z.string().max(200).optional(),
    events: z.array(measurementClientEventSchema).min(1).max(40),
  })
  .superRefine((body, ctx) => {
    const approx = JSON.stringify(body).length;
    if (approx > 100_000) {
      ctx.addIssue({ code: "custom", message: "collect body too large" });
    }
  });
export type MeasurementCollect = z.infer<typeof measurementCollectSchema>;

export const measurementConsoleFilterSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  section: z.string().max(80).optional(),
  contentId: z.string().max(200).optional(),
  source: z.string().max(120).optional(),
  campaign: z.string().max(120).optional(),
  country: z.string().max(8).optional(),
  device: z.string().max(40).optional(),
  audience: z.enum(["all", "new", "returning"]).optional(),
  includeStaff: z.coerce.boolean().optional().default(false),
  includeBots: z.coerce.boolean().optional().default(false),
  visitId: z.string().max(80).optional(),
  path: z.string().max(2000).optional(),
});
export type MeasurementConsoleFilter = z.infer<typeof measurementConsoleFilterSchema>;

export const measurementScreenSchema = z.enum([
  "now",
  "today",
  "content",
  "home",
  "audience",
  "paths",
  "search",
  "ux",
  "errors",
  "insights",
]);
export type MeasurementScreen = z.infer<typeof measurementScreenSchema>;

export const measurementConsoleQuerySchema = measurementConsoleFilterSchema.extend({
  screen: measurementScreenSchema,
});
export type MeasurementConsoleQuery = z.infer<typeof measurementConsoleQuerySchema>;

/** Empty / disconnected states — never invent a measured zero-day. */
export const measurementEmptyKindSchema = z.enum(["no_data_yet", "not_connected", "ok"]);

export const measurementConsoleResponseSchema = z.object({
  generatedAt: z.string(),
  screen: measurementScreenSchema,
  connected: z.boolean(),
  empty: measurementEmptyKindSchema,
  messageHe: z.string().nullable(),
  filters: measurementConsoleFilterSchema,
  data: z.unknown(),
});
export type MeasurementConsoleResponse = z.infer<typeof measurementConsoleResponseSchema>;
