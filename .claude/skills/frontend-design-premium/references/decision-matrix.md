# Decision Matrix

## High-risk: never guess

Require product evidence or escalation for:

- permissions/security;
- billing/money;
- privacy/PII;
- deletion/deactivation/archive semantics;
- legal/regulatory copy;
- external non-idempotent actions;
- shared domain state transitions.

## Low-risk defaults

When no established product rule exists:

| Decision | Default |
|---|---|
| Admin data grid | server pagination |
| Feed/catalog | Load more |
| Remote search | 300 ms debounce |
| Create success | owning list + success feedback |
| Edit success | canonical sibling flow, else owning list |
| Destructive action | app-owned confirmation |
| Loading | stable app-owned indicator |
| Accessibility | WCAG 2.2 AA |

Defaults are fallbacks, not excuses to ignore existing project conventions.
