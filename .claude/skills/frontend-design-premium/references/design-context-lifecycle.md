# Design Context Lifecycle

The owner's current visual brief and rendered UI guide this repository. Its former design document has been retired and must not be recreated.

Optional design context in other projects can be useful when:

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

For multi-screen behavior, consult `UX-CONTRACT.md` as an implementation reference subordinate to the current owner request.
