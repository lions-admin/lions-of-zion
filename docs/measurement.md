# First-party browsing measurement

Owner-facing warehouse for how people use the public site. Not PostHog, GA, or
Vercel Analytics (those stay for what they already do). Events start empty at
activation — there is no backfill and no sample dashboard.

## Definitions

| Term | Meaning |
| --- | --- |
| **Active visit** | A presence heartbeat within the last **60 seconds** while the page was visible. |
| **Exposure** | Element with `data-measure-id` ≥50% visible for ≥1 second. Once per component per visit. |
| **Estimated read** | Article body + sources have been in view and active tab time ≥ 30s. Never labelled “understood”. |
| **Unknown source** | No `utm_*` / `ref` / `m` and no referrer → `source = "unknown"`. Never coerced to `"direct"`. |
| **Active time** | Accumulates while `document.visibilityState === "visible"`. Still readers count; hidden tabs pause. |

## Consent / privacy

There is no GDPR cookie wall. We honour **DNT** and **GPC**: when set, the
browser collector does not send. We never store passwords, `Authorization`,
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

Browser events never claim Ask succeeded — those are server events via
`measurement().recordServerEvent(...)`.

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

Optional: `data-measure-event` to force an event name (never the visible label).

Custom client events: `window.dispatchEvent(new CustomEvent("lz:measure", { detail: { name, query_redacted, payload } }))`.

## Retention

- Events: suggest **90 days**
- Presence: **1 day**
- SQL: `prune_measurement()` (granted to `app_service`)
- Wired into `runMaintenance()` / admin maintenance tick when tables exist

Daily rollups for 13 months are a future job — not invented as a cron here.

## Admin empty states

- **אין עדיין נתונים מאז הפעלת המדידה** — tables exist, no rows yet
- **המדידה לא מחוברת** — module/tables missing (endpoint failure)

Never show `0` as if it were a measured day when ingest is down.
