# Archive

Documents that were true, did their job, and are kept for the record rather
than for use. Nothing here is a source of truth. If a live document and an
archived one disagree, the live one wins — and the archived one is not to be
"corrected", because a historical record edited to match the present stops
being a record.

**One exception, on 2026-09-01, by explicit owner decision.** The radial
navigation was deleted from the project, and the owner ruled that it be purged
from the historical record as well as from the live documentation. So
`graphics-task-02.md` — the 2026 navigation-layer specification — was deleted
from this directory rather than kept as a marked-historical record, and the
orbit findings were cut out of the audit documents below. That is a deliberate
break of the rule in the paragraph above, recorded in `.ai/DECISIONS.md`
(2026-09-01) so that a reader comparing this directory against `git log` knows
why things are missing. It is not a precedent for correcting an archived
document to match the present.

Excluded from deploys via `.vercelignore`.

| Document | What it was | Why it is here |
| --- | --- | --- |
| [`TODOS-design-audit.md`](TODOS-design-audit.md) | The actionable task list generated from the 2026-08-26 audit | Reached **83 of 83 closed, zero open**. Nothing linked to it. Its "Do not refile" reasoning — three refuted findings, three browser-sweep withdrawals and seven merged ids — was lifted into `.ai/DECISIONS.md` before the move, because that is the part a future audit would otherwise re-litigate. |
| [`design-audit-2026-08-26.md`](design-audit-2026-08-26.md) | The 219 KB evidence report behind that list: the measured problem statement for every id | Its entire task list is closed. At 219 KB it was 40% of the documentation surface by bytes. Its three structural conclusions were lifted into `docs/architecture.md`'s known-gaps section. |
| [`TODOS-waves-2026-08.md`](TODOS-waves-2026-08.md) | The August 2026 wave log lifted out of `TODOS.md`: eight session narratives, a findings survey, and the October 7 archive integration wave | Every task in it is closed. It had grown to 610 of that file's 1,096 lines — a delivery plan that was 56% past tense. Two of its claims are known false today (W1 marks `app/loading.tsx` delivered; it was later deleted, and the same file records the deletion further down) and are left standing per the rule above. Its W1–W6 / A1–A7 numbering is preserved so the audit documents citing it still resolve. |
| [`2026-08-24-site-design-review.md`](2026-08-24-site-design-review.md) | An external design review, formerly `.codex/audits/2026-08-24-site-design-review/REPORT.md` | Orphaned — nothing referenced it. Superseded by both `.ai/DESIGN-V2.md` and the 2026-08-26 audit. **Its twelve evidence images were never committed**, so its "evidence walkthrough" walks through absent files; a note at the top of the file says so. |

## What is not here

Two things that look archivable and are not:

- **`.ai/DECISIONS.md`** is append-only and never archived. A reversed decision
  keeps its entry with the reversal appended — the record of a bad idea is what
  stops it being had twice.
- **`content-packages/`** is committed primary source material, not output.
  535 files, ~14 MB of JSON, every record addressed by an index and every index
  by a route.
