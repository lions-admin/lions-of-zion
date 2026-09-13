"use client";

import { createExposureTracker } from "./exposure";
import { readOrCreateVisitId, readOrCreateVisitorId } from "./ids";
import { deviceClass, honourDoNotTrack, readTaggedSource } from "./source";

type EventName = string;

type QueuedEvent = {
  name: EventName;
  time: number;
  page_path?: string;
  content_id?: string;
  content_type?: string;
  section?: string;
  component_id?: string;
  placement?: string;
  source?: string;
  campaign?: string;
  device?: string;
  query_redacted?: string;
  payload?: Record<string, string | number | boolean | null>;
  x?: number;
  y?: number;
  scroll_pct?: number;
};

const COLLECT_URL = "/api/v1/measurement/collect";
const FLUSH_MS = 2000;
const BATCH = 10;
const HEARTBEAT_MS = 15_000;
const SCROLL_MARKS = [25, 50, 75, 90, 100] as const;

function attrsFrom(el: Element | null): Partial<QueuedEvent> {
  if (!el) return {};
  const node = el.closest("[data-measure-id]") ?? el;
  return {
    component_id: node.getAttribute("data-measure-id") ?? undefined,
    content_id: node.getAttribute("data-measure-content") ?? undefined,
    content_type: node.getAttribute("data-measure-type") ?? undefined,
    section: node.getAttribute("data-measure-section") ?? undefined,
    placement: node.getAttribute("data-measure-placement") ?? undefined,
  };
}

function clickName(el: Element): EventName {
  const forced = el.closest("[data-measure-event]")?.getAttribute("data-measure-event");
  if (forced) return forced;
  if (el.closest("nav, [data-measure-nav]")) return "click_nav";
  if (el.closest("article, [data-home-record], [data-measure-card]")) return "click_card";
  if (el.closest("button, [role='button']")) return "click_button";
  if (el.closest("a")) return "click_link";
  return "click_other";
}

function isInteractive(el: Element): boolean {
  return Boolean(
    el.closest("a, button, input, select, textarea, summary, [role='button'], [role='link'], [data-measure-id]"),
  );
}

export type MeasurementCollector = {
  track: (event: QueuedEvent) => void;
  flush: (beacon?: boolean) => void;
  stop: () => void;
};

/**
 * Browser collector. Every send is best-effort: errors are swallowed so
 * measurement never breaks the public site.
 */
