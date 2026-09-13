---
name: ops-report
description: Report a task to the owner's operations board (/admin?area=tasks) through scripts/ops/report.mjs. Use at the end of every task — a finish report is required by owner ruling (2026-09-12) — and at milestones, blockers, and visual changes.
user-invocable: true
---

# Report to the operations board

The full contract, in Hebrew, is `docs/ops/task-reporting.md`. This is the
short form for Claude and Grok, whose `start` and `progress` are already
automatic through the hooks in `.claude/settings.json`. What is **not**
automatic is the finish — a task is never marked completed without one.

## At the end of a task (required)

```bash
npm run ops:report -- finish \
  --summary "מה נעשה, בשפה של הבעלים" \
  --changes "אילו קבצים ויכולות השתנו, ומה אומת (איזו בדיקה, מה יצא)" \
  --remaining "מה מהבקשה לא נעשה — או: כלום" \
  --blockers "מה תקוע ומה ישחרר אותו — או: אין" \
  --next "הצעד הבא" \
  --link "PR=https://github.com/lions-admin/lions-of-zion/pull/123"
```

Add `--status failed` or `--status cancelled` when the task did not complete.
Never send `finish` for work that was not done and verified; write "לא אומת"
in `--changes` instead.

## Visual change → screenshot

```bash
npm run ops:capture -- --url http://localhost:3000/ --widths 1280,390 --kind before --pair home
# make the change
npm run ops:capture -- --url http://localhost:3000/ --widths 1280,390 --kind after --pair home
```

No screenshot applies (server, docs, scripts)? Say so:
`--meta screenshots="אין צילום רלוונטי"` on the finish.

## Milestones and blockers

```bash
npm run ops:report -- progress --message "מיגרציה 0066 הוחלה על Preview; הבדיקות עוברות"
npm run ops:report -- status --status blocked --message "צריך OPS_REPORT_SECRET ב-Vercel"
npm run ops:report -- note --message "ממצא: …"
```

## Sub-tasks

A sub-agent or a separate strand gets its own key under the session's task:

```bash
npm run ops:report -- start --task "$(npm run -s ops:report -- whoami | awk '/taskKey/{print $2}'):backend" \
  --parent "$(npm run -s ops:report -- whoami | awk '/taskKey/{print $2}')" --title "…"
```

## Which task am I on?

```bash
npm run ops:report -- whoami
```

The key defaults to the session the SessionStart hook recorded for this
directory, so a finish typed in the shell lands on the right record. Override
with `--task KEY` or `OPS_TASK_KEY`.

## Offline

Everything is spooled to `~/.lions-ops/spool/` first and sent when it can be;
`npm run ops:report -- flush` retries. Without `OPS_REPORT_SECRET` (env or
`~/.config/ai-dev/ops-report.env`) lines spool and wait — say so in the final
message rather than claiming the board was updated.
