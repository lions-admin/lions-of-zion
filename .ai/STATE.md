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

Shipped and verified this session: `not-found`/`error`/`loading` in the site
language; intro session memory (`loz-intro-seen` via the skip path); SectionPage
grew a prev/next + destinations footer with `aria-current`, SVG emblems (SDF
stays GPU-only — see `DECISIONS.md`), rail/H1 scrims, block anchors, and new
opt-in props `surface="quiet"` and `aside`; `Monitoring · active` became
`Reference edition`; the brief got a closing band, corrections consistency and
an opaque mobile header; the chat got offline mode keyed on `error.code`, a
one-shot capability probe, per-route starter chips and labels, typed citation
rendering, auto-scroll and thread management; metadata got real icons, a
1200×630 OG image, sitemap/robots/manifest, themeColor, and `noindex` on
`/particle-demo`; `components/content/` now holds ten documented content
components (see its README), and `PublishedItemView` lives in
`server/contracts/item.ts` with the repo importing it.

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
