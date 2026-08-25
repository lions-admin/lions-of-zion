import type { MetadataRoute } from "next";
import { defaultNodes } from "@/components/particle-nav/config";
import { SITE_URL } from "@/lib/site-config";

const DOC_PAGES = ["/methodology", "/corrections"];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    ...defaultNodes.map((node) => ({
      url: `${SITE_URL}${node.href}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...DOC_PAGES.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}
