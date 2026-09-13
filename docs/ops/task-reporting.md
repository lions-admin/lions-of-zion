# דיווח משימות ללוח התפעולי

<div dir="rtl">

**מסמך זה הוא החוזה המשותף לכל סוכן שעובד על הפרויקט** — Claude, Codex, Grok,
OpenCode, Gemini AGY, הריצה העריכתית של ChatGPT, GitHub Actions וסקריפטים
מקומיים. הוא נקבע בהנחיית הבעלים ב-2026-09-12. הלוח עצמו הוא
`/admin?area=tasks`; ה-API הוא `POST /api/internal/ops/tasks/report`
(החוזה: `server/contracts/ops-tasks.ts`); הכלי שכולם משתמשים בו הוא
`scripts/ops/report.mjs`.

## מה זה

מקום אחד שבו הבעלים רואה, בלי לשחזר משיחות וטרמינלים: מה רץ עכשיו, מי עשה
מה, מה השתנה, מה נשאר, מה תקוע ואיך זה נראה. לכל משימה יש מזהה יציב, רשומה
שמתעדכנת (מצב, ציר זמן, שינויים, קישורים, צילומי מסך) וסוכן אחראי. בתחתית
הלוח יש **טבלת כיסוי** שאומרת ביושר אילו סביבות באמת מדווחות ומתי דיווחו
לאחרונה.

## מתי מדווחים

| אירוע | מתי | מה חייב להיות בו |
| --- | --- | --- |
| `start` | בתחילת משימה (אוטומטי ב-Claude/Grok; ידני באחרים) | `--title`, `--request` (הבקשה המקורית, במילים של הבעלים), `--kind` |
| `progress` | בכל נקודת ציון: קובץ חשוב נכתב, בדיקה עברה, החלטה התקבלה | `--message` — שורה או שתיים |
| `status` | כשהמשימה עוברת ל-`waiting` / `blocked` / חוזרת ל-`running` | `--status` ו-`--message` שמסביר למה |
| `note` | הערה שאינה התקדמות — ממצא, סיכון, שאלה לבעלים | `--message` |
| `finish` | **חובה** בסוף כל משימה, גם כשנכשלה | ראה למטה |
| `attach` | לכל שינוי חזותי | קובץ, סוג, כיתוב, ומפתח זוג ל"לפני/אחרי" |

### דוח סיום (`finish`) — חובה, ומה חייב להיות בו

משימה **לעולם לא מסומנת כהושלמה אוטומטית**. `completed` נרשם רק מ-`finish`
מפורש. סוכן שהתנתק בלי `finish` נשאר `running` ומסומן בלוח כ"לא דיווח" —
זה המצב הנכון, לא באג.

`finish` חייב לכלול:

- `--summary` — מה נעשה, בשפה שהבעלים קורא (עברית או אנגלית, לא שמות פונקציות).
- `--changes` — אילו קבצים/יכולות השתנו, ומה אומת (איזו בדיקה רצה ומה יצא).
- `--remaining` — מה **לא** נעשה מתוך הבקשה, במפורש. "כלום" הוא ערך תקין.
- `--blockers` — מה תקוע ומה בדיוק ישחרר אותו (הגדרה בסביבה, סוד, החלטה של הבעלים).
- `--next` — הצעד הבא הקונקרטי.
- `--status failed` או `--status cancelled` כשהמשימה לא הושלמה. ברירת המחדל היא `completed`.
- `--link label=url` לכל מה שמישהו צריך לפתוח: PR, הרצת CI, דף באתר, artifact.

### צילומי מסך

לכל שינוי שרואים בדפדפן — עמוד, רכיב, קונסולה, עיצוב — מצרפים צילום.
עדיפות ל"לפני/אחרי" באותו רוחב, עם מפתח זוג משותף:

```bash
npm run ops:capture -- --url http://localhost:3000/ --widths 1280,390 --kind before --pair home
# … השינוי …
npm run ops:capture -- --url http://localhost:3000/ --widths 1280,390 --kind after  --pair home
```

