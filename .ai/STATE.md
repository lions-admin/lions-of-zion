# State

Snapshot of intent and current position. Git is the history; durable reasoning
lives in `DECISIONS.md`.

_Last updated: 2026-08-24_

## Frontend

The original particle story intro is preserved. Its old photographic
post-intro landing page and legacy navigation have been removed and replaced by
the Fabele particle navigation:

- a crowned lion assembled from tiered 45k/90k/180k particle buffers;
- eight radial routes whose nodes, connectors and DOM labels share one
  responsive `OrbitLayout`;
- a blue particle network scan with readable misinformation-context labels and
  social-platform symbols; no stars and no photographic background;
- WebGPU/TSL first, WebGL2 fallback, and an SSR poster/no-JavaScript path;
- Cinzel labels, accessible 44px targets and visible keyboard focus;
- the isolated `/particle-demo` tuning and fallback route.

`Experience.tsx` starts the new GPU engine only at the intro's outro. The new
lion assembles during the same 2.8 seconds in which the intro veil clears. The
DOM links and fallback poster are present in the initial HTML, but become inert
after hydration while the intro runs. Without JavaScript the intro enhancement
is hidden and the links remain usable.

All eight routes exist as real Next.js pages. They are intentionally placeholder
destinations pending section content.

## Verification

- `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` pass.
- The real-Chrome matrix passes at 320×568, 390×844, 768×1024, 1024×768,
  1254×1254, 1440×900, and 2560×1080: 8/8 links remain inside each viewport,
  WebGPU is live, and there are no console errors or overlays.
- The end-to-end pass confirms intro → skip/outro → WebGPU navigation, a live
  forced-WebGL2 scene, keyboard focus, and a usable no-JavaScript poster with
  eight links.
- The in-app browser may render a black intro because it throttles hidden-tab
  animation. Use the real-Chrome scripts for visual evidence.

## Backend

Phases 1 and 2 remain complete: schema foundation and information model. Neon,
Blob and AI Gateway are intentionally unprovisioned. No backend service was
changed by the frontend integration.

## Deployment

This particle-navigation integration is the current main implementation. Git
auto-deploy is disconnected from the private GitHub organization, so production
releases use an explicit Vercel CLI deployment after the commit and local gates
have passed.

## Next

- Migrate the preserved intro into the same WebGPU/TSL renderer so the complete
  experience uses one Canvas and one particle system.
- Replace the eight placeholder section pages as their content is designed.
- Backend Phase 3 remains sources and ingestion.

## Blocked

Nothing in the frontend implementation. Backend service provisioning remains
deferred by choice.
