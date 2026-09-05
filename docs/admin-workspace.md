# Admin workspace

The owner's approved direction is a dark, compact Hebrew operating workspace,
not a public-site hero or a decorative dashboard. Scope: expose and repair
existing capabilities, without changing publication policy or provisioning
services. This implementation has not yet had its validation pass.

## Navigation and capability map

All destinations use `/admin?area=…`. `area=system` remains an alias for `users`,
with an optional legacy `sub` parameter. Only the active main area is mounted.
The assistant is initialized on first opening and retained when its drawer
closes, so closing it does not discard a conversation or a pending operation.

| Group | Destination | Existing capabilities retained |
| --- | --- | --- |
| Work | overview | Subsystem observations, attention links, run processing, pause/resume publication, publish approved edition |
| Work | pipeline | Stage state, editions, draft preview, quality checks, job retry, processing controls, reruns and drilldowns |
| Work | sources | Search/family/health filters, fetch history, verify/enable/disable, catalog sync and collection sweep |
| Work | editorial | All publications, filtering/paging, edit/preview, lifecycle transitions, homepage placement, versions/rollback, archive/delete, narratives |
| Control | incidents | Alerts, failed/stuck/quarantined jobs, outbox, maintenance and existing recovery operations |
| Control | costs | Budgets, model/surface/kind/time breakdown, recorded vs estimated search cost |
| Control | audit | Filtered audit history and per-record details |
| Administration | users, security | Users/grants, integrations, keys' configured status and existing security checks |
| Administration | settings, environment | Existing configuration reads, environment identity and system internals |
| Administration | reports, chat, prompts, lineage | Reporting workflow, public-chat moderation, prompt versions/activation, entity history and evidence provenance |

Public Ask is omitted on `/admin` and its children; public pages retain their
existing component and design. The authenticated operations assistant remains
separate and retains its server-owned capabilities and confirmation policy.

## Canonical UI and behavior

- Runtime density/palette/type owner: `app/admin/workspace.module.css`, scoped
  to the admin root. Existing shared fonts are reused. The public token system
  and the login layout are not redesigned.
- Forms: shared `Field`, `SelectField`, `CheckboxField`, `FieldGroup`; native
  select popup ownership is accepted. The publication form owns inline
  validation and unsaved-change tracking, while the server remains authoritative.
- Overlays: shared native `Dialog`; consequential actions use `ConfirmDialog`.
  Publication editing and preview use a wide drawer, full-width on mobile.
- Feedback and duplicate-submit guard: `useOperations` and `ConsoleNotices`.
  `callConsole` signals successful mutations to refresh the active workspace.
- Reads: `useConsoleRead`, `ReadGate`, `InlineAbsence`. Separate 401, 403, 404,
  failure, loading and ready states; preserve previous values only for a failed
  refresh of the **same** path and label their age. Cancel superseded requests;
  time out reads after 20 seconds. Mutations are not retried automatically.
- Navigation/filter/page state: URL search parameters. Editorial defaults to all
  publications; `briefingOnly=true` narrows both list and counts. Source filters
  use `q`, `family`, `health`, `page`. Searches commit on submit rather than
  fetching every keystroke. Source paging operates on the existing source catalog
  response; editorial paging is server-side.
- Drafts stay in memory, not local storage. Closing or leaving a dirty editor
  asks before discarding; actual page unload uses the browser lifecycle warning.
- Dates are formatted for Asia/Jerusalem. Technical identifiers use isolated
  text. Scheduled collection is not labeled as a confirmed future run.

## Additive read contracts

`ConsoleOverview.health` separates collection, processing and publication:
configured, observed, paused, degraded, unknown. `observedAt` is a historical
observation, **not a liveness assertion**. `attention` supplies stable codes and
severity. Legacy `systemActive` and `inactiveReasons` retain their old semantics
for existing consumers but no longer determine the workspace's headline.

`GET /api/v1/admin/console/editorial` without query parameters keeps the legacy
lanes response. Query parameters add `page`, `limit` (default 25, maximum 100),
`status`, `briefingOnly` and `q`. The additive `page` response contains items,
number, limit, total and pages. Counts cover the same text/type scope, grouped
by status; `page.total` additionally applies the selected status. Page numbers
clamp after deletion. Ordering is `created_at DESC, id DESC`.

`ConsoleCosts.search.actualSpendStatus` distinguishes `recorded`, `unrecorded`
and `schema_unavailable`. `actualSpendUsd` is omitted when no recorded amount
exists, rather than reporting zero. An explicitly recorded zero remains zero.

## Observed production issue and compatibility handling

On 2026-09-05, read-only production runtime logs showed repeated HTTP 500s from
the costs route, specifically its aggregate over `source_fetch.actual_cost_usd`.
The logs did not expose the underlying database error, so the production
migration/permission state remains unverified. Migration 0052 introduces that
column. No production migration or data mutation was performed.

The aggregate now reads the optional field through the row's JSON projection
and checks column availability through the PostgreSQL catalog. An older schema
can therefore return the other costs with an explicit missing-update warning.
Unexpected database errors are still failures, not swallowed or converted to zero.
This is read compatibility, not a substitute for applying missing migrations
before future deployment with separately authorized production access.

## Validation awaiting approval

Targeted suites: `admin-workspace`, `admin-console`, `admin-console-shell`,
`admin-console-reads`, `admin-console-actions`, `admin-console-p3`; scoped lint
and type checking. Newly added coverage includes >100 publications, filtering,
out-of-range/deleted pages, legacy-compatible health, pre-0052 cost reads,
401/403/404 separation, and success-only mutation refresh events.

Browser acceptance, using isolated data and stubbed paid/external operations:
390, 768 and 1440 pixel widths, short laptop height and enlarged text. Visit every
navigation destination; verify back/forward/reload, filters and pagination,
editor/save/preview/lifecycle/versions, dirty navigation, drawer focus/Escape,
duplicate activation, stale/failed/unauthorized reads, assistant closed/open,
and absence of page-level overflow or overlapping controls. Capture real
screenshots after corrections. Production actions and deployment remain out
of scope without separate authorization.
