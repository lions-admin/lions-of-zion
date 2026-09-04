# LIONS OF ZION — Graphics Phase 0 Functional State Report

Date: 2026-09-04  
Status: Complete for the scoped prerequisites. No graphics, SVGs, icons, illustrations, backgrounds, or visual assets were created. No redesign was performed.

## Scope

This phase resolved the four functional prerequisites from `GRAPHICS-SYSTEMS-PLAN.md`:

- `UX-003` — Search state machine.
- `UX-010` — Safe-media boundary.
- `UX-005` — Ask async lifecycle.
- `UX-006` — Account session lifecycle.

The implementation stayed within the existing components, state primitives, API contracts, and archive safety model. The desktop audit was not repeated as a site-wide audit; only the scoped states were exercised in a real local browser with desktop and mobile viewports.

## Completion summary

| Item | Result |
|---|---|
| Search state separation | Complete: idle, invalid-query, loading, results, no-results, fallback, error |
| Safe-media boundary | Complete: covered by default, explicit on-request reveal, reversible, no pre-request media mount/request |
| Ask lifecycle | Complete for client contract: idle, ready, submitting, loading, success-with-sources, insufficient-evidence, no-answer, error, retry/edit |
| Account lifecycle | Complete: bounded checking, signed out, unavailable, error, retry |
| New graphics | None |
| New icon library/package | None |
| Browser verification screenshots | 51 captured under `screenshots/graphics-phase-0/` |
| Targeted tests | 33 targeted tests passed (26 existing state tests + 7 new Phase 0 tests) |
| Typecheck | Passed |

## 1. UX-003 — Search State Machine

### Files inspected

- `components/search/useSearch.ts`
- `components/search/SearchPanel.tsx`
- `components/search/SearchResults.tsx`
- `components/search/http.ts`
- `server/contracts/search.ts`
- `app/api/v1/search/route.ts`
- `server/modules/search/service.ts`
- `tests/search.test.ts`
- `GRAPHICS-BROWSER-AUDIT.md` Search findings `G-018`–`G-020`
- `screenshots/graphics-audit/mobile/search-mobile-390.jpg`

### Behavior before

The client had `idle`, `loading`, `ready`, and `error` internally. The panel inferred `results` and `no-results` from `ready`, but there was no explicit fallback state for a successful lexical-only response (`semantic: false`). The state was partly duplicated in `SearchPanel`, making the functional contract less direct. Search errors had no client timeout.

### Behavior after

`useSearch` now has one classifier and the explicit user-visible state contract:

1. `idle` — query is empty. Primer/recent queries are available; no request runs; no state graphic is required.
2. `invalid-query` — trimmed query has one character. The user sees `Type at least two characters to search.`; no request runs; the user edits the field.
3. `loading` — a valid query has no answer cached yet. The user sees `Searching the index…`; no result is interactive until an answer arrives. If an earlier result exists, it stays visible as stale while the new request is in flight.
4. `results` — the response has one or more hits and `semantic: true`. Rows with an `href` remain interactive; rows without an `href` remain explicitly non-interactive.
5. `no-results` — a successful response has zero hits. The user sees a distinct no-match state and can revise the query; no result is interactive.
6. `fallback` — the response has one or more real hits but `semantic: false`. Results remain interactive; the footer says that word-and-name matching is being shown and semantic matching is unavailable. This is not an error and not no-results.
7. `error` — the request fails, is rate limited, or exceeds the 15-second client timeout. The user sees an error state with retry where appropriate; the no-results state is never used.

A future no-results graphic is therefore secondary to the response classifier and cannot mask fallback/error behavior.

### Exit and recovery rules

- `idle` exits when the user enters at least two non-whitespace characters.
- `invalid-query` exits when the query is cleared or reaches two characters.
- `loading` exits on a successful response, a failure, or a query change that aborts the previous request.
- `results`, `fallback`, and `no-results` exit on a new query or clear.
- `error` exits only through query change/clear or retry; retry removes the cached failure and makes a new request.
- A new query aborts the prior request; an abort is not rendered as an error.
- Result rows with no public destination are visible but not interactive, preserving the source-vs-page distinction.

### Code files changed

- `components/search/useSearch.ts` — explicit state union, classifier, invalid-query request guard, fallback classification, 15-second timeout.
- `components/search/SearchPanel.tsx` — consumes the hook state directly, exposes `data-search-state`, displays fallback semantics, and treats no-results as its own state.
- `components/search/http.ts` — recognizes the client timeout problem code.
- `tests/graphics-phase-0.test.ts` — classifier and timeout contract assertions.