או קובץ שכבר קיים:

```bash
npm run ops:report -- attach --file shot.png --attachment-kind after --pair hero --caption "הכותרת החדשה"
```

כשאין מה לצלם — שינוי בשרת, במסמך, בסקריפט — כותבים ב-`finish`:
`--meta screenshots="אין צילום רלוונטי"`. לא משמיטים בשקט.

## סיכום אוטומטי בעברית בסוף הסשן

`finish` נשאר חובה, אבל משימה שהסשן שלה נגמר לא נשארת בלי הסבר. שני מנגנונים
דואגים לזה, ושניהם עוברים דרך `scripts/ops/hook.mjs`:

1. **בכל סוף תור (`Stop`)** ה-hook שולח `progress` שבו `summary` הוא הטקסט
   האחרון של הסוכן (עד 16,000 תווים) ו-`changes` הוא שורת הסיכום של
   `git diff --stat` ועד 40 נתיבים של קבצים שהשתנו. כך משימה רצה תמיד נושאת
   הסבר עדכני, גם אם הסוכן יתנתק ברגע הבא.
2. **בסיום הסשן (`SessionEnd`)** ה-hook בונה **תמצית (digest)** מהתמליל
   (`transcript_path`): הבקשה הראשונה של הבעלים, שני הטקסטים האחרונים של
   הסוכן, כל קובץ ש-`Edit`/`Write`/`MultiEdit` נגעו בו, ספירת כלים, והקומיטים
   מאז תחילת הסשן (`git log --since`). התמצית נשלחת ל-
   `POST /api/internal/ops/tasks/summarize` (אותה כותרת `x-ops-report-secret`),
   **והשרת** — לא הסקריפט — מפעיל מודל שכותב כותרת, סיכום, שינויים, מה נשאר
   ומה תקוע בעברית, ומעדכן את המשימה. שום דבר בצד הלקוח לא מנסח את הסיכום.

התמצית מוגבלת לפי חוזה השרת: בקשה ≤6,000 תווים, טקסט אחרון ≤12,000, טקסט
קודם ≤6,000, ≤200 קבצים, ≤100 קומיטים. `language` (`he`/`en`/`mixed`)
מזוהה מהטקסט. כשהשרת לא זמין התמצית נשמרת ב-`~/.lions-ops/spool-digests/`
ו-`npm run ops:report -- flush` שולח גם אותה (אחרי תור הדיווחים הרגיל).
תמצית שנדחתה (400/413/422) עוברת ל-`spool-digests/rejected/`.

אותה תמצית אפשר לבקש ידנית, לכל משימה ולכל תמליל:

```bash
npm run ops:report -- digest --task claude:<session> --transcript ~/.claude/projects/<dir>/<session>.jsonl
npm run ops:report -- digest --file digest.json            # תמצית שבנית בעצמך
npm run ops:summarize -- --task KEY --transcript PATH       # אותו דבר, CLI דק
npm run ops:summarize -- --task KEY --transcript PATH --dry-run   # מדפיס את התמצית, לא שולח
npm run ops:summarize -- --all-imported --only-missing      # כל ההיסטוריה שיובאה, בלי מה שכבר סוכם
```

`ops:backfill -- --apply --summarize` עושה את זה לכל משימה מיובאת אחרי
הייבוא (שלוש במקביל, שורת התקדמות כל עשרים), ו-`--only-missing` מדלג על
מפתחות שכבר רשומים ב-`~/.lions-ops/state/summarized.json`. הייבוא עצמו
כותב עכשיו `summary` = הטקסט האחרון של הסוכן ו-`changes` = הקבצים
והקומיטים, מתמלילי Claude (JSONL), Codex (`~/.codex/sessions`, כולל
`custom_tool_call`/`apply_patch`) ו-Grok (`chat_history.jsonl`); עבור
`docs/reviews/*/REPORT.md` גוף הדוח הוא הטקסט האחרון.

