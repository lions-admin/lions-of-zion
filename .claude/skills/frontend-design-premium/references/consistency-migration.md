# Consistency Migration

For inconsistent mature products, do not perform a blind big-bang redesign.

Sequence:

1. inventory drift;
2. identify high-risk inconsistencies;
3. choose canonical behavior;
4. repair shared primitives;
5. migrate the most important workflows;
6. block new local variants;
7. retire legacy implementations;
8. update design/UX contracts;
9. verify with tests and visual inspection.

Prioritize:

- destructive actions;
- auth/permissions;
- money;
- data-entry;
- navigation;
- async recovery;
- large shared tables;
- high-traffic flows.
