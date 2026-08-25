import { ReportClaimForm } from 'lions-of-zion';

/**
 * The public report-a-claim form. It posts to `POST /api/v1/reports` — the one
 * write path in the system open to an unauthenticated stranger, rate limited
 * to 10 per hour and answering with a receipt rather than the row.
 *
 * The card shows the empty state. Submitting from a preview would hit a real
 * endpoint, so no submitted or success state is previewed here.
 */
export function EmptyForm() {
  return <ReportClaimForm />;
}