## הוקים ואוטומציות (hooksInventory)

בפתיחת סשן (`SessionStart`) ה-hook מצרף לשורת ה-`start` שדה `hooksInventory`:
מה באמת מחובר במכונה ובריפו, כפי שנאסף ברגע זה, לא כפי שמתועד. הלוח מציג
אותו במקטע **"הוקים ואוטומציות"** של המשימה, ו-`npm run ops:hooks` מדפיס
אותו כ-JSON (`--summary` לשורה אחת לכלי). האוסף הוא
`scripts/ops/hooks-inventory.mjs`, ללא תלויות, ולעולם לא זורק: קובץ חסר הוא
`status: "none"` עם הערה שאומרת מה חסר.

| כלי (`id`) | מה נקרא | מצב |
| --- | --- | --- |
| `claude-machine` | `~/.claude/settings.json` — כל אירוע × פקודה × timeout | `active` כשיש hooks |
| `claude-project` | `<repo>/.claude/settings.json` — ה-hooks שמדווחים ללוח | `active` |
| `grok` | `~/.grok/config.toml` `[compat.claude] hooks` — אם true, אותם hooks של Claude עם ציון compat; כשהקובץ חסר: ברירת המחדל המתועדת (true), וההערה אומרת שזו הנחה | `active` / `none` |
| `codex` | שורת ה-`notify` ב-`~/.codex/config.toml` → אירוע `turn-ended` | `active` כשהיא מצביעה על `scripts/ops/codex-notify.mjs`, אחרת `partial` |
| `opencode` | `~/.config/opencode/opencode.json` plugins/hooks | `none` — "אין ממשק hooks; מדווח רק דרך קומיטים ו-CLI" |
| `gemini-agy` | `~/.gemini/settings.json` hooks | `none`, אותה הערה |
| `git` | תיקיית `core.hooksPath` — כל קובץ בר-הרצה הוא אירוע (post-commit, pre-push) | `active` כשיש post-commit |
| `github-actions` | `.github/workflows/*.yml` — הטריגרים ב-`on:` כאירועים, שמות ה-jobs כפקודה | `active` |
| `vercel` | `vercel.json` — `ignoreCommand`, `git.deploymentEnabled`, `experimentalTriggers`, crons | `active` |
| `mcp` | `.mcp.json` — כל שרת הוא אירוע, הפקודה או ה-URL שלו | `active` |

הצורה היא זו של החוזה: עד 20 כלים, עד 60 hooks לכלי, פקודה עד 600 תווים,
הכול מתחת ל-64KB (האוסף מקצר הערות ופקודות אם צריך). המטרה היא שהבעלים
יראה בלוח, לצד כל משימה, אילו אוטומציות היו פעילות כשהיא רצה — ולא יצטרך
לפתוח חמישה קובצי הגדרות כדי לענות "למה Codex לא דיווח start".

## משימת-אב ופעולות משנה

משימה גדולה שמתפצלת — סוכני-משנה, כמה סבבים, כמה קומיטים — נשארת רשומה
אחת עם ילדים. ילד נפתח עם `--parent <מפתח האב>`, ומופיע בלוח תחת האב.
קומיט מהסשן הנוכחי נרשם אוטומטית כילד של הסשן (ראה git hook למטה).

```bash
OPS_TASK_KEY=claude:abc npm run ops:report -- start --title "משימת אב" --request "…"
npm run ops:report -- start --task claude:abc:migration --parent claude:abc --title "מיגרציה 0066"
```

## מזהי משימה

המפתח (`taskKey`) הוא מחרוזת יציבה, וכל דיווח עם אותו מפתח מעדכן את אותה
רשומה. ברירת המחדל נקבעת בסדר הזה:

1. `OPS_TASK_KEY` בסביבה — כשרוצים לקבוע במפורש.
2. `claude:<session_id>` / `codex:<thread_id>` — כשה-CLI רץ בתוך הסוכן.
3. הסשן שה-hooks רשמו לתיקייה הנוכחית (`~/.lions-ops/state/current/`) — כך
   `finish` שמוקלד במעטפת של Claude נופל על המשימה שה-SessionStart פתח.
