import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://www.paypal.com https://www.paypalobjects.com https://accounts.google.com`,
  /* `accounts.google.com` is here for one stylesheet: Google Identity Services
     loads `/gsi/style` for the button it renders itself, and without this the
     browser blocked it — the button worked but was not wearing Google's own
     styling, which is the part of a sign-in control that must come from the
     identity provider rather than be imitated here.

     Note what is deliberately *not* here. Production raises one other
     violation, `script-src` / `eval`, and it comes from our own bundle
     (`_next/static/.../chunks`), not from Google. Nothing observably breaks,
     so the block is doing its job: `'unsafe-eval'` stays development-only.
     Silencing that violation would trade one of CSP's strongest guarantees for
     tidier console output. The real fix is to find the dependency that calls
     `eval` and remove the call. */
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  /* `pics.paypal.com` serves the donate button's own button artwork. It was
     missing until 2026-09-02, so every image on the PayPal button was blocked
     by CSP in production and `/support-us` logged three console errors —
     which is a `ci-smoke.mjs` failure, since that script tolerates zero. */
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
  // Kept from the retired particle entrance, which the badge used to sit on
  // top of. Harmless either way, and a dev-only surface.
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
