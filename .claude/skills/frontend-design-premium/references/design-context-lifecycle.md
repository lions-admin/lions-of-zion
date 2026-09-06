# Design Context Lifecycle

`DESIGN.md` is durable product taste memory.

Create it when:

- the application lacks maintained design context;
- the project will have multiple screens;
- repeated visual decisions are already emerging.

Update it only for durable decisions:

- palette;
- typography;
- geometry;
- tokens;
- component principles;
- motion;
- accessibility;
- responsive behavior.

Do not rewrite it to justify accidental implementation drift.

When changing a durable token:

1. update the normative source;
2. update runtime token source;
3. update shared components;
4. verify affected screens.

For multi-screen behavior, use `UX-CONTRACT.md` rather than stuffing workflow rules into `DESIGN.md`.