4. `<agent>:<תאריך>-<hash של התיקייה>` — כשאין שום דבר אחר.

מפתחות שהמערכת עצמה יוצרת: `git:<sha>` לקומיט ולתוצאת ה-CI שלו,
`editorial:<run_key>` לריצה העריכתית (נקרא מטבלת `editorial_run`, אין
כתיבה כפולה), `import:<sha1 של המקור>` להיסטוריה שיובאה.

`npm run ops:report -- whoami` מדפיס את הזהות, המפתח שייבחר, כתובת הבסיס,
אם יש סוד, וכמה שורות ממתינות.

## מה קורה בלי חיבור (spool)

כל דיווח נכתב **קודם** לקובץ ב-`~/.lions-ops/spool/`, ורק אחר כך נעשה ניסיון
שליחה של כל התור, מהישן לחדש. כישלון — אין רשת, אין סוד, האתר לא זמין —
משאיר את הקבצים במקום, כותב שורה אחת ל-stderr ויוצא עם קוד 0. שום hook,
git hook או שלב CI לא נכשל בגלל דיווח. הניסיון הבא (כל הרצה של הכלי, או
`npm run ops:report -- flush`) שולח את מה שהצטבר. לכל שורה יש `eventKey`
אקראי, ולכן שליחה חוזרת אינה יוצרת כפילויות בשרת. שורה שהשרת דחה
(400/413/422) מועברת ל-`spool/rejected/` כדי לא לחסום את השאר.

## מה אסור

- **לא ממציאים השלמה.** `finish` נשלח רק אחרי שהעבודה באמת נעשתה ואומתה.
  אם משהו לא אומת — כותבים "לא אומת" ב-`--changes`.
- **לא מסמנים `completed` ידנית במקום הסוכן.** הלוח מאפשר לבעלים "סמן
  כהושלם ידנית" עם הערה, וזה נרשם כפעולה ידנית של הבעלים, לא כדיווח של הסוכן.
- **סוכן שהתנתק בלי `finish` לא מסומן כהושלם.** ה-hook של סיום הסשן רושם
  הערה "הסשן הסתיים ללא דוח סיום" ומסמן `sessionEnded`; המצב נשאר `running`
  והלוח מציג "לא דיווח".
- **לא מדווחים דרך ערוץ אחר.** לא קובץ TODO, לא הודעה בצ'אט, לא הערה
  בקומיט בלבד. הקומיט נרשם אוטומטית, אבל הוא לא תחליף ל-`finish`.
- **לא שולחים סודות או תוכן רגיש** בשדות הדיווח. הרשומה נשמרת במסד הייצור.

## הסביבות ואיך כל אחת מחוברת

| סביבה | `start` / `progress` | קומיטים | `finish` | דרגת חיבור | מה מחבר אותה |
| --- | --- | --- | --- | --- | --- |
| Claude Code | אוטומטי — hooks ב-`.claude/settings.json` (SessionStart עם `hooksInventory`, UserPromptSubmit, Stop עם `summary`+`changes`, SubagentStop, SessionEnd עם תמצית לסיכום בעברית) | אוטומטי — git post-commit | **ידני** — `npm run ops:report -- finish`; הסיכום האוטומטי של השרת ממלא את הפער אבל אינו מסמן `completed` | אוטומטי (חוץ מ-finish) | ה-hooks מגיעים עם ה-checkout |
| Grok | אוטומטי — אותם hooks (`[compat.claude] hooks = true`) | אוטומטי | **ידני** | אוטומטי (חוץ מ-finish) | אותו קובץ hooks |
| Codex | אוטומטי — `notify` ב-`~/.codex/config.toml` עטוף ב-`scripts/ops/codex-notify.mjs`; מדווח `progress` בסוף כל תור עם ההודעה האחרונה | אוטומטי | **ידני** | חלקי (רק סוף-תור, אין SessionStart) | עטיפת ה-notify במכונה של הבעלים; הנתיב הוא ה-checkout הראשי `Documents/lions-of-zion` |
| OpenCode | **ידני** בלבד | אוטומטי | **ידני** | חלקי | אין לכלי משטח hooks. עד שיהיה — הקומיטים וה-CLI הידני הם הכיסוי |
| Gemini AGY | **ידני** בלבד | אוטומטי | **ידני** | חלקי | כנ"ל |
| ChatGPT — ריצה עריכתית | נקרא מ-`editorial_run` בצד הקריאה | — | — | אוטומטי (קריאה) | אין כתיבה שנייה: הלוח מציג את הריצות כמשימות של `chatgpt-editorial` |
| GitHub Actions | — | — | `ci` על `git:<sha>` | אוטומטי כשהסוד קיים | ה-job `report-ops` ב-`.github/workflows/ci.yml`; דורש repo secret `OPS_REPORT_SECRET` |
| סקריפט מקומי / אדם | `LIONS_AI=local-script npm run ops:report -- …` | אוטומטי | ידני | ידני | — |

