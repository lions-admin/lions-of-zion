"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "./ConfirmDialog";

const DirtyContext = createContext<(dirty: boolean) => void>(() => {});
export const useUnsavedChanges = () => useContext(DirtyContext);

/** Keep drafts in memory, not browser storage. Intercept navigation before the router. */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirty = useRef(false);
  const [destination, setDestination] = useState<string | null>(null);
  const router = useRouter();
  const setDirty = useCallback((value: boolean) => { dirty.current = value; }, []);

  useEffect(() => {
    let current = window.location.href;
    const click = (event: MouseEvent) => {
      if (!dirty.current || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.href === window.location.href || (url.pathname === window.location.pathname && url.search === window.location.search && url.hash)) return;
      event.preventDefault(); event.stopPropagation();
      setDestination(url.href);
    };
    const pop = (event: PopStateEvent) => {
      if (!dirty.current) { current = window.location.href; return; }
      const target = window.location.href;
      if (target === current) return;
      event.stopImmediatePropagation();
      window.history.pushState(null, "", current);
      setDestination(target);
    };
    const remember = () => { current = window.location.href; };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current) { event.preventDefault(); event.returnValue = ""; }
    };
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop, true);
    window.addEventListener("beforeunload", unload);
    window.addEventListener("loz:editor-open", remember);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", pop, true);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("loz:editor-open", remember);
    };
  }, []);

  return <DirtyContext.Provider value={setDirty}>
    {children}
    <ConfirmDialog intent={destination ? {
      action: "מעבר ללא שמירה", target: "השינויים בכתבה", consequence: "השינויים שטרם נשמרו יימחקו. הגרסה השמורה לא תשתנה.",
      confirmLabel: "מעבר ללא שמירה", tone: "danger", run: () => {
        dirty.current = false;
        window.dispatchEvent(new Event("loz:discard-editor"));
        const target = new URL(destination);
        if (target.origin === window.location.origin) router.push(target.pathname + target.search + target.hash);
        else window.location.assign(target.href);
      },
    } : null} onClose={() => setDestination(null)} />
  </DirtyContext.Provider>;
}
