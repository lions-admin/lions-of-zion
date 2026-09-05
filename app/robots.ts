import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

/**
 * `/pipeline` joined this list on 2026-09-02. It is an internal tool: a
 * hand-drawn map of the backend's own architecture, driven by a scripted
 * simulation rather than by telemetry — `EventTelemetryStream` runs off a
 * hardcoded clock. It is not in `app/sitemap.ts` and never was, but absence
 * from a sitemap is not a rule against indexing, and a crawlable page that
 * animates like a live system while showing nothing of the kind is the sort of
 * thing that gets quoted as one.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/pipeline", "/api/", "/admin", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
