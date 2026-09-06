# Canonical UI Resolution

Before adding UI behavior, find the canonical owner.

Inspect:

1. runtime design tokens;
2. shared component library;
3. form primitives;
4. dialogs/toasts;
5. loaders;
6. search;
7. tables;
8. selects/date pickers;
9. route shells;
10. localization;
11. sibling flows;
12. maintained `DESIGN.md` and `UX-CONTRACT.md`.

For each capability, choose exactly one:

- reuse existing owner;
- extend existing owner with a named variant;
- create a new shared owner because recurrence is likely;
- use a native browser control intentionally;
- escalate because product behavior is unresolved.

Do not create a screen-local duplicate when a canonical owner already exists.

A local implementation is acceptable only when the behavior is genuinely one-off and does not establish a product convention.
