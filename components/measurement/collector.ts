"use client";

import { createExposureTracker } from "./exposure";
import { readOrCreateVisitId, readOrCreateVisitorId, setActiveIds } from "./ids";
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
const MEDIA_MARKS = [25, 50, 75] as const;
/** Errors are counted, not streamed: a broken page must not flood ingest. */
const MAX_ERRORS_PER_PAGE = 20;
/** The exposure events an element may ask for instead of `exposure`. */
const EXPOSURE_EVENTS = new Set(["claim_exposure", "verdict_reached"]);

type Attrs = Pick<QueuedEvent, "component_id" | "content_id" | "content_type" | "section" | "placement">;

function read(el: Element | null | undefined, name: string): string | undefined {
  return el?.getAttribute(name) ?? undefined;
}

/**
 * The page's own content, when it has one: the element carrying
 * `data-measure-page` (the article body). Falls back to the address, so an
 * article's page view is attributed even when its body is still streaming.
 */
function pageAttrs(): Attrs {
  const page = document.querySelector("[data-measure-page]");
  if (page) {
    return {
      content_id: read(page, "data-measure-content"),
      content_type: read(page, "data-measure-type"),
      section: read(page, "data-measure-section"),
    };
  }
  const match = /^\/articles\/([^/?#]+)/.exec(window.location.pathname);
  return match ? { content_id: decodeURIComponent(match[1]!), content_type: "publication" } : {};
}

/**
 * What an element is about, each attribute from the nearest element that
 * carries it. The component is the nearest `data-measure-id`; the content is
 * the nearest element that names one, and failing that the page's — so a
 * share button inside a dialog on an article is counted as a share of that
 * article, and a tab inside the evidence explorer keeps its own placement.
 */
function attrsFrom(el: Element | null): Attrs {
  if (!el) return {};
  const nearest = (name: string) => read(el.closest(`[${name}]`), name);
  const content = el.closest("[data-measure-content]");
  const page = content ? {} : pageAttrs();
  return {
    component_id: nearest("data-measure-id"),
    content_id: read(content, "data-measure-content") ?? page.content_id,
    content_type: read(content, "data-measure-type") ?? page.content_type,
    section: nearest("data-measure-section") ?? page.section,
    placement: nearest("data-measure-placement"),
  };
}

function clickName(el: Element): EventName {
  const forced = el.closest("[data-measure-event]")?.getAttribute("data-measure-event");
  if (forced) return forced;
  if (el.closest("nav, [data-measure-nav]")) return "click_nav";
  /* Explicit cards only. A bare `<article>` matched the article page's own
     root and every SectionPage panel, so every link on those pages counted
     as a card click and the homepage CTR read against it was meaningless. */
  if (el.closest("[data-home-record], [data-measure-card]")) return "click_card";
  if (el.closest("button, [role='button']")) return "click_button";
  if (el.closest("a")) return "click_link";
  return "click_other";
}

function isInteractive(el: Element): boolean {
  return Boolean(
    el.closest("a, button, input, select, textarea, summary, label, video, audio, [role='button'], [role='link'], [role='tab'], [data-measure-id]"),
  );
}

function onAdminSurface(): boolean {
  return (
    window.location.pathname.startsWith("/admin") ||
    Boolean(document.querySelector("[data-surface='admin']"))
  );
}

export type MeasurementCollector = {
  track: (event: QueuedEvent) => void;
  flush: (beacon?: boolean) => void;
  /** A client-side navigation: close the last page, open this one. */
  pageView: () => void;
  stop: () => void;
};

/**
 * Browser collector. Every send is best-effort: errors are swallowed so
 * measurement never breaks the public site.
 *
 * Mounted once from the root layout, so it outlives navigations — `pageView`
 * is what `MeasurementRoot` calls when the path changes, and everything that
 * is per page (scroll checkpoints, active time, the estimated read, the error
 * budget) is reset there rather than at start.
 */
export function startCollector(): MeasurementCollector | null {
  if (typeof window === "undefined") return null;
  if (onAdminSurface()) return null;
  if (honourDoNotTrack()) return null;

  const visitorId = readOrCreateVisitorId();
  const visitId = readOrCreateVisitId();
  setActiveIds({ visitId, visitorId });
  const tagged = readTaggedSource(window.location.search);
  const entryPath = window.location.pathname;
  const queue: QueuedEvent[] = [];
  const clickTimes = new Map<string, number[]>();
  const mediaSeen = new WeakMap<Element, { started: boolean; marks: Set<number> }>();
  let scrollSeen = new Set<number>();
  let readSent = false;
  let hiddenSent = false;
  let errorsThisPage = 0;
  let currentPath = window.location.pathname;
  let activeMs = 0;
  let activeStarted = document.visibilityState === "visible" ? Date.now() : 0;
  let flushTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let stopped = false;

  const track = (event: QueuedEvent) => {
    if (stopped) return;
    /* A client-side navigation into the console must not be measured as
       public browsing; the collector stays mounted but goes quiet. */
    if (onAdminSurface()) return;
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
      entry_path: entryPath,
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

  const activeNow = () => activeMs + (activeStarted ? Date.now() - activeStarted : 0);
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

  const trackPageView = () => {
    track({ name: "page_view", time: Date.now(), ...pageAttrs() });
    if (document.body?.dataset.measureNotFound === "1" || document.querySelector("[data-measure-id='not-found']")) {
      track({ name: "not_found", time: Date.now() });
    }
  };

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

  /* Once per page: the body and the sources have both been reached, and the
     tab has been visible for 30s on this page. Never "understood". */
  const maybeEstimatedRead = () => {
    if (readSent) return;
    const body = document.querySelector("[data-measure-id='article-body']");
    const sources = document.querySelector("[data-measure-id='article-sources']");
    if (!body || !sources) return;
    const bodyVisible = body.getBoundingClientRect().top < window.innerHeight;
    const sourcesVisible = sources.getBoundingClientRect().top < window.innerHeight;
    const active = activeNow();
    if (bodyVisible && sourcesVisible && active >= 30_000) {
      readSent = true;
      track({
        name: "estimated_read",
        time: Date.now(),
        ...attrsFrom(body),
        payload: { active_ms: active },
      });
    }
  };

  const exposure = createExposureTracker(
    (componentId, el) => {
      const asked = el.getAttribute("data-measure-exposure");
      track({
        name: asked && EXPOSURE_EVENTS.has(asked) ? asked : "exposure",
        time: Date.now(),
        ...attrsFrom(el),
        component_id: componentId,
      });
    },
    (el, componentId) => `${componentId}|${attrsFrom(el).content_id ?? window.location.pathname}`,
  );

  const scanExposures = () => {
    document.querySelectorAll("[data-measure-id]").forEach((el) => exposure.observe(el));
  };
  /* Debounced: a page with a ticking clock mutates constantly, and a full
     `querySelectorAll` per mutation is work the reader pays for. */
  let scanTimer: number | null = null;
  const mo = typeof MutationObserver !== "undefined"
    ? new MutationObserver(() => {
        if (scanTimer != null) return;
        scanTimer = window.setTimeout(() => {
          scanTimer = null;
          scanExposures();
        }, 250);
      })
    : null;

  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== "function") return;
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

    /* A measured `<details>` reports through `onToggle`; its summary click
       would be the same act counted twice. */
    const summary = target.closest("summary");
    if (summary?.parentElement?.matches("details[data-measure-id], details[data-measure-event]")) return;

    if (!isInteractive(target)) {
      track({
        name: "dead_click",
        time: now,
        x: event.clientX / window.innerWidth,
        y: event.clientY / window.innerHeight,
      });
      return;
    }

    const measureRoot = target.closest("a, button, [role='button'], [role='tab'], [data-measure-id]");
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

  /* A measured `<details>`: `open`/`close`, or the event it names when it
     opens — the mobile evidence journey asks for `sources_open` this way. */
  const onToggle = (event: Event) => {
    const el = event.target as HTMLDetailsElement | null;
    if (!el || el.tagName !== "DETAILS") return;
    const forced = el.getAttribute("data-measure-event");
    if (!el.getAttribute("data-measure-id") && !forced) return;
    track({
      name: el.open ? (forced ?? "open") : "close",
      time: Date.now(),
      ...attrsFrom(el),
    });
  };

  /* Media a reader controls. A decorative loop has no `controls` and is not
     a play; counting it would make every homepage visit a video view. */
  const onMedia = (event: Event) => {
    const el = event.target as HTMLMediaElement | null;
    if (!el || (el.tagName !== "VIDEO" && el.tagName !== "AUDIO") || !el.controls) return;
    const state = mediaSeen.get(el) ?? { started: false, marks: new Set<number>() };
    mediaSeen.set(el, state);
    const base = {
      time: Date.now(),
      ...attrsFrom(el),
      payload: { media_kind: el.tagName.toLowerCase() } as Record<string, string | number | boolean | null>,
    };
    if (event.type === "play") {
      track({ ...base, name: state.started ? "media_resume" : "media_play" });
      state.started = true;
    } else if (event.type === "pause" && !el.ended) {
      track({ ...base, name: "media_pause" });
    } else if (event.type === "ended") {
      track({ ...base, name: "media_complete" });
    } else if (event.type === "error") {
      track({ ...base, name: "media_error", payload: { ...base.payload, error_class: `code_${el.error?.code ?? 0}` } });
    } else if (event.type === "timeupdate" && el.duration > 0 && Number.isFinite(el.duration)) {
      const pct = (el.currentTime / el.duration) * 100;
      for (const mark of MEDIA_MARKS) {
        if (pct >= mark && !state.marks.has(mark)) {
          state.marks.add(mark);
          track({ ...base, name: "media_progress", payload: { ...base.payload, progress_pct: mark } });
        }
      }
    }
  };

  /* Errors by class only — a message can carry a reader's own input. */
  const onError = (event: Event) => {
    if (errorsThisPage >= MAX_ERRORS_PER_PAGE) return;
    const target = event.target as Element | null;
    if (target && target !== (window as unknown) && typeof target.tagName === "string") {
      if (target.tagName === "VIDEO" || target.tagName === "AUDIO") return; /* onMedia */
      errorsThisPage += 1;
      track({ name: "resource_error", time: Date.now(), ...attrsFrom(target), payload: { error_class: target.tagName.toLowerCase() } });
      return;
    }
    const error = (event as ErrorEvent).error as { name?: unknown } | undefined;
    errorsThisPage += 1;
    track({ name: "page_error", time: Date.now(), payload: { error_class: typeof error?.name === "string" ? error.name.slice(0, 80) : "error" } });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (errorsThisPage >= MAX_ERRORS_PER_PAGE) return;
    errorsThisPage += 1;
    const reason = event.reason as { name?: unknown } | undefined;
    track({ name: "page_error", time: Date.now(), payload: { error_class: typeof reason?.name === "string" ? reason.name.slice(0, 80) : "unhandled_rejection" } });
  };

  const heartbeat = () => {
    if (document.visibilityState !== "visible") return;
    track({
      name: "presence",
      time: Date.now(),
      payload: { visible: true, active_ms: activeNow() },
    });
    /* A short record fits the screen and is never scrolled; its read has to
       be noticed by the clock rather than by a scroll event. */
    maybeEstimatedRead();
  };

  const sendHide = (path?: string) => {
    track({
      name: "page_hide",
      time: Date.now(),
      page_path: path,
      payload: { active_ms: activeMs, visible: false },
    });
  };

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      pauseActive();
      if (!hiddenSent) {
        hiddenSent = true;
        sendHide();
      }
      flush(true);
    } else {
      hiddenSent = false;
      resumeActive();
    }
  };

  const onPageHide = () => {
    pauseActive();
    if (!hiddenSent) {
      hiddenSent = true;
      sendHide();
    }
    flush(true);
  };

  const pageView = () => {
    const path = window.location.pathname;
    if (path === currentPath) return;
    /* The page being left gets its own dwell before anything resets. */
    pauseActive();
    sendHide(currentPath);
    currentPath = path;
    scrollSeen = new Set<number>();
    readSent = false;
    errorsThisPage = 0;
    activeMs = 0;
    resumeActive();
    trackPageView();
    scanExposures();
  };

  /* Web vitals via PerformanceObserver when web-vitals is not a dependency. */
  let po: PerformanceObserver | null = null;
  try {
    po = new PerformanceObserver((list) => {
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
      component_id: typeof detail.component_id === "string" ? detail.component_id : undefined,
    });
  };

  trackPageView();
  scanExposures();
  mo?.observe(document.body, { childList: true, subtree: true });

  const MEDIA_EVENTS = ["play", "pause", "ended", "timeupdate"] as const;
  window.addEventListener("lz:measure", onCustomMeasure);
  document.addEventListener("click", onClick, true);
  document.addEventListener("copy", onCopy);
  document.addEventListener("toggle", onToggle, true);
  document.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  for (const name of MEDIA_EVENTS) document.addEventListener(name, onMedia, true);
  /* `error` does not bubble from an element; capture sees resource failures
     and media errors, and the window sees script errors. */
  window.addEventListener("error", onError, true);
  window.addEventListener("unhandledrejection", onRejection);
  document.addEventListener("error", onMedia, true);
  window.addEventListener("pagehide", onPageHide);
  heartbeatTimer = window.setInterval(heartbeat, HEARTBEAT_MS);
  heartbeat();

  return {
    track,
    flush,
    pageView,
    stop() {
      stopped = true;
      setActiveIds(null);
      if (flushTimer != null) window.clearTimeout(flushTimer);
      if (heartbeatTimer != null) window.clearInterval(heartbeatTimer);
      if (scanTimer != null) window.clearTimeout(scanTimer);
      exposure.disconnect();
      mo?.disconnect();
      po?.disconnect();
      window.removeEventListener("lz:measure", onCustomMeasure);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const name of MEDIA_EVENTS) document.removeEventListener(name, onMedia, true);
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("error", onMedia, true);
      window.removeEventListener("pagehide", onPageHide);
      /* `stopped` is set, so flush directly rather than through `track`. */
      flush(true);
    },
  };
}
