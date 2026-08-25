import type { Metadata, Viewport } from "next";
import { Cinzel, Geist, Geist_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { ParticleChatLauncher } from "@/components/chat/ParticleChatLauncher";
import { ChatOpenProvider } from "@/components/chat/chat-open-context";
import { SITE_URL } from "@/lib/site-config";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

/* Cinzel is now the home particle scene's voice only. The reading pages moved
   to Newsreader/Plex in the V2 type pass — see `.ai/DESIGN-V2.md`. */
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

/* Newsreader carries an `opsz` axis (6–72): the same family renders with
   display proportions at headline sizes and text proportions at reading
   sizes. Declaring the axis range here is what makes `font-optical-sizing`
   in globals.css actually do something — without it the browser gets one
   static cut and the face loses the reason it was chosen. */
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "LIONS OF ZION", template: "%s — LIONS OF ZION" },
  description: "A cinematic awakening from digital darkness.",
  // Section pages override title/description; app/opengraph-image.tsx
  // supplies the og:image (file-based metadata outranks this images entry).
  openGraph: {
    title: "LIONS OF ZION — Truth Has a Signal",
    description: "A cinematic awakening from digital darkness.",
    images: ["/posters/particle-nav.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: "LIONS OF ZION — Truth Has a Signal",
    description: "A cinematic awakening from digital darkness.",
  },
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} ${newsreader.variable} ${plexSans.variable}`}
    >
      <body>
        <ChatOpenProvider>
          {children}
          <ParticleChatLauncher />
        </ChatOpenProvider>
      </body>
    </html>
  );
}
