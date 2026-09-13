"use client";

/**
 * Mounts the first-party browsing collector on the public site only.
 * Skips when an admin surface is present. Failures are swallowed inside
 * the collector so the site never breaks.
 *
 * The root layout does not remount on a client-side navigation, so the path
 * is watched here: the first path starts the collector (which records its
 * own page view), every later one is a `pageView`. Without this, a visit that
 * arrived on the homepage and read three articles recorded one page view.
 */
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { startCollector, type MeasurementCollector } from "./collector";

export function MeasurementRoot() {
  const pathname = usePathname();
  const collector = useRef<MeasurementCollector | null>(null);

  useEffect(() => {
    try {
      if (!collector.current) collector.current = startCollector();
      else collector.current.pageView();
    } catch {
      /* ignore — measurement must never break the site */
    }
  }, [pathname]);

  useEffect(
    () => () => {
      try {
        collector.current?.stop();
      } catch {
        /* ignore */
      }
      collector.current = null;
    },
    [],
  );

  return null;
}
