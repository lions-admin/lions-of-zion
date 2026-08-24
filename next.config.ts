import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev badge sits in the corner the intro plays in.
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/particles/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