### Browser states verified

Real Playwright Chromium verification used controlled API responses to exercise the client contract without changing provider data:

- Desktop `1365 × 900`: idle, loading, results, no-results, fallback, error.
- Mobile `375 × 667`: idle, results, no-results.
- Mobile `390 × 844`: idle, loading, results, no-results, fallback, error.
- Mobile `430 × 932`: idle, results, no-results.

### Browser evidence

- Desktop: `screenshots/graphics-phase-0/desktop/search-idle-desktop-1365.jpg`, `search-loading-desktop-1365.jpg`, `search-results-desktop-1365.jpg`, `search-no-results-desktop-1365.jpg`, `search-fallback-desktop-1365.jpg`, `search-error-desktop-1365.jpg`.
- Mobile: matching files under `screenshots/graphics-phase-0/mobile/` for `375`, `390`, and `430`.

### Unresolved / blockers

No blocker for the state contract. Provider-level semantic availability is deployment-dependent and is represented honestly as `fallback`; it is not a reason to block the shared graphics system.

## 2. UX-010 — Safe Media Boundary

### Files inspected

- `components/content/SensitiveContent.tsx`
- `components/content/content.module.css`
- `components/archive/ArchiveBlocks.tsx`
- `components/archive/ArchiveImage.tsx`
- `components/archive/ArchiveRecord.tsx`
- `app/october-7/page.tsx`
- `app/october-7/testimonies/page.tsx`
- `app/october-7/documentation/page.tsx`
- `tests/archive-content.test.ts`
- `GRAPHICS-BROWSER-AUDIT.md` findings `G-021`–`G-023`

### Behavior before

The safety behavior was already substantially correct: gated children were not mounted before reveal, video posters were omitted behind the gate, there was no autoplay, the category and warning appeared before the action, and the reveal could be hidden again. The contract was implicit in `hidden`/`shown` styling rather than named in state data.

### Behavior after

The existing safety behavior is retained and named explicitly:

1. `covered` — default archive state. Protected media is not mounted; no protected image/video request is made. Category and source warning are visible.
2. `media type known` — the gate category says `Film` or `Photograph` and includes the archive category before the user acts.
3. `on-request` — the covered boundary exposes `Show this material`; nothing is unlocked by page load, prior record, storage, or cookie.
4. `warning acknowledged` — after the explicit action, the boundary is marked as revealed and the protected child is mounted.
5. `available` — the requested local child is available and can be used according to its native media controls.
6. `unavailable` — external video references and failed archive images render an explanatory text state instead of a blank/broken frame.
7. `error` — request/load failures remain stated as a media/archive problem; they do not fall back to an apparently empty or silently missing record.
8. Return to covered — `Hide this material` or `Escape` unmounts the protected child and restores focus to the opening control. State is not persisted.

The shared component now exposes `data-state="covered|revealed"`, `data-boundary="on-request|warning-acknowledged"`, and `data-media-type-known="true"` for the functional/graphics contract. This is instrumentation, not a visual redesign.

### Mobile behavior

The same safety contract applies at `375`, `390`, and `430` widths. The category, warning, and request action remain in the covered frame; no preview, blur, or revealing poster is used to save space. The covered frame may be visually simplified later by `SYS-05`, but the warning and action cannot be removed.

### Code files changed

- `components/content/SensitiveContent.tsx` — explicit covered/revealed state type and data contract.
- `components/content/index.ts` — exports the state type.
- `tests/graphics-phase-0.test.ts` — server-rendered covered-by-default and no-child assertion.

### Browser states verified

A safe documentation record with gated film was opened in a real browser without activating the gate:

- Desktop `1365 × 900`.
- Mobile `375 × 667`.
- Mobile `390 × 844`.
- Mobile `430 × 932`.

For every viewport: `gates = 1`, `leaked = 0`, `mediaRequests = []`; the warning named the media type and the `Show this material` action. Graphic media was not opened.

### Browser evidence

- `screenshots/graphics-phase-0/desktop/october-7-covered-desktop-1365.jpg`
- `screenshots/graphics-phase-0/mobile/october-7-covered-mobile-375.jpg`
- `screenshots/graphics-phase-0/mobile/october-7-covered-mobile-390.jpg`
- `screenshots/graphics-phase-0/mobile/october-7-covered-mobile-430.jpg`

