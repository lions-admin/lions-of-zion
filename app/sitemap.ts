import type { MetadataRoute } from "next";
import { defaultNodes } from "@/components/particle-nav/config";

const BASE_URL = "https://lions-of-zion.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE_URL}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    ...defaultNodes.map((node) => ({
      url: `${BASE_URL}${node.href}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
