"use client";

import { usePathname } from "next/navigation";
import { AskDock } from "./AskDock";

export function PublicAskDock() {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null;
  return <AskDock />;
}
