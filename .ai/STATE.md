# State

Snapshot of intent and current position. Git is the history; durable reasoning
lives in `DECISIONS.md`. The long backend phase narrative that used to live
here is in this file's git history and in
`~/.claude/plans/splendid-discovering-dawn.md`.

_Last updated: 2026-08-25 (end of session — wave 1 complete, wave 2 not started)_

## Where the work is

A full-project review produced the W1–W6 continuation plan in `TODOS.md`, and
a six-agent wave executed most of W1/W2/W3/W5/W6. Session ended by request
after wave 1; **wave 2 (TODOS W4 — per-page authored content) was deliberately
not started and is the next session's starting point.**

- a crowned lion assembled from tiered 45k/90k/180k particle buffers;
- eight radial routes whose nodes, connectors and DOM labels share one
  responsive `OrbitLayout`;
- a blue particle network scan with readable misinformation-context labels and
  social-platform symbols; no stars and no photographic background;
- WebGPU/TSL first, WebGL2 fallback, and an SSR poster/no-JavaScript path;
- Cinzel labels, accessible 44px targets and visible keyboard focus;
- a skip control rendered as DOM type rather than particles — the one
  documented exception to the all-particles rule (see `DECISIONS.md`);
- the isolated `/particle-demo` tuning and fallback route.

`Experience.tsx` starts the new GPU engine only at the intro's outro. The new
lion assembles during the same 2.8 seconds in which the intro veil clears. The
DOM links and fallback poster are present in the initial HTML, but become inert
after hydration while the intro runs. Without JavaScript the intro enhancement
is hidden and the links remain usable.

All eight routes exist as real Next.js pages. Seven use the `SectionPage`
dossier shell; the Geopolitical Brief has its own reading layout. Their content
is authored, not yet fed by the publishing modules.

On 25 August the phone home was returned to the live orbit: `mobileStaticHome`
(which unmounted the canvas at the end of the intro on ≤719px and left the
static editorial index) is gone. The static index is now the mobile
no-JS/no-GPU tier, gated in CSS on `data-canvas`, and the chat launcher's
mobile dock is charged into the orbit's phone bottom reserve as
`CHAT_DOCK_PX` so the pill and the bottom node no longer share a band. See
`DECISIONS.md` for why. **The real-Chrome matrix must be re-captured on the
workstation**: the phone orbit now sits higher (reserve grew from 56px to
84px + safe-area) and no capture has seen the orbit and the launcher pill on
one phone screen.

A P0 pass on 25 August moved four things and each is covered by pure unit tests:

- The chat launcher is **absent** during the intro rather than hidden, so its
  second WebGPU renderer no longer runs behind it.
- `OrbitLayout` gained `nodeHaloRadius` (what is actually drawn, as against the
  DOM box) and `centerY`, and solves each vertical edge separately with a
  phone-only reserve for the browser's own bottom chrome.
- The intro's viewport math has one owner in `components/intro/introLayout.ts`:
  an 86vw line cap, one shared type size per layout, and entry/exit travel
  scaled to the frame on mobile only.
- This found a live bug nothing had seen: at 768×1024 a portrait tablet takes
  the desktop line breaks, and the widest line was rendering at 170vw.

A parallel full-project-review branch (merged the same day, based on a
commit before the mobile-orbit fix above) shipped a separate wave 1:
`not-found`/`error`/`loading` in the site language; intro session memory
(`loz-intro-seen`, now checked alongside `!introSeen` in `introRunning` and
set from the skip/Escape/complete paths — kept independent of the
mobile-orbit fix above, which touched the same file); SectionPage grew a
prev/next + destinations footer with `aria-current`, SVG emblems (SDF stays
GPU-only — see `DECISIONS.md`), rail/H1 scrims, block anchors, and new opt-in
props `surface="quiet"` and `aside`; `Monitoring · active` became `Reference
edition`; the brief got a closing band, corrections consistency and an opaque
mobile header; the chat got offline mode keyed on `error.code`, a one-shot
capability probe, per-route starter chips and labels, typed citation
rendering, auto-scroll and thread management; metadata got real icons, a
1200×630 OG image, sitemap/robots/manifest, themeColor, and `noindex` on
`/particle-demo`; `components/content/` now holds ten documented content
components (see its README), and `PublishedItemView` lives in
`server/contracts/item.ts` with the repo importing it.

**Because the wave-1 branch predates the mobile-orbit fix, its copy of
`CanvasMount.tsx` still carried `mobileStaticHome`/`useMobileHome`; the merge
resolution kept the fix (no mobile-only canvas unmount) and layered the
intro-session-memory feature on top of it.** Re-verify `loz-intro-seen`
behaves on phone widths as part of the re-capture pass below.

## Verification

- Full gate green at session end: typecheck, lint, 323 tests (1 pgvector
  skip), production build with all metadata routes. Title-template suffix
  duplication on the eight pages was caught in the built HTML and fixed.
- **The real-Chrome matrix has not been recaptured** — it predates both the
  P0 composition changes and all of this session's visual work. Mac-gated
  tasks (poster rebalance, intro overlap, SDF re-bake, capture) are listed
  under TODOS W2.

## Next (cold-start order)

1. **Wave 2 = TODOS W4**: authored, sourced content per page — War Update
   feed, October 7 timeline + `SensitiveContent`, hero profiles, Israel's
   Story chapters, Fake Resistance case files, We Are method diagram,
   Support Us forms, `/methodology` + `/corrections` pages. Build on
   `components/content/` (README documents every prop) and SectionPage's
   `aside`/`surface` props. The editorial rule is in `DECISIONS.md`
   (2026-08-25): real sourced facts only; format demos labeled reference.
2. Remaining W1/W2/W6 partials are marked inline in TODOS (global footer,
   quiet surface applied per page, color tokens, per-page openGraph,
   canonical domain decision — the vercel.app host is hardcoded in three
   files).
3. Workstation: real-Chrome capture pass over everything visual.
4. Backend picks unchanged: provisioning (pooled `-pooler` `DATABASE_URL`),
   real auth, brief-generation workflow.

## Blocked

Backend provisioning remains deferred by choice; the code needs no changes
when it happens. Nothing else blocked.
