import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://www.paypal.com https://www.paypalobjects.com https://accounts.google.com`,
  "style-src 'self' 'unsafe-inline'",
  // `pics.paypal.com` serves the product images PayPal's hosted-buttons SDK
  // injects on /support-us. Those URLs are built by the SDK from the merchant's
  // own button configuration, so they cannot be re-hosted behind an origin
  // already on this list — allowing the host is the only fix. Named exactly
  // rather than as `*.paypal.com`: this is the one image origin observed, and
  // a wildcard here would admit every PayPal subdomain to `img-src`.
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://www.paypal.com https://www.paypalobjects.com https://pics.paypal.com",
  "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  `connect-src 'self' https://*.paypal.com https://*.paypalobjects.com https://accounts.google.com${isDevelopment ? " ws: wss:" : ""}`,
  "frame-src https://www.paypal.com https://*.paypal.com https://accounts.google.com",
  "form-action 'self' https://www.paypal.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Vercel already terminates TLS, but the browser must also be told never to
  // fall back to HTTP on a later visit. This is deliberately absent in local
  // development where HTTPS is not available.
  ...(isDevelopment ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The dev badge sits in the corner the intro plays in.
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/particles/:path*",
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
