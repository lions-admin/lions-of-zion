# Homepage editorial journey — implementation report

Updated: 2026-09-06 (Asia/Jerusalem)

## Delivered locally

- `/` now keeps the cinematic lion hero and continues into a server-composed editorial journey: News, Narratives & fact checks, October 7, Our Heroes, Israel's Story, and the system explanation.
- The page uses real canonical records, stable daily membership, per-section failure states, no client-side story rotation, and no autoplay below the hero.
- Four additional local visuals were added for the narrative and archive sections. They are intentionally labelled editorial illustration or safe cover; they are not evidence, source photography, or event reconstructions.
- Media rights/safety metadata and generation provenance live in `content-packages/homepage/media.json` and `content-packages/homepage/imagegen-manifest.json`.
- The protected edition route, append-only edition table, catalogue generator and local frozen edition are implemented. Cloud scheduling remains inactive.

## Media added in this pass

| Asset | Use | Safety statement |
| --- | --- | --- |
| `public/images/homepage/watch-network.webp` | Narrative Watch | Editorial illustration; monitoring is not confirmation. |
| `public/images/homepage/case-desk.webp` | Research case | Editorial illustration; silhouettes and papers are not source material. |
| `public/images/homepage/testimony-room.webp` | Testimony | Safe cover; not a reconstruction of the testimony or location. |
| `public/images/homepage/documentation-folder.webp` | Documentation | Safe cover; underlying graphic material remains concealed. |

## Verification evidence

- Focused Vitest run: **8 files, 60 tests passed**.
- `npm run typecheck`: **passed**.
- Scoped ESLint run excluding the existing `midjourny/**` scratch checkout: **0 errors, 4 pre-existing warnings**.
- Production build: compiled successfully and emitted the route table; the command completed before the shell wrapper printed its final status line.
- `npm run perf:report -- --warn-only`: ran against the build. CSS/font/shared-JS budgets passed; the existing combined homepage route is 321.3 kB gzip against a 310 kB homepage budget and is recorded as a follow-up rather than hidden.
- Chromium browser evidence at 390, 768, 1024, 1440 and 1920 CSS pixels: 10 records, no horizontal overflow, one `main`, one `h1`, no page errors, no raw archive-media requests, and stable membership after browser back.
- No-JavaScript Chromium evidence: 10 records, one `main`, seven fallback navigation links.
- Frontend Design Premium strict static audit: the repository-wide audit reports 10 pre-existing admin-form findings (`app/admin/**`); none are in the homepage journey files, and they were left outside this marketing/content-page scope. Raw output is retained at `/tmp/lions-premium-audit.json`.
- WebKit/Safari automation was unavailable because the local Playwright WebKit executable is not installed. This is not a physical-device test.

Evidence files are in this directory under `before/` and `after/`. The machine-readable browser summary is `after/browser-results.json`.

## Explicitly pending

- Canonical cover-media persistence for publication rows remains a later schema/versioning phase; the homepage registry bridge is the current implementation.
- Cloud cron activation and production migration are intentionally not performed.
- Real iPhone/Safari hardware review and first-time-user comprehension testing require external human/device access.
- The existing source inventory still has heroes and historical records without approved media; they are not fabricated or silently filled.

No production deployment was made.

## Full-scroll visual pass (2026-09-06)

Reviewed the complete homepage scroll in Chromium at 390, 768, 1,024, 1,440 and 1,920 pixels, using the fresh captures in `after/` rather than only the opening viewport. The page keeps a deliberate rhythm from the cinematic cover into News, Narratives, October 7, Our Heroes, Israel's Story, the evidence pipeline and the closing footer. No horizontal overflow, clipped section, empty reserved column or repeated generic card treatment was found in the pass. Mobile collapses each editorial composition into a readable single-column document; archive warnings, source lines and generated-image disclosures remain visible. The Ask launcher remains in-flow on the homepage so it does not cover reading content.

The remaining visual risk is platform coverage: this pass used Chromium viewport captures; WebKit was unavailable on this machine and a physical iPhone/Safari pass is still pending.