### Unresolved / blockers

No blocker for the default covered boundary. Individual graphic media presentation and post-request visual states were intentionally not opened, per the archive safety rule and the audit scope. The native browser playback failure surface is not separately art-directed; the application already avoids treating missing/external media as a successful media state.

## 3. UX-005 — Ask Async Lifecycle

### Files inspected

- `components/ask/useAskThread.ts`
- `components/ask/AskDesk.tsx`
- `components/ask/AskComposer.tsx`
- `components/ask/AnswerRecord.tsx`
- `components/ask/CitationList.tsx`
- `server/contracts/chat.ts`
- `server/modules/chat/service.ts`
- `app/api/v1/chat/threads/route.ts`
- `app/api/v1/chat/threads/[id]/messages/route.ts`
- `tests/state-causes.test.ts`
- `GRAPHICS-BROWSER-AUDIT.md` findings `G-014`–`G-015`

### Behavior before

The hook already prevented duplicate submits after React state committed, retained failed questions for retry/edit, showed a bounded server max duration in copy, and rendered citations or an explicit no-citation message. The client had a single `asking` phase and did not expose a separate submitting/loading distinction. There was no client timeout fallback if a request outlived the server response.

### Behavior after

The client contract is now explicit:

1. `idle` — no active turn and no blocking error. Primer examples, evidence boundary, and composer are available.
2. `ready` — the composer contains valid text and the Ask action is enabled. The composer exposes `data-ask-composer-state="ready"`.
3. `submitting` — the first request is creating/reusing the thread. The composer is disabled; the waiting record says `Sending the question.`
4. `loading` — the message request and transcript reconciliation are in flight. The composer remains disabled; the waiting record says `Searching the index, then composing.` and exposes elapsed time, not fake progress.
5. `success-with-sources` — an assistant answer arrives with one or more citations. Sources render in the transcript with title, destination, and quote where supplied.
6. `insufficient-evidence` — an answer arrives with zero citations. It is not rendered as a transport or server error; the citation area says to treat it as conversation, not a finding.
7. `no-answer` — a transcript has a user turn without an assistant answer. This remains distinct from an answer with insufficient evidence and is represented in the root `data-ask-state` contract when such a tail exists.
8. `error` — the turn fails, including rate limit, unavailable assistant, or other API failure. The question remains visible and the error record gives retry/edit actions where applicable.
9. `retry` — retry resends the preserved question without retyping; edit returns it to the composer. Retry is a recovery action, not a separate answer type.

### Duplicate submit and timeout behavior

A synchronous `inFlight` ref now locks the action before the first asynchronous state update, closing the same-event double-click window. The existing disabled composer remains the visible second line of defense. A 125-second client timer aborts an overlong turn and renders a recoverable timeout problem while preserving the question.

### Deterministic source behavior

The server retrieves before asking, records the retrieval, filters citations to documents actually retrieved, and the client reconciles with a transcript GET. A cited answer and a no-citation answer therefore have separate visible outcomes. The client does not invent an assistant avatar or infer evidence from prose.

### Code files changed

- `components/ask/useAskThread.ts` — explicit submitting/loading phases, synchronous lock, 125-second timeout, cleanup.
- `components/ask/AskDesk.tsx` — root lifecycle data state, phase-specific waiting copy, success/no-answer/insufficient-evidence classification.
- `components/ask/AskComposer.tsx` — ready/idle composer state marker.
- `components/search/http.ts` — shared timeout problem code.
- `tests/graphics-phase-0.test.ts` — lock, timeout, and visible state assertions.

### Browser states verified

Controlled browser responses were used; no real Ask provider submission was made:

- Desktop `1365 × 900`: idle, ready, loading, success-with-sources, error.
- Mobile `390 × 844`: idle, ready, loading, success-with-sources, error.
- Mobile `375 × 667`: idle, ready, loading.
- Mobile `430 × 932`: idle, ready, loading.

Loading verification confirmed the Ask button was disabled. Success verification confirmed the root state became `success-with-sources`; error verification confirmed the root state became `error` while preserving recovery UI.

### Browser evidence

