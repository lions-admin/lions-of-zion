/**
 * Host shim for `next/navigation`.
 *
 * `usePathname` is read by AskTheLionChat and ParticleChatLauncher to pick
 * starter questions per route. There is no router in a design preview, so it
 * reports the browser's own path — real behaviour, no Next runtime.
 */
export function usePathname(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname;
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}

const noop = () => {};
export function useRouter() {
  return { push: noop, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop };
}
