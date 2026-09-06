---
name: frontend-design-premium
description: Production UX and durable design-system workflow for dashboards, admin tools, SaaS, forms, tables, CRUD flows, multi-screen apps, AI products, localized products, and production frontend refactors. Use together with the frontend-design skill. Enforces canonical component ownership, cross-screen consistency, resilient states, accessibility, layout stability, interaction contracts, and verification.
---

# Frontend Design Premium

Use `frontend-design` as the visual/art-direction layer. This skill owns production behavior, consistency, resilience, accessibility, and verification.

For marketing-only pages, let `frontend-design` lead creatively and apply only the production rules that matter: accessibility, responsive layout, stable geometry, semantic interaction, scroll behavior, and reduced motion.

For product/admin/SaaS work, follow the complete workflow below.

## 0. Load the base skill

Before substantial design or implementation work, read and apply the installed `frontend-design` skill.

Do not silently replace the visual-design layer with generic enterprise UI.

## 1. Classify the surface

Choose one register:

### Marketing / brand / content surface

Apply:

- visual direction from `frontend-design`;
- semantic interaction;
- layout stability;
- accessibility;
- responsive behavior;
- reduced motion;
- scrollbar discipline when relevant.

Do not force heavy CRUD or UX-contract machinery onto a one-shot marketing page.

### Product / admin / SaaS / tool

Apply the full premium workflow.

## 2. Resolve canonical ownership before coding

Read `references/canonical-ui-resolution.md`.

Inspect:

- framework and routing;
- design tokens;
- component library;
- form primitives;
- dialogs;
- toasts;
- search;
- tables;
- date/select components;
- loaders;
- localization;
- sibling workflows;
- `DESIGN.md`;
- `UX-CONTRACT.md` if present.

If a canonical owner exists, reuse or extend it.

Do not create a screen-local alternative to an existing shared primitive.

## 3. Ground product behavior

Read maintained product sources before inventing workflow:

- PRD / product brief;
- ADRs;
- domain contracts;
- API schemas;
- permission rules;
- existing sibling flows;
- tests;
- maintained design/UX docs.

Business and security constraints outrank convenience.

If authoritative sources conflict, surface the conflict. Do not silently choose whichever implementation is easiest.

## 4. Maintain durable design context

Read `references/design-context-lifecycle.md`.

For a real application:

- read project-root `DESIGN.md`;
- create it from `assets/DESIGN.template.md` if the project lacks durable design context;
- update it only for durable system decisions;
- trace design tokens to runtime sources.

For substantial multi-screen products, maintain `UX-CONTRACT.md` using `assets/UX-CONTRACT.template.md`.

## 5. Build a behavior map

Before implementation, privately map each operation:

`trigger → pending → success → destination → feedback → failure recovery`

Compare with sibling workflows.

The same operation should behave the same way across screens unless a business rule genuinely differs.

## 6. High-risk decisions never use generic defaults

Do not invent behavior for:

- permissions/security;
- billing/money;
- privacy/PII;
- irreversible lifecycle operations;
- legal/regulatory language;
- external non-idempotent side effects;
- shared domain state transitions.

Use authoritative product evidence or escalate.

See `references/decision-matrix.md`.

## 7. Safe defaults for low-risk ambiguity

When the product has no established rule:

- searchable admin table: server pagination;
- content feed: explicit Load more unless continuous consumption is the product;
- search debounce: 300 ms;
- create success: return to owning list and announce success;
- edit success: follow canonical sibling flow, otherwise return to owning list;
- destructive action: app-owned confirmation dialog;
- loading: stable app-owned indicator by default;
- accessibility target: WCAG 2.2 AA.

## 8. Cross-screen consistency is a feature

Read `references/consistency-system.md`.

Keep the same:

- labels;
- button hierarchy;
- save/cancel/back behavior;
- toast semantics;
- validation;
- empty/error/loading patterns;
- confirmation strength;
- focus behavior;
- navigation outcomes.

Intentional differences must be named variants, not one-off drift.

## 9. Tables and lists

Every non-trivial table needs deliberate dataset navigation.

Prefer semantic `<table>` for read-oriented tabular data.

Use ARIA grids only for spreadsheet-like keyboard interaction.

Preserve:

- query;
- filters;
- sort;
- page/cursor;
- page size;
- selection

in URL state by default when that state is useful to restore/share and not sensitive.

After filtering/deletion, reset or clamp pagination so the user is never stranded on an invalid empty page.

Give loading, empty, no-results, partial-error, and range/total states stable geometry.

Do not force shared page shells to `100vh` or `overflow: hidden` just to make one table fit.

## 10. Interaction semantics

Anything clickable must be semantically interactive.

Use:

- `<button>` for actions;
- `<a>` for navigation.

Avoid clickable `div`/`span` when native semantics work.

Every interactive control needs:

- default;
- hover;
- focus-visible;
- active/pressed;
- disabled;
- busy when applicable.

Do not make disabled controls look interactive.

## 11. Scrollbars and layout stability

The product should have one global scrollbar baseline for owned scroll surfaces.

Do not hide scrollbars for aesthetics.

Reserve stable geometry for:

