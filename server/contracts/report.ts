/**
 * User-submitted reports of suspected false information (brief §44) —
 * request and response shapes. Zod only.
 */

import { z } from "zod";
import { reportStatusSchema } from "./enums";
import { uuidSchema } from "./item";

export const submitReportSchema = z
  .object({
    url: z.url().max(2_000).optional(),
    body: z.string().trim().max(20_000).optional(),
    /** Optional on purpose. Requiring identity on a misinformation report
     *  chills exactly the reports most worth having. */
    reporterEmail: z.email().max(320).optional(),
    reporterNote: z.string().trim().max(2_000).optional(),
  })
  .refine((v) => Boolean(v.url) || Boolean(v.body?.trim()), {
    message: "A report needs a URL or some text. An empty report is not a report.",
    path: ["body"],
  });
export type SubmitReport = z.infer<typeof submitReportSchema>;

export const triageReportSchema = z.object({
  to: reportStatusSchema,
  /** Required for `closed` and `rejected`; the database refuses it either
   *  way, this is so the API can say which field is missing. */
  resolutionNote: z.string().trim().max(4_000).optional(),
  /** Required when linking or converting to an item. */
  itemId: uuidSchema.optional(),
});
export type TriageReport = z.infer<typeof triageReportSchema>;

export const listReportsSchema = z.object({
  status: reportStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListReports = z.infer<typeof listReportsSchema>;

/**
 * What a reporter is told after submitting.
 *
 * Deliberately minimal: an id and a status, nothing echoed back. Echoing the
 * submitted body would make the endpoint a trivially abusable reflector, and
 * there is nothing here the submitter did not just send.
 */
export const reportReceiptSchema = z.object({
  publicId: z.string(),
  status: reportStatusSchema,
  receivedAt: z.iso.datetime(),
});
export type ReportReceipt = z.infer<typeof reportReceiptSchema>;

/** Which status may follow which. `received` is where everything enters. */
export const LEGAL_REPORT_TRANSITIONS = Object.freeze({
  received: ["triaged", "rejected"],
  triaged: ["investigating", "linked_to_existing_item", "closed", "rejected"],
  investigating: ["linked_to_existing_item", "converted_to_item", "closed"],
  linked_to_existing_item: ["closed", "investigating"],
  converted_to_item: ["closed"],
  closed: ["investigating"],
  rejected: [],
} as const);

export const canTransitionReport = (
  from: keyof typeof LEGAL_REPORT_TRANSITIONS,
  to: string,
): boolean => (LEGAL_REPORT_TRANSITIONS[from] as readonly string[]).includes(to);
