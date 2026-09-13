/**
 * Exposure de-dupe: IntersectionObserver ≥50% visible for ≥1s, once per
 * key per visit (in-memory set).
 *
 * The key is the component id by default. The collector passes a key that
 * adds the content (or, failing that, the page), because a component id such
 * as `article-verdict` is shared by every article — keyed by id alone, a
 * reader's second article of a visit could never reach its verdict.
 *
 * `data-measure-exposure="none"` opts an element out: the header's navigation
 * is on screen on every page, and its "exposure" would only restate the page
 * view. It stays measurable for clicks.
 */
export function createExposureTracker(
  onExpose: (componentId: string, el: Element) => void,
  keyOf: (el: Element, componentId: string) => string = (_el, id) => id,
) {
  const seen = new Set<string>();
  const timers = new Map<Element, number>();

  const idOf = (el: Element): string | null => {
    const id = el.getAttribute("data-measure-id");
    if (!id || el.getAttribute("data-measure-exposure") === "none") return null;
    return id;
  };

  if (typeof IntersectionObserver === "undefined") {
    return {
      observe(_el: Element) {},
      disconnect() {},
      hasSeen: (key: string) => seen.has(key),
      markSeen: (key: string) => seen.add(key),
    };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target;
        const id = idOf(el);
        if (!id) continue;
        const key = keyOf(el, id);
        if (seen.has(key)) {
          observer.unobserve(el);
          continue;
        }
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (timers.has(el)) continue;
          const handle = window.setTimeout(() => {
            timers.delete(el);
            if (seen.has(key)) return;
            seen.add(key);
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
      const id = idOf(el);
      if (!id || seen.has(keyOf(el, id))) return;
      observer.observe(el);
    },
    disconnect() {
      for (const handle of timers.values()) window.clearTimeout(handle);
      timers.clear();
      observer.disconnect();
    },
    hasSeen: (key: string) => seen.has(key),
    markSeen: (key: string) => seen.add(key),
  };
}

export type ExposureTracker = ReturnType<typeof createExposureTracker>;
