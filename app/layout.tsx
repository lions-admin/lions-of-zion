import type { Metadata, Viewport } from "next";
import {
  Cinzel,
  DM_Sans,
  Geist,
  Geist_Mono,
  IBM_Plex_Sans,
  JetBrains_Mono,
  Newsreader,
  Ramsina,
} from "next/font/google";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site-config";
import "./globals.css";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

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

const ramsina = Ramsina({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-ramsina",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
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
      className={`${geist.variable} ${geistMono.variable} ${cinzel.variable} ${newsreader.variable} ${plexSans.variable} ${ramsina.variable} ${jetBrainsMono.variable} ${dmSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