הגדרות שצריך במכונה (פעם אחת):

- `~/.config/ai-dev/ops-report.env` עם `OPS_REPORT_SECRET=…` (ואופציונלית
  `OPS_REPORT_BASE_URL=…` לבדיקה מול שרת מקומי). אותו ערך מוגדר ב-Vercel
  כ-`OPS_REPORT_SECRET` (Production + Preview) וכ-repo secret ב-GitHub.
- `~/.config/ai-dev/git-hooks/post-commit` — קיים במכונת הבעלים מ-2026-09-12;
  רץ דרך `core.hooksPath` לכל סוכן וכל אדם, ורק כשהריפו שמקומט מכיל
  `scripts/ops/git-post-commit.mjs`.
- `~/.codex/config.toml` — שורת ה-`notify` עטופה; הערה מעל השורה מכילה את
  הערך המקורי לשחזור.

## פקודות

```bash
npm run ops:report -- whoami
npm run ops:report -- start --title "…" --request "…" --kind code|editorial|design|ops|research|review|import|other
npm run ops:report -- progress --message "…"
npm run ops:report -- status --status blocked --message "…"
npm run ops:report -- note --message "…"
npm run ops:report -- finish --summary "…" --changes "…" --remaining "…" --blockers "…" --next "…" [--status failed] [--link label=url]
npm run ops:report -- attach --file PATH --attachment-kind screenshot|before|after|artifact|file [--caption "…"] [--pair KEY]
npm run ops:report -- digest --task KEY --transcript PATH | --file digest.json   # סיכום בעברית מהשרת
npm run ops:report -- flush     # שולח את תור הדיווחים וגם את תור התמציות
npm run ops:capture -- --url URL [--url URL2] [--widths 1280,390] --kind before|after|screenshot [--pair KEY] [--task KEY]
npm run ops:hooks [-- --summary]                    # מה מחובר במכונה ובריפו, כ-JSON
npm run ops:summarize -- --task KEY --transcript PATH [--dry-run]
npm run ops:summarize -- --all-imported [--only-missing]
npm run ops:backfill                                # dry run
npm run ops:backfill -- --apply [--summarize]       # ייבוא היסטוריה חד-פעמי, ואופציונלית סיכום של כל משימה
npm run ops:backfill -- --summarize --only-missing  # רק סיכומים, בלי לייבא שוב
```

דגלים משותפים: `--task KEY`, `--parent KEY`, `--meta k=v` (חוזר),
`--link label=url` (חוזר). משתני סביבה: `OPS_REPORT_SECRET`,
`OPS_REPORT_BASE_URL`, `OPS_TASK_KEY`, `LIONS_AI`, `LIONS_OPS_HOME`
(ברירת מחדל `~/.lions-ops`; תחתיו `spool/`, `spool-digests/`,
`state/summarized.json`).

</div>
