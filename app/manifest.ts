import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION } from "@/lib/site-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lions of Zion",
    short_name: "Lions of Zion",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