export function startCollector(): MeasurementCollector | null {
  if (typeof window === "undefined") return null;
  if (document.documentElement.querySelector("[data-surface='admin']")) return null;
  if (honourDoNotTrack()) return null;

  const visitorId = readOrCreateVisitorId();
  const visitId = readOrCreateVisitId();
  const tagged = readTaggedSource(window.location.search);
  const queue: QueuedEvent[] = [];
  const scrollSeen = new Set<number>();
  const clickTimes = new Map<string, number[]>();
  let activeMs = 0;
  let activeStarted = document.visibilityState === "visible" ? Date.now() : 0;
  let flushTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let stopped = false;

  const track = (event: QueuedEvent) => {
    if (stopped) return;
    queue.push({
      ...event,
      time: event.time ?? Date.now(),
      page_path: event.page_path ?? window.location.pathname,
      device: event.device ?? deviceClass(),
      source: event.source ?? tagged.source,
      campaign: event.campaign ?? tagged.campaign,
    });
    if (queue.length >= BATCH) flush();
    else scheduleFlush();
  };

  const scheduleFlush = () => {
    if (flushTimer != null) return;
    flushTimer = window.setTimeout(() => {
      flushTimer = null;
      flush();
    }, FLUSH_MS);
  };

  const flush = (beacon = false) => {
    if (queue.length === 0) return;
    const events = queue.splice(0, queue.length);
    const body = JSON.stringify({
      visit_id: visitId,
      visitor_id: visitorId,
      referrer: document.referrer || null,
      entry_path: window.location.pathname,
      locale: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      device: deviceClass(),
      ...tagged,
      events,
    });
    try {
      if (beacon && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(COLLECT_URL, blob);
        return;
      }
      void fetch(COLLECT_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => {
        /* ignore — measurement must never break the site */
      });
    } catch {
      /* ignore */
    }
  };

  const pauseActive = () => {
    if (activeStarted) {
      activeMs += Date.now() - activeStarted;
      activeStarted = 0;
    }
  };
  const resumeActive = () => {
    if (!activeStarted && document.visibilityState === "visible") {
      activeStarted = Date.now();
    }
  };

  track({ name: "page_view", time: Date.now() });

  const onScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max <= 0 ? 100 : Math.min(100, Math.round((window.scrollY / max) * 100));
    for (const mark of SCROLL_MARKS) {
      if (pct >= mark && !scrollSeen.has(mark)) {
        scrollSeen.add(mark);
        track({ name: "scroll", time: Date.now(), scroll_pct: mark, payload: { checkpoint: mark } });
      }
    }
    maybeEstimatedRead();
  };

  const maybeEstimatedRead = () => {
    const body = document.querySelector("[data-measure-id='article-body']");
    const sources = document.querySelector("[data-measure-id='article-sources']");
    if (!body || !sources) return;
    const bodyVisible = body.getBoundingClientRect().top < window.innerHeight;
    const sourcesVisible = sources.getBoundingClientRect().top < window.innerHeight;
    const active = activeMs + (activeStarted ? Date.now() - activeStarted : 0);
    if (bodyVisible && sourcesVisible && active >= 30_000) {
      track({
        name: "estimated_read",
        time: Date.now(),
        ...attrsFrom(body),
        payload: { active_ms: active },
      });
      /* fire once */
      document.removeEventListener("scroll", onScroll);
    }
  };

  const exposure = createExposureTracker((componentId, el) => {
    track({
      name: "exposure",
      time: Date.now(),
      ...attrsFrom(el),
      component_id: componentId,
    });
  });

  const scanExposures = () => {
    document.querySelectorAll("[data-measure-id]").forEach((el) => exposure.observe(el));
  };
  scanExposures();
  const mo = typeof MutationObserver !== "undefined"
    ? new MutationObserver(() => scanExposures())
    : null;
  mo?.observe(document.body, { childList: true, subtree: true });

  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target) return;
    const keyed = target.closest("[data-measure-id], a, button, [role='button']") ?? target;
    const key = keyed.getAttribute?.("data-measure-id") || keyed.tagName || "unknown";
    const now = Date.now();
    const times = (clickTimes.get(key) ?? []).filter((t) => now - t < 1500);
    times.push(now);
    clickTimes.set(key, times);
    if (times.length >= 3) {
      track({ name: "rage_click", time: now, ...attrsFrom(keyed), x: event.clientX / window.innerWidth, y: event.clientY / window.innerHeight });
      clickTimes.set(key, []);
    }

    if (!isInteractive(target) && !target.closest("a, button")) {
      track({
        name: "dead_click",
        time: now,
        x: event.clientX / window.innerWidth,
        y: event.clientY / window.innerHeight,
      });
      return;
    }

    const measureRoot = target.closest("[data-measure-id], a, button, [role='button']");
    if (!measureRoot) return;
    const href = (measureRoot as HTMLAnchorElement).href || measureRoot.getAttribute("href") || undefined;
    track({
      name: clickName(measureRoot),
      time: now,
      ...attrsFrom(measureRoot),
      x: event.clientX / window.innerWidth,
      y: event.clientY / window.innerHeight,
      payload: href ? { href: href.slice(0, 500) } : undefined,
    });
  };

  const onCopy = () => {
    const sel = window.getSelection()?.anchorNode as Node | null;
    const el = sel && "nodeType" in sel ? (sel.parentElement ?? null) : null;
    if (!el?.closest("article, [data-measure-id='article-body'], [data-archive-record]")) return;
    track({ name: "copy_content", time: Date.now(), ...attrsFrom(el) });
  };

  const onToggle = (event: Event) => {
    const el = event.target as HTMLDetailsElement | null;
    if (!el || el.tagName !== "DETAILS") return;
    if (!el.getAttribute("data-measure-id")) return;
    track({
      name: el.open ? "open" : "close",
      time: Date.now(),
      ...attrsFrom(el),
    });
  };

  const heartbeat = () => {
    if (document.visibilityState !== "visible") return;
    track({
      name: "presence",
      time: Date.now(),
      payload: { visible: true, active_ms: activeMs + (activeStarted ? Date.now() - activeStarted : 0) },
    });
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      pauseActive();
      track({
        name: "page_hide",
        time: Date.now(),
        payload: { active_ms: activeMs, visible: false },
      });
      flush(true);
    } else {
      resumeActive();
    }
  };

  const onPageHide = () => {
    pauseActive();
    track({ name: "page_hide", time: Date.now(), payload: { active_ms: activeMs } });
    flush(true);
  };

  /* Web vitals via PerformanceObserver when web-vitals is not a dependency. */
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean; processingStart?: number; startTime: number };
        let metric: string | null = null;
        let value = 0;
        if (entry.entryType === "largest-contentful-paint") {
          metric = "LCP";
          value = entry.startTime;
        } else if (entry.entryType === "layout-shift" && !(e as { hadRecentInput?: boolean }).hadRecentInput) {
          metric = "CLS";
          value = (e as { value?: number }).value ?? 0;
        } else if (entry.entryType === "event" || entry.entryType === "first-input") {
          metric = "INP";
          value = (e.processingStart ?? entry.startTime) - entry.startTime;
        }
        if (metric) {
          track({
            name: "web_vital",
            time: Date.now(),
            payload: { metric, value: Math.round(value * 1000) / 1000 },
          });
        }
      }
    });
    po.observe({ type: "largest-contentful-paint", buffered: true } as PerformanceObserverInit);
    po.observe({ type: "layout-shift", buffered: true } as PerformanceObserverInit);
    try {
      po.observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    } catch {
      po.observe({ type: "first-input", buffered: true } as PerformanceObserverInit);
    }
  } catch {
    /* PerformanceObserver unavailable — skip vitals */
  }

  if (document.body?.dataset.measureNotFound === "1" || document.querySelector("[data-measure-id='not-found']")) {
    track({ name: "not_found", time: Date.now() });
  }

  
  const onCustomMeasure = (event: Event) => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail;
    if (!detail || typeof detail.name !== "string") return;
    track({
      name: detail.name as string,
      time: Date.now(),
      query_redacted: typeof detail.query_redacted === "string" ? detail.query_redacted : undefined,
      payload: (detail.payload as QueuedEvent["payload"]) ?? undefined,
      content_id: typeof detail.content_id === "string" ? detail.content_id : undefined,
      section: typeof detail.section === "string" ? detail.section : undefined,
    });
  };
  window.addEventListener("lz:measure", onCustomMeasure);

document.addEventListener("click", onClick, true);
  document.addEventListener("copy", onCopy);
  document.addEventListener("toggle", onToggle, true);
  document.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  heartbeatTimer = window.setInterval(heartbeat, HEARTBEAT_MS);
  heartbeat();

  return {
    track,
    flush,
    stop() {
      stopped = true;
      if (flushTimer != null) window.clearTimeout(flushTimer);
      if (heartbeatTimer != null) window.clearInterval(heartbeatTimer);
      exposure.disconnect();
      mo?.disconnect();
      window.removeEventListener("lz:measure", onCustomMeasure);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    },
  };
}
