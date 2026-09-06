"use client";

import { usePathname } from "next/navigation";
import { AskDock } from "./AskDock";

export function PublicAskDock() {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null;
  /* The homepage is the one route whose launcher steps aside while reading;
     see the docblock in `AskDock`. */
  return <AskDock home={pathname === "/"} />;
}
