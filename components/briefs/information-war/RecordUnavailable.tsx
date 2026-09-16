"use client";

import { useRouter } from "next/navigation";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";

/**
 * A failed read of the published record, with a control that actually retries.
 *
 * The state used to end on `<Link href="/information-war#activity">Try again</Link>`
 * — a link to the anchor the reader is already standing on. Clicking it moved
 * the scroll position and re-read nothing, so the failure was permanent and
 * the page said otherwise. `router.refresh()` re-runs the server render, which
 * is the read that failed.
 *
 * `absenceStatus("unavailable")` is the cause, stated rather than guessed: a
 * failed read is an error, never an empty record (STATE-005).
 */
export function RecordUnavailable() {
  const router = useRouter();
  return (
    <StatusState
      status={absenceStatus("unavailable")}
      eyebrow="Published record"
      title="The record could not be loaded."
      headingLevel={4}
      description="We cannot show the latest publications right now. No example entries have been substituted."
      actionText="Try again"
      onAction={() => router.refresh()}
    />
  );
}
