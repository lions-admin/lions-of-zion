# First-party browsing measurement

Owner-facing warehouse for how people use the public site. Not PostHog, GA, or
Vercel Analytics (those stay for what they already do). Events start empty at
activation — there is no backfill and no sample dashboard.

## Definitions

| Term | Meaning |
| --- | --- |
| **Active visit** | A presence heartbeat within the last **60 seconds** while the page was visible. |
| **Exposure** | Element with `data-measure-id` ≥50% visible for ≥1 second. Once per component *per content item* per visit (per page when the element names no content), so `article-verdict` counts on every article a visit reads. |
| **Estimated read** | Article body + sources have been in view and active tab time ≥ 30s. Never labelled “understood”. |
| **Unknown source** | No `utm_*` / `ref` / `m` and no referrer → `source = "unknown"`. Never coerced to `"direct"`. |
| **Active time** | Accumulates while `document.visibilityState === "visible"`. Still readers count; hidden tabs pause. Per page: it resets on every navigation. |
| **Page view** | One per page, client-side navigations included — the collector lives in the root layout, and `MeasurementRoot` calls `pageView()` when the path changes. The page left gets a `page_hide` with its own `active_ms`. |

## Consent / privacy

There is no GDPR cookie wall. We honour **DNT** and **GPC**: when set, the
browser collector does not start, and the server records no Ask outcome for a
request carrying `DNT: 1` or `Sec-GPC: 1`. We never store passwords, `Authorization`,
cookies, Ask question raw text, or report form bodies. Search/Ask free text is
stored only as `query_redacted` (truncated, emails/phones stripped) plus an
optional hash in payload.

`visitor_id` is an opaque localStorage id — **not a legal identity**.

## Query contract (tagged links)

| Param | Maps to |
| --- | --- |
| `utm_source` or `ref` | `source` |
| `utm_medium` or `m` | `medium` |
| `utm_campaign` | `campaign` |
| `utm_content` | `content_link` |

## Architecture

- Module: `server/modules/measurement/` (`index` / `service` / `repo`)
- Contracts: `server/contracts/measurement.ts`
- Tables: migration `0067_measurement.sql`
- Ingest: `POST /api/v1/measurement/collect` (in `PUBLIC_V1`)
- Admin: `/admin?area=measure-*` → `GET /api/v1/admin/console/measurement?screen=…`
- Client: `components/measurement/` mounted from public `app/layout.tsx` (skips admin surface)
- Site revision: `VERCEL_GIT_COMMIT_SHA` via `siteRevision()` in `server/core/config.ts`
- Geo: Vercel headers only (`x-vercel-ip-country`, `x-vercel-ip-country-region`, `x-vercel-ip-city`)

Measurement failure never breaks the public site (try/catch, `keepalive`,
ignored send errors). `prefers-reduced-motion` does **not** disable measurement.

## Event catalog (stable names)

`page_view`, `page_hide`, `scroll`, `presence`, `exposure`, `click_card`,
`click_nav`, `click_button`, `click_link`, `click_other`, `rage_click`,
`dead_click`, `copy_content`, `share_click`, `share_copy`, `open`, `close`,
`estimated_read`, `claim_exposure`, `evidence_open`, `verdict_reached`,
`sources_open`, `search_query`, `search_zero_results`, `search_result_click`,
`search_refine`, `search_abandon`, `ask_open`, `ask_source_click`,
`ask_copy_answer`, `ask_feedback`, `ask_follow_up`, `ask_success`, `ask_fail`,
`ask_latency`, `ask_cost`, media/image/document events, `web_vital`,
`resource_error`, `page_error`, `not_found`.

Browser events never claim Ask succeeded — those are server events.

## Ask outcomes (server events)

`chat().ask()` reports every turn through the injected `recordOutcome`, bound in
`server/modules/chat/index.ts` to `measurement().recordAskOutcome(...)`:

| Outcome | Events | Payload |
| --- | --- | --- |
| answered | `ask_success`, `ask_latency`, `ask_cost` | `success`, `latency_ms` (end to end), `duration_ms` (model call), `result_count` (citations kept), `cost_usd`, `model`, `hashed_query` |
| failed | `ask_fail` | `success: false`, `error_class` (the `ApiError` code, lower-cased, or `internal`), `status` (the stage: `thread`, `unavailable`, `budget`, `model`, `persist`), `latency_ms`, `hashed_query` |

- **Attribution.** The Ask client sends `x-lz-visit`, `x-lz-visitor` and
  `x-lz-path` (`components/measurement/headers.ts`) — only while the collector
  is running, and never minting an id. `measurementContextFromHeaders()` in
  `server/contracts/measurement.ts` parses them.
- **Unattributed turns record nothing.** No visitor is synthesized for a
  request without a visit: that would count every API call as a person on the
  audience and today screens. The model call is still in `ai_run`, which the
  search screen shows beside these events.
- **No raw text.** The question reaches the measurement module only to be
  redacted (`query_redacted`) and hashed (`hashed_query`). Redaction runs at
  the sink for server *and* browser events, and server payload keys outside
  `MEASUREMENT_PAYLOAD_KEYS` are dropped.
