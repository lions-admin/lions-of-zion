/**
 * Exposure de-dupe: IntersectionObserver ≥50% visible for ≥1s, once per
 * component_id per visit (in-memory set).
 */
export function createExposureTracker(onExpose: (componentId: string, el: Element) => void) {
  const seen = new Set<string>();
  const timers = new Map<Element, number>();

  if (typeof IntersectionObserver === "undefined") {
    return {
      observe(_el: Element) {},
      disconnect() {},
      hasSeen: (id: string) => seen.has(id),
      markSeen: (id: string) => seen.add(id),
    };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target;
        const id = el.getAttribute("data-measure-id");
        if (!id || seen.has(id)) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (timers.has(el)) continue;
          const handle = window.setTimeout(() => {
            timers.delete(el);
            if (seen.has(id)) return;
            seen.add(id);
            onExpose(id, el);
            observer.unobserve(el);
          }, 1000);
          timers.set(el, handle);
        } else {
          const handle = timers.get(el);
          if (handle != null) {
            window.clearTimeout(handle);
            timers.delete(el);
          }
        }
      }
    },
    { threshold: [0.5] },
  );

  return {
    observe(el: Element) {
      const id = el.getAttribute("data-measure-id");
      if (!id || seen.has(id)) return;
      observer.observe(el);
    },
    disconnect() {
      for (const handle of timers.values()) window.clearTimeout(handle);
      timers.clear();
      observer.disconnect();
    },
    hasSeen: (id: string) => seen.has(id),
    markSeen: (id: string) => seen.add(id),
  };
}

export type ExposureTracker = ReturnType<typeof createExposureTracker>;
