import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import { ParticleChatLauncher } from "@/components/chat/ParticleChatLauncher";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://lions-of-zion.vercel.app"),
  title: "LIONS OF ZION — Truth Has a Signal",
  description: "A cinematic awakening from digital darkness.",
  openGraph: {
    title: "LIONS OF ZION — Truth Has a Signal",
    description: "A cinematic awakening from digital darkness.",
    images: ["/posters/particle-nav.webp"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable}`}
    >
      <body>
        {children}
        <ParticleChatLauncher />
      </body>
    </html>
  );
}