- **Never fails a turn.** A recorder that throws is swallowed in the chat
  service. A request refused before the service — rate limit, invalid body —
  is not an Ask turn and is not recorded.
- **Order.** A server event may land before the browser's first collect;
  `ensureVisit` files a bare visit, and the collect fills its gaps and
  upgrades an unknown source to a tagged one. It never overwrites.

## Search

Every answered query is a `search_query` (`result_count`, `zero_results`); an
empty one is also `search_zero_results`, and a later query from the same box is
also `search_refine`. The text is `query_redacted` only.

## Adding `data-measure-id`

```html
<article
  data-measure-id="home-news-lead"
  data-measure-section="news"
  data-measure-content="{publicationPublicId}"
  data-measure-type="publication"
  data-measure-placement="news:lead"
  data-measure-card
/>
```

Build these with `components/measurement/attrs.ts` rather than by hand:
`measurePublicationCard(surface, item, placement?)` gives the id
`<surface>-<publicId>`, and `measureSection()` derives the section from
`publication.section` through `lib/publication-routing.ts` (`news`,
`fake-resistance`, `people`). **A publication's content id is its `publicId`
everywhere** — `measureContentId()` strips the homepage's `publication:`
prefix — so a homepage exposure, a hub click and the article's page view land
on one row of the content screen.

Each attribute is read from the nearest element carrying it, and content falls
back to the page's `data-measure-page` element (the article root), so a share
inside the article's dialog counts against the article.

| Attribute | Effect |
| --- | --- |
| `data-measure-event` | Forces the click (or `<details>` open) event name — from the catalog, never the visible label. |
| `data-measure-exposure="claim_exposure"` / `"verdict_reached"` | Reports that event instead of `exposure`. |
| `data-measure-exposure="none"` | No exposure (the header — on screen on every page). Clicks still count. |
| `data-measure-card` | Clicks inside are `click_card`. A bare `<article>` is **not** a card. |
| `data-measure-nav` | Clicks inside are `click_nav` (the header bar, the footer). |
| `data-measure-page` | This element names the page's own content. |

### Where the ids are

| Surface | Ids |
| --- | --- |
| Homepage | `home-news-*`, `home-people-*`, `home-heroes-*`, `home-fake-resistance-*`, `home-october-7-*` |
| News & Analysis (`LiveBriefHub`) | `brief-lead-*`, `brief-update-*`, `brief-daily-*`, `brief-earlier-*`, `brief-archive-*`, `brief-archive` (details), `brief-to-fake-resistance` |
| Fake Resistance | `fr-case-lead-*`, `fr-case-*` (content `case:<slug>`), `fr-watch-*`, `fr-antisemitism-*`, `fr-influence-*`, `fr-depth-nav`; listings `watch-*`, `antisemitism-*` |
| The People of Israel | `people-hero-*` (content `hero:<id>`), `people-record-*`, `people-history-chapters` |
| October 7 | `o7-entry-testimonies`, `o7-entry-documentation`, `o7-<kind>-<id>` (content `<kind>:<id>`), `o7-<kind>-next` / `-previous` / `-share-open`, `o7-categories` |
| Article | `article-media` (+ `-provenance`), `article-verdict` (`verdict_reached`), `article-claim` (`claim_exposure`), `evidence-explorer` (stage tabs: `sources_open` / `verdict_reached` / `open`), `article-body`, `article-sources`, `article-unknowns`, `activation-band`, `article-next-*`, `article-desk-link` |
| Evidence | every cited-source link (`SourceList`, the article's source stack, the explorer) is `evidence_open`; "Trace the sources" is `sources_open` |
| Share | `share-copy` (`share_copy`), `share-click` and `share-intent-*` (`share_click`), `activation-share-open` |
| Search / Ask | `search-panel`, `search-result-*` (`search_result_click`), `ask-open` (`ask_open`) |
| Support | `support-choose-*`, `support-back-*`, `support-donate-paypal`, `support-donate-paypal-direct`, `support-donate-coffee` |
| Chrome | `header-*` (no exposure), `footer` (its exposure is "reached the end"), `footer-*` |
| Section pages | `block-<anchor>` on each `SectionBlock` heading; the route id is the section |

Media events are recorded only for a `<video>`/`<audio>` with `controls` — a
decorative loop is not a play. Errors (`page_error`, `resource_error`) carry an
error class only, never a message, at most 20 per page.

Custom client events: `window.dispatchEvent(new CustomEvent("lz:measure", { detail: { name, query_redacted, payload } }))`.

## Retention

- Events: suggest **90 days**
- Presence: **1 day**
- SQL: `prune_measurement()` (granted to `app_service`)
- Wired into `runMaintenance()` / admin maintenance tick when tables exist

Daily rollups for 13 months are a future job — not invented as a cron here.

## Admin empty states

- **אין עדיין נתונים מאז הפעלת המדידה** — tables exist, no rows yet
- **המדידה לא מחוברת** — module/tables missing, or the console endpoint
  itself failed (`MeasurementPanel` shows it for a failed or unavailable read)

Never show `0` as if it were a measured day when ingest is down.
