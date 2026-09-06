# Consistency System

Consistency applies to behavior, not only appearance.

Maintain a small behavior ledger:

| Operation | Trigger | Pending | Success | Failure | Destination | Feedback |
|---|---|---|---|---|---|---|

Equivalent operations should share:

- labels;
- control type;
- confirmation strength;
- pending behavior;
- success destination;
- toast/status semantics;
- error recovery;
- focus behavior;
- keyboard interaction.

When a workflow intentionally differs, give the difference a business name and encode it as a variant.

Do not allow each screen to invent its own version of Save, Delete, Search, Cancel, Back, Empty, Error, or Loading.
