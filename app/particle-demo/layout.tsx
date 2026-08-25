import type { Metadata } from "next";
import type { ReactNode } from "react";

// page.tsx is a client component, so its metadata lives here instead.
export const metadata: Metadata = {
  title: "Particle demo",
  robots: { index: false, follow: false },
};

export default function ParticleDemoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