- async content;
- media;
- loaders;
- validation/help text;
- scrollbars;
- banners;
- busy buttons.

Busy states must not change button width.

Overlays and popovers must not push document flow.

## 12. Dialogs and confirmations

Never use browser:

- `alert()`
- `confirm()`
- `prompt()`

for product UI.

Use accessible app-owned dialogs with:

- title/description;
- focus placement;
- Escape behavior;
- focus trap/inert background for modal surfaces;
- focus restoration;
- explicit action verbs.

Confirm destructive, irreversible, privacy-sensitive, permission-changing, bulk, and costly actions.

Avoid confirmation fatigue for normal reversible saves.

## 13. Toasts and status

Use one shared feedback system.

A toast acknowledges. It must not contain the only copy of critical information.

Field errors belong near fields.

Long-running or critical state belongs in persistent UI.

Use accessible live regions.

## 14. Buttons

Model buttons on two dimensions:

### Emphasis

- solid;
- outline;
- ghost/link.

### Intent

- brand/primary;
- neutral;
- success;
- warning;
- info;
- danger.

Do not communicate intent by color alone.

Keep radius, focus, icon spacing, disabled/busy behavior, and sizing consistent.

## 15. Forms

Read `references/data-entry-patterns.md`.

For application forms:

- own validation;
- preserve user-entered values after errors;
- show visible error text;
- associate errors with fields;
- focus/scroll to first invalid field after failed submit;
- prevent duplicate submit;
- preserve button dimensions while busy;
- warn before losing unsaved changes when appropriate.

Use `noValidate` when the product owns validation.

Textareas should not allow arbitrary manual resizing in product layouts unless the design intentionally supports it.

Secrets are masked by default and get a keyboard-accessible reveal control.

Never leak secrets into URLs, analytics, logs, toasts, or persistent client storage without explicit security design.

## 16. Search

Every search input should have an app-owned clear button when non-empty.

Remote search:

- default 300 ms debounce;
- IME-safe;
- cancel or ignore stale requests;
- clearing happens immediately;
- committed query goes to URL state when appropriate.

Do not let older responses overwrite newer results.

## 17. Navigation and overlays

Read `references/navigation-layout.md` and `references/layer-contract.md` when the task includes:

- drawers;
- sidebars;
- modal sheets;
- tabs;
- breadcrumbs;
- sticky headers;
- nested scroll regions;
- mobile navigation.

Define scroll ownership explicitly.

Do not let nested surfaces fight for scrolling.

## 18. Async resilience

Read `references/async-resilience.md`.

Every asynchronous operation must define:

- pending;
- success;
- empty;
- partial success when relevant;
- recoverable error;
- retry behavior;
- stale request handling;
- offline/session/conflict behavior when relevant.

Do not hide failure behind an endless spinner.

## 19. AI / LLM interfaces

Read `references/llm-streaming.md`.

For streaming AI interfaces:

- distinguish submitting, connecting, streaming, tool-use, done, cancelled, and failed states;
- preserve partial output on recoverable failure when safe;
- support cancellation;
- keep the composer stable;
- do not fake progress;
- cite sources when the product claims grounding;
- never fabricate source counts, confidence, verification status, or retrieval results.

## 20. Permissions and auth

Read:

- `references/auth-patterns.md`
- `references/permission-ui.md`

The frontend must not pretend to authorize operations the server does not authorize.

Permission-disabled actions need clear reasons when the reason is not obvious.

Never expose sensitive data merely because a control is hidden.

## 21. File upload

Read `references/file-upload.md`.

Uploads need:

- type/size constraints;
- progress when meaningful;
- cancellation when meaningful;
- duplicate prevention where appropriate;
- retry;
- failure recovery;
- accessible file selection;
- safe filename display;
- server-side validation.

## 22. Verification before done

Read:

- `references/verification-checklist.md`
- `references/anti-patterns.md`

Before declaring completion:

- inspect the rendered result;
- test responsive breakpoints;
- test keyboard navigation;
- test focus;
- test loading/empty/error states;
- test reduced motion;
- run project tests;
- search changed code for known anti-patterns;
- verify no local duplicate replaced a canonical owner.

Do not claim completion from static code inspection alone when the environment supports stronger verification.

## Supporting references

Load only when relevant:

- [Canonical UI Resolution](references/canonical-ui-resolution.md)
- [Consistency System](references/consistency-system.md)
- [Consistency Migration](references/consistency-migration.md)
- [Decision Matrix](references/decision-matrix.md)
- [Design Context Lifecycle](references/design-context-lifecycle.md)
- [Token Mapping](references/token-mapping.md)
- [Data Entry Patterns](references/data-entry-patterns.md)
- [Async Resilience](references/async-resilience.md)
- [Interaction Contract](references/interaction-contract.md)
- [Navigation & Layout](references/navigation-layout.md)
- [Layer Contract](references/layer-contract.md)
- [LLM Streaming](references/llm-streaming.md)
- [Auth Patterns](references/auth-patterns.md)
- [Permission UI](references/permission-ui.md)
- [File Upload](references/file-upload.md)
- [Research Sources](references/research-sources.md)
- [Verification Checklist](references/verification-checklist.md)
- [Anti-patterns](references/anti-patterns.md)
