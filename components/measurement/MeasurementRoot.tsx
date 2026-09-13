"use client";

/**
 * Mounts the first-party browsing collector on the public site only.
 * Skips when an admin surface is present. Failures are swallowed inside
 * the collector so the site never breaks.
 */
import { useEffect } from "react";
import { startCollector } from "./collector";

export function MeasurementRoot() {
  useEffect(() => {
    let collector: ReturnType<typeof startCollector> = null;
    try {
      collector = startCollector();
    } catch {
      collector = null;
    }
    return () => {
      try {
        collector?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);
  return null;
}
