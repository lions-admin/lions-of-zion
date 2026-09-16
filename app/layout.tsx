import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist_Mono, IBM_Plex_Sans_Hebrew, Literata, Schibsted_Grotesk } from "next/font/google";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site-config";
/* Tailwind first, then the hand-authored system. Both files open with the same
   `@layer theme, base, components, utilities;` statement, so order is pinned
   regardless of how Next chunks them; this import order is the belt to that
   brace. Removing this one line plus `postcss.config.mjs` reverts Tailwind
   entirely — see the note at the top of `app/tailwind.css`. */
import "./tailwind.css";
import "./globals.css";
import { PublicSessionProvider } from "@/components/auth/PublicSessionProvider";
import { Analytics } from "@vercel/analytics/next";
import { MeasurementRoot } from "@/components/measurement";

/*
 * Four faces, four jobs — see the token block in `globals.css` (SYS-003) and
 * the 2026-09-15 identity ruling in `.ai/DECISIONS.md`.
 *
 * Schibsted Grotesk is the one family for everything a person wrote: display,
 * running text, interface, kickers. It is a variable font, so no `weight`
 * array is passed and the tokens are free to ask for 400–700 without a second
 * download. Geist Mono is data only — dates, counts, keys, citation numbers.
 * Literata is the one serif and has exactly one job, a human being quoted; it
 * is never above the fold, so it is not preloaded. The three replace the
 * seven families this file loaded until 2026-09-15 (Newsreader, IBM Plex
 * Sans, Inter Tight, Archivo Narrow, Roboto Mono, JetBrains Mono, and the
 * Hebrew face below), which cost 579 kB of preload against a budget the new
 * set clears by more than half.
 *
 * A fourth face is loaded but deliberately not wired into any public token:
 * IBM Plex Sans Hebrew exists for the operations console under `app/admin/**`,
 * which reads in Hebrew because it is the owner's own operating surface. The
 * public site stays English and stays Latin — the variable is declared on the
 * root element so the console can reach it, and `--face-text` is left alone,
 * so nothing outside `[data-surface="admin"]` ever renders in it. It is not
 * preloaded either: no public route needs a byte of it.
 * `tests/english-chrome.test.ts` pins both halves of that.
 */
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-schibsted",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const literata = Literata({
  subsets: ["latin"],
  style: ["normal", "italic"],
  /* The optical-size axis: the quote role sets it at 21–28px and the same
     cut has to read at both ends of that range. */
  axes: ["opsz"],
  variable: "--font-literata",
  display: "swap",
  preload: false,
});

/* Hebrew and Latin from one superfamily, so the console's Hebrew sits at the
   same weight as the Latin identifiers beside it. `normal` is the only style
   Google serves for this family — there is no italic, which is why no `style`
   array is passed here as it is for the Latin cuts above. */
const plexSansHebrew = IBM_Plex_Sans_Hebrew({
  subsets: ["hebrew"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans-hebrew",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "LIONS OF ZION", template: "%s — LIONS OF ZION" },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "LIONS OF ZION — Truth Has a Signal",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "LIONS OF ZION — Investigations, fact checks, and information warfare",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LIONS OF ZION — Truth Has a Signal",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image.png"],
  },
};

/*
 * `viewportFit: "cover"` is what makes `env(safe-area-inset-*)` resolve to a
 * real number on iOS. Without it Next emits `width=device-width,
 * initial-scale=1`, the insets read `0`, and the sixteen safe-area rules this
 * build ships across eight CSS modules — homepage-journey, editorial-intro,
 * sections, ask, investigation, search, site-header, site-footer — are inert.
 * They were written because their authors expected cover; this is the line
 * that lets them do their job. VA-41.
 *
 * It also means the page extends under the notch and the home indicator, so
 * this is not a free flag. Two things must be true alongside it and are
 * tracked with VA-39, the physical-device pass:
 *
 *   1. `--header-h` in `app/globals.css` must absorb `env(safe-area-inset-top)`,
 *      and `.bar` in `site-header.module.css` must take the same value as
 *      `padding-top`. The masthead is `position: fixed; inset: 0 0 auto`, so
 *      under cover its content strip starts at y=0 — under the notch. The two
 *      halves compose exactly (border-box: total stays `--header-h`, the
 *      content strip stays 3.5rem) and neither works alone.
 *   2. Nothing that reads a *left/right* inset may be scoped to a phone-width
 *      query, because left/right insets are non-zero only in landscape, where
 *      a phone is 812-932px wide. `site-header` and `site-footer` were both
 *      corrected here; the sheet in `investigation.module.css` and the intro
 *      overlay in `editorial-intro.module.css` still are not.
 *
 * `themeColor` is the one copy of `--ground` outside the stylesheet (the
 * manifest carries the other); the three move together.
 */
export const viewport: Viewport = {
  themeColor: "#0b1220",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`dark ${schibsted.variable} ${geistMono.variable} ${literata.variable} ${plexSansHebrew.variable}`}
    >
      <body>
        {/* One reading of the reader's session for the whole tree. The header
            and the account page both need it, and two independent fetches
            could disagree about whether anyone is signed in. `children` is
            still rendered on the server — it arrives here as a prop, so this
            client boundary does not pull the pages into the client bundle. */}
        <PublicSessionProvider>{children}</PublicSessionProvider>
        {/* The Ask launcher used to be mounted here as a viewport-fixed pill,
            on the argument that a reader four paragraphs into an article
            could ask without losing their place. It covered content on every
            audited route (UX-07) and gave the cover a different bar from every
            other page (UX-08). It lives in `SiteHeader` now — the bar is fixed
            too, so the argument still holds, and there is nothing left to
            cover the footer with. */}
        {/* It reads the pathname; the boundary keeps a route whose path is
            only known at request time from holding the layout back for it. */}
        <Suspense fallback={null}>
          <MeasurementRoot />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
