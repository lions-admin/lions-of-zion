/**
 * Sitewide corrections log — seam function.
 *
 * Returns an honest empty list today: no page built on the shared content
 * library has issued a correction yet. `CorrectionHistory` already renders a
 * "None recorded" state natively for an empty array, so `/corrections` needs
 * no special-casing — this is the "no false live state" principle applied to
 * an empty log, not a placeholder pretending to be one.
 */
import type { Correction } from '@/components/content';

export type CorrectionsLogEntry = Correction & { page: string; slug: string };

export async function getCorrectionsLog(): Promise<CorrectionsLogEntry[]> {
  return [];
}
