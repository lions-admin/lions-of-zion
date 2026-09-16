"use client";

import { useRouter } from "next/navigation";

/**
 * The published-record read's one recovery control.
 *
 * The failure state it sits in used to link back to `#activity` — an anchor
 * to itself that could not re-run the read it apologises for. This is a real
 * retry: `router.refresh()` re-requests the route's server components, the
 * `Suspense` boundary re-renders, and `RecentActivity`'s read runs again.
 * The surrounding module CSS is imported by the caller, so the class arrives
 * as a prop and this file stays free of a second styles import.
 */
export function RetryRefresh({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button type="button" className={className} onClick={() => router.refresh()}>
      Try again <span aria-hidden="true">↗︎</span>
    </button>
  );
}
