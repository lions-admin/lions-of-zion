"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EditorialDesk } from "./EditorialDesk";
import { OpsChat } from "./OpsChat";
import { OverviewPanel } from "./OverviewPanel";
import { PipelinePanel } from "./PipelinePanel";
import { SourcesPanel } from "./SourcesPanel";
import { SystemPanel, type SubArea } from "./SystemPanel";
import { SignOutButton } from "./SignOutButton";
import { formatDate } from "./console-primitives";
import { CONSOLE_CHANGED, CONSOLE_READ, useConsoleRead } from "./useConsoleRead";
import type { Status } from "./briefing-shapes";
import styles from "./workspace.module.css";

export const NAV_GROUPS = [
  { title: "עבודה", entries: [
    ["overview", "תמונת מצב"], ["pipeline", "עיבוד ומהדורות"],
    ["sources", "מקורות"], ["editorial", "כתבות ופרסום"],
  ] },
  { title: "בקרה", entries: [["incidents", "תקלות והתאוששות"], ["costs", "עלויות ושימוש"], ["audit", "יומן פעילות"]] },
  { title: "ניהול", entries: [
    ["users", "משתמשים והרשאות"], ["security", "אבטחה וחיבורים"],
    ["settings", "הגדרות"], ["environment", "סביבה"], ["reports", "דיווחים"],
    ["chat", "שיחות ציבוריות"], ["prompts", "הנחיות למודלים"], ["lineage", "שרשרת המקורות"],
  ] },
] as const;

export function OperationsConsole() {
  const params = useSearchParams();
  const pathname = usePathname();
  const requested = params.get("area") === "system" ? params.get("sub") ?? "users" : params.get("area");
  const entries: ReadonlyArray<readonly [string, string]> = NAV_GROUPS.flatMap<readonly [string, string]>((group) => [...group.entries]);
  const entry = entries.find(([key]) => key === requested);
  const area = entry?.[0] ?? "overview";
  const title = entry?.[1] ?? "תמונת מצב";
  const [signal, setSignal] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMounted, setChatMounted] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<{ area: string; at: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const status = useConsoleRead<Status>("admin/status", { signal });
  const refresh = useCallback(() => setSignal((current) => current + 1), []);

  useEffect(() => {
    const read = (event: Event) => {
      const { path, at } = (event as CustomEvent<{ path: string; at: string }>).detail;
      if (path === "admin/status" && area !== "environment") return;
      setUpdatedAt({ area, at });
    };
    window.addEventListener(CONSOLE_CHANGED, refresh);
    window.addEventListener(CONSOLE_READ, read);
    return () => {
      window.removeEventListener(CONSOLE_CHANGED, refresh);
      window.removeEventListener(CONSOLE_READ, read);
    };
  }, [area, refresh]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [area]);

  const navigation = (mobile = false) => (
    <nav aria-label={mobile ? "ניווט ניהול בנייד" : "ניווט ניהול"} className={styles.navigation}>
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className={styles.navGroup}>
          <p>{group.title}</p>
          {group.entries.map(([key, label]) => (
            <Link key={key} href={`${pathname}?area=${key}`} prefetch={false} scroll={false}
              aria-current={area === key ? "page" : undefined} onClick={() => setNavOpen(false)}>
              {label}
            </Link>
          ))}
        </div>
      ))}
      <Link href="/pipeline" prefetch={false} className={styles.architecture}>מפת המערכת ↗</Link>
    </nav>
  );
  const environments: Record<string, string> = { production: "סביבת ייצור", preview: "סביבת תצוגה מקדימה", development: "סביבה מקומית", test: "סביבת בדיקה" };

  return (
    <div className={styles.workspace}>
      <a className={styles.skipLink} href="#admin-work">דילוג לשטח העבודה</a>
      <aside className={styles.sidebar}>
        <div className={styles.identity}><strong>אריות ציון</strong><span>מרכז שליטה</span></div>
        {navigation()}
        <div className={styles.session}><SignOutButton /></div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <Button className={styles.mobileMenu} variant="secondary" size="sm" onClick={() => setNavOpen(true)} aria-expanded={navOpen} aria-haspopup="dialog">תפריט</Button>
          <div className={styles.pageIdentity}>
            <h1 ref={heading} tabIndex={-1}>{title}</h1>
            <div className={styles.context}>
              <span>{status.state.kind === "ready" ? environments[status.state.value.environment] ?? status.state.value.environment : "סביבה לא זמינה"}</span>
              <span>{updatedAt?.area === area ? `קריאה אחרונה: ${formatDate(updatedAt.at)}` : "ממתין לנתונים"}</span>
            </div>
          </div>
          <div className={styles.toolbar}>
            <Button variant="ghost" size="sm" onClick={refresh}>רענון</Button>
            <Button variant="secondary" size="sm" onClick={() => { setChatMounted(true); setChatOpen(true); }} aria-expanded={chatOpen} aria-haspopup="dialog">עוזר התפעול</Button>
          </div>
        </header>
        <div id="admin-work" className={styles.content} tabIndex={-1}>
          {area === "overview" ? <OverviewPanel signal={signal} />
            : area === "pipeline" ? <PipelinePanel signal={signal} />
              : area === "sources" ? <SourcesPanel signal={signal} />
                : area === "editorial" ? <EditorialDesk signal={signal} />
                  : <SystemPanel key={area} signal={signal} sub={area as SubArea} />}
        </div>
      </div>
      <Dialog open={navOpen} onClose={() => setNavOpen(false)} variant="drawer" title="ניווט" closeLabel="סגירת התפריט" className={styles.navDrawer}>
        {navigation(true)}<SignOutButton />
      </Dialog>
      <Dialog open={chatOpen} onClose={() => setChatOpen(false)} variant="drawer" size="wide" title="עוזר התפעול" closeLabel="סגירת עוזר התפעול" dismissOnBackdrop={false}>
        {chatMounted ? <OpsChat onStateChanged={refresh} /> : null}
      </Dialog>
    </div>
  );
}
