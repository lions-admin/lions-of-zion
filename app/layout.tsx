import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Sans,
  IBM_Plex_Sans_Hebrew,
  JetBrains_Mono,
  Newsreader,
} from "next/font/google";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site-config";
/* Tailwind first, then the hand-authored system. Both files open with the same
   `@layer theme, base, components, utilities;` statement, so order is pinned
   regardless of how Next chunks them; this import order is the belt to that
   brace. Removing this one line plus `postcss.config.mjs` reverts Tailwind
   entirely — see the note at the top of `app/tailwind.css`. */
import "./tailwind.css";
import "./globals.css";

/*
 * Three faces, three jobs — see the token block in `globals.css` (SYS-003).
 * Newsreader is the editorial display and standfirst voice (variable, with
 * the optical-size axis so it cuts differently at 60px and at 20px); IBM Plex
 * Sans is running text and interface; JetBrains Mono is data only.
 *
 * A fourth face is loaded but deliberately not wired into any token: IBM Plex
 * Sans Hebrew exists for the operations console under `app/admin/**`, which
 * reads in Hebrew because it is the owner's own operating surface. The public
 * site stays English and stays Latin — the variable is declared on the root
 * element so the console can reach it, and `--face-text` is left alone, so
 * nothing outside `admin.module.css`'s `.shell` rule ever renders in it.
 * `tests/english-chrome.test.ts` pins both halves of that.
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-plex-sans",
  display: "swap",
});

/* Hebrew and Latin from one superfamily, so the console's Hebrew sits at the
   same weight and colour as the Latin identifiers beside it. `normal` is the
   only style Google serves for this family — there is no italic, which is why
   no `style` array is passed here as it is for the Latin cut above. */
const plexSansHebrew = IBM_Plex_Sans_Hebrew({
  subsets: ["hebrew"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans-hebrew",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "LIONS OF ZION", template: "%s — LIONS OF ZION" },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "LIONS OF ZION — Truth Has a Signal",
    description: SITE_DESCRIPTION,
    images: ["/posters/particle-nav.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: "LIONS OF ZION — Truth Has a Signal",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`dark ${newsreader.variable} ${plexSans.variable} ${plexSansHebrew.variable} ${jetBrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