- Desktop: `screenshots/graphics-phase-0/desktop/ask-idle-desktop-1365.jpg`, `ask-ready-desktop-1365.jpg`, `ask-loading-desktop-1365.jpg`, `ask-success-desktop-1365.jpg`, `ask-error-desktop-1365.jpg`.
- Mobile: corresponding files under `screenshots/graphics-phase-0/mobile/`.

### Unresolved / blockers

No blocker for idle/ready/submitting/loading/success-with-sources/error. A genuine provider-backed no-answer and insufficient-evidence response were not submitted in this phase because that would be a live product interaction; their rendering contract is present in `CitationList` and the derived root state. The client timeout is slightly above the server’s 120-second route limit so the server normally owns the first cutoff.

## 4. UX-006 — Account Session Lifecycle

### Files inspected

- `components/auth/PublicAuthControl.tsx`
- `components/auth/google-identity.ts`
- `app/api/public-auth/session/route.ts`
- `app/account/page.tsx`
- `components/ui/StatusState.tsx`
- `components/ui/status-state.module.css`
- `GRAPHICS-BROWSER-AUDIT.md` finding `G-017`
- `screenshots/graphics-audit/mobile/account-mobile-390.jpg`

### Behavior before

The component began in `Checking your sign-in…`, fetched `/api/public-auth/session`, and treated any failed fetch as `user = null`. There was no timeout and no visible distinction between a signed-out response and an unavailable/error response. A slow or unreachable session endpoint could therefore leave the reader in a misleading or indefinite checking experience.

### Behavior after

The session lifecycle is explicit:

1. `checking` — request is in flight; visible polite copy remains.
2. `signed out` — request succeeds with `{ user: null }`; the configured Google sign-in control is shown, or the deployment configuration message is shown when no client ID exists.
3. `signed in` — request succeeds with a user; identity and sign-out/back actions render.
4. `unavailable` — network failure, timeout, or server 5xx; shared error state explains that session status is unavailable.
5. `error` — non-5xx session response failure; shared error state explains that status could not be checked.
6. `retry` — error/unavailable state returns to checking and repeats the no-store request.

Checking is bounded to ten seconds with `AbortController`. Timeout is classified as unavailable. The account surface uses the shared state primitive; no account-specific illustration was added.

### Code files changed

- `components/auth/PublicAuthControl.tsx` — bounded session fetch, explicit state classification, retry action, shared error state.
- `tests/graphics-phase-0.test.ts` — timeout and state-separation assertions.

### Browser states verified

- Desktop `1365 × 900`: checking, signed out, unavailable.
- Mobile `375 × 667`: checking, signed out, unavailable.
- Mobile `390 × 844`: checking, signed out, unavailable, timeout.
- Mobile `430 × 932`: checking, signed out, unavailable.

The timeout test held the session response for 11 seconds and observed the unavailable state after approximately 10.4 seconds, with timeout copy and a `Try again` action.

### Browser evidence

- Desktop: `screenshots/graphics-phase-0/desktop/account-checking-desktop-1365.jpg`, `account-signed-out-desktop-1365.jpg`, `account-unavailable-desktop-1365.jpg`.
- Mobile: corresponding files under `screenshots/graphics-phase-0/mobile/`.
- Timeout: `screenshots/graphics-phase-0/mobile/account-timeout-mobile-390.jpg`.

### Unresolved / blockers

No blocker for the unauthenticated lifecycle. A real signed-in browser session was not tested because no credentials were available and no credentials were entered. The signed-in branch remains covered by the existing component contract and was not externally authenticated in this phase.

## Verification record

### Commands and results

- `npm run typecheck` — passed after the Phase 0 changes.
- `npm test -- --run tests/graphics-phase-0.test.ts tests/state-causes.test.ts` — 33 tests passed.
- `npm test -- --run tests/graphics-phase-0.test.ts` — 7 tests passed during the focused implementation pass.
- Real Playwright Chromium browser — 51 state screenshots captured and all controlled state assertions completed.

### Browser setup

- Existing local Next development server from this repository was used at `http://localhost:3000`.
- Desktop viewport: `1365 × 900`.
- Mobile viewports: `375 × 667`, `390 × 844`, `430 × 932`.
- API responses for state-only verification were intercepted in the browser context; no external provider, credential, archive media, or live Ask submission was invoked.

## Final gate

The application now has explicit behavior for Search state separation, the safe-media boundary, Ask async lifecycle, and Account session lifecycle. The state contracts are ready to support the later shared graphics systems. Graphics production and implementation were not started.
