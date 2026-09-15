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
  /* Editorial images fetched once from an external publisher are stored in
     this project's own public Blob store and served from there — never
     hotlinked. `img-src` above already allows the host; `next/image` needs to
     be told separately, and `server/contracts/editorial-media.ts` refuses any
     `src` that is not one of these two origins. All three have to agree, and
     this pattern is deliberately no broader than that CSP entry. */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
    ],
    /* AVIF first, WebP second (2026-09-15). The optimizer served WebP only
       until this line; AVIF is 20-40% smaller on the editorial stills and
       every browser the site targets decodes it. The size ladders are the
       measures the system actually renders — the 780px article column, the
       24vw portrait rail on The People of Israel, the 2560 cover — rather
       than the defaults, so a `sizes` attribute lands on a real cut instead
       of the next one up. */
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    deviceSizes: [390, 640, 768, 1024, 1280, 1536, 1920, 2560],
    imageSizes: [96, 160, 240, 320, 480, 640, 780],
  },
  // Kept from the retired particle entrance, which the badge used to sit on
  // top of. Harmless either way, and a dev-only surface.
  /* No `eslint` key: Next 16 removed linting from `next build` entirely, so
     there is nothing here to disable. `npm run lint` and the CI lint job are
     the only places ESLint runs. Type checking during the build is left on
     deliberately — it is the last line of defence on Vercel if a check is
     ever skipped. */
  /* Guarantees the content the server actually reads is in the output.

     `server/modules/homepage/catalog.ts` and `lib/content/{archive,
     fake-resistance-cases}.ts` read `join(process.cwd(), <variable>)`; in the
     catalog's case the file list is derived at runtime from the *contents* of
     `content-packages/homepage/media.json`. Nothing static can resolve that.

     **This does not silence the build warning, and it was not expected to
     once measured.** Turbopack still reports "Dynamic filesystem access
     causes tracing of the whole project" for `/articles/[publicId]`,
     `/geopolitical-brief` and three sibling routes, because the access
     genuinely is dynamic — the warning is about the *shape* of the call, not
     about a missing include. Removing it would mean replacing runtime reads
     with a static import map across the archive loaders, which changes
     working application code to please a tracer; that is a separate,
     deliberate piece of work, not a side effect of a CI change.

     What this earns is that the needed files are named rather than inferred,
     so a future narrowing of the trace cannot silently drop them. Keep the
     list in step with the directories those three modules read. */
  outputFileTracingIncludes: {
    "/": ["./content-packages/homepage/**", "./content-packages/fake-resistance/index.json"],
    "/fake-resistance/**": ["./content-packages/fake-resistance/**"],
    "/october-7/**": ["./content-packages/october7/**", "./content-packages/hamas-massacre/**"],
    "/our-heroes": ["./content-packages/homepage/**"],
    "/israels-story": ["./content-packages/homepage/**"],
  },
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      /* Static media had no cache policy at all until 2026-09-15, so a
         returning reader re-fetched the cover assets on every visit. The
         brand, emblem and video directories are versioned by filename — a
         re-cut is a new name — so they can be immutable for a year. The
         editorial stills under /images are re-issued under the same path by
         the daily run, so they get a day with a week of stale-while-revalidate
         rather than a promise the pipeline cannot keep. */
      ...["/brand/:path*", "/emblems/:path*", "/video/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      })),
      ...["/images/:path*", "/icon-192.png", "/icon-512.png", "/apple-icon.png"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      })),
    ];
  },
};

export default nextConfig;
