"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./tabs.module.css";

/**
 * Tabs with the ARIA pattern implemented rather than approximated.
 *
 * Everything the pattern actually requires and hand-rolled tab rows on this
 * site do not have: `role="tablist"` with a name, `role="tab"` with
 * `aria-selected` and `aria-controls`, `role="tabpanel"` labelled by its tab,
 * a **roving tabindex** so the row is one stop in the tab order rather than
 * eight, and arrow-key navigation with Home/End — mirrored under `dir="rtl"`,
 * which matters here because the operations surfaces are in Hebrew.
 *
 * `activation="automatic"` (the default) selects as focus moves, which is
 * right when the panels are already rendered. Use `"manual"` when selecting a
 * tab costs something — a fetch, a heavy render — so arrowing through the row
 * does not fire five of them.
 *
 * Tier: a client component. It must not reach the home route. With JavaScript
 * off the default tab's panel renders and the others stay `hidden`, so the
 * content behind an unselected tab is unreachable — never put anything a
 * reader must be able to read behind a tab alone.
 */
export type TabsShape = "underline" | "segmented";
export type TabsActivation = "automatic" | "manual";

interface TabsContextValue {
  value: string;
  select: (value: string) => void;
  activation: TabsActivation;
  baseId: string;
  register: (value: string, node: HTMLButtonElement | null) => void;
  focusRelative: (from: string, step: number | "first" | "last") => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(part: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error(`<${part}> must be rendered inside <Tabs>.`);
  }
  return context;
}

const tabId = (baseId: string, value: string) => `${baseId}-tab-${value}`;
const panelId = (baseId: string, value: string) => `${baseId}-panel-${value}`;

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Controlled selection. Pair with `onValueChange`. */
  value?: string;
  /** Uncontrolled starting selection. This is also the tab whose panel is the
   *  one visible with JavaScript off. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  activation?: TabsActivation;
  children: React.ReactNode;
}

export function Tabs({
  value: controlled,
  defaultValue = "",
  onValueChange,
  activation = "automatic",
  className = "",
  children,
  ...props
}: TabsProps) {
  const baseId = useId();
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;

  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const order = useRef<string[]>([]);

  const select = useCallback(
    (next: string) => {
      if (controlled === undefined) setUncontrolled(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  const register = useCallback((key: string, node: HTMLButtonElement | null) => {
    if (node) {
      nodes.current.set(key, node);
      if (!order.current.includes(key)) order.current.push(key);
    } else {
      nodes.current.delete(key);
      order.current = order.current.filter((k) => k !== key);
    }
  }, []);

  /* Arrow keys move focus among the enabled tabs, wrapping at both ends —
     the wrap is part of the pattern, not a flourish: without it a keyboard
     reader at the last tab has no way back but seven presses of the other
     arrow. */
  const focusRelative = useCallback(
    (from: string, step: number | "first" | "last") => {
      const enabled = order.current.filter((key) => {
        const node = nodes.current.get(key);
        return node && !node.disabled;
      });
      if (enabled.length === 0) return;

      let index: number;
      if (step === "first") {
        index = 0;
      } else if (step === "last") {
        index = enabled.length - 1;
      } else {
        const current = enabled.indexOf(from);
        if (current === -1) return;
        index = (current + step + enabled.length) % enabled.length;
      }

      const next = enabled[index];
      if (next === undefined) return;
      nodes.current.get(next)?.focus();
    },
    [],
  );

  const context = useMemo<TabsContextValue>(
    () => ({ value, select, activation, baseId, register, focusRelative }),
    [value, select, activation, baseId, register, focusRelative],
  );

  return (
    <TabsContext.Provider value={context}>
      <div className={[styles.tabs, className].filter(Boolean).join(" ")} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {
  shape?: TabsShape;
  /** The tab row's accessible name — "Journeys", "Filters". Required unless
   *  `aria-labelledby` points at a visible heading. */
  label?: string;
}

export function TabList({
  shape = "underline",
  label,
  className = "",
  children,
  ...props
}: TabListProps) {
  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={[styles.list, styles[shape], className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
  children: React.ReactNode;
}

export function Tab({ value, className = "", children, onKeyDown, ...props }: TabProps) {
  const { value: selected, select, activation, baseId, register, focusRelative } =
    useTabsContext("Tab");
  const isSelected = selected === value;
  const ref = useRef<HTMLButtonElement | null>(null);

  /* Memoised so React does not tear the ref down and re-attach it on every
     render — an inline arrow changes identity each pass, which would rebuild
     the registry (and therefore the arrow-key order) continuously. */
  const setNode = useCallback(
    (node: HTMLButtonElement | null) => {
      ref.current = node;
      register(value, node);
    },
    [register, value],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      /* Under `dir="rtl"` the visual order is mirrored, so the arrows have to
         be too — otherwise ArrowLeft walks a Hebrew tab row backwards. */
      const rtl =
        typeof window !== "undefined" && ref.current
          ? window.getComputedStyle(ref.current).direction === "rtl"
          : false;
      const forward = rtl ? "ArrowLeft" : "ArrowRight";
      const backward = rtl ? "ArrowRight" : "ArrowLeft";

      let step: number | "first" | "last" | null = null;
      if (event.key === forward) step = 1;
      else if (event.key === backward) step = -1;
      else if (event.key === "Home") step = "first";
      else if (event.key === "End") step = "last";
      if (step === null) return;

      event.preventDefault();
      focusRelative(value, step);
    },
    [focusRelative, onKeyDown, value],
  );

  return (
    <button
      ref={setNode}
      type="button"
      role="tab"
      id={tabId(baseId, value)}
      aria-selected={isSelected}
      aria-controls={panelId(baseId, value)}
      /* The roving tabindex: one stop for the whole row. */
      tabIndex={isSelected ? 0 : -1}
      className={[styles.tab, className].filter(Boolean).join(" ")}
      onClick={() => select(value)}
      onFocus={activation === "automatic" ? () => select(value) : undefined}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children: React.ReactNode;
}

export function TabPanel({ value, className = "", children, ...props }: TabPanelProps) {
  const { value: selected, baseId } = useTabsContext("TabPanel");
  const isSelected = selected === value;

  return (
    <div
      role="tabpanel"
      id={panelId(baseId, value)}
      aria-labelledby={tabId(baseId, value)}
      hidden={!isSelected}
      /* The panel is focusable so a keyboard reader lands in the content
         after leaving the row, and so a panel that scrolls can be scrolled
         from the keyboard. */
      tabIndex={0}
      className={[styles.panel, className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
