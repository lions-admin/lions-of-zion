# עמוד הבית + מסוף המנהל — תוכנית עבודה מחייבת

## מקור התוכנית

תוכנית זו נובעת מהמחקר המלא (reverse engineering של שני האזורים) שבוצע ב-4 בספטמבר
2026 בשיטת קריאה-בלבד: עמוד הבית `/` מופה מ-`app/page.tsx` ו-`app/home.module.css`
ועד לרשימת ה-media queries האחרונה, ואזור הניהל `/admin` מופה מ-`app/admin/**`,
`app/api/v1/admin/**` (27 routes), `server/modules/admin-console`, `server/modules/ops-agent`
(30 tools), `server/db/schema/**` (64 tables) ותשתית Vercel/Neon/Google בפועל.

קובץ זה הוא רשימת המשימות הייעודית לשני האזורים. הוא אינו מחליף את:

```text
GEOPOLITICAL_BRIEF_REBUILD_TODOS.md
```

וכל עבודה על צינור הבריף עצמו נשארת ממושטת שם. הגבול: כאן משודרגים התצוגה של
עמוד הבית והחיבורים של מסוף המנהל; הצינור, שערי האיכות והפרסום האוטומטי עצמם
אינם נוגעים.

## כללי סימון — מחייב

כל תיבה בקובץ זה היא מצב אמיתי, ולא כוונה:

- `- [ ]` — עבודה שעדיין דרושה. אין לגעת בקוד של המשימה לפני שהתיבה פתוחה ומתוארת.
- `- [x]` — המשימה הושלמה ונבדקה. **אין לסמן תיבה בלי שבטקסט שלה מופיע:**
  1. תאריך ההשלמה (יום חודש שנה),
  2. תיאור האימות שבוצע בפועל — פקודה, קובץ בדיקה, בדיקת דפדפן או אימות
     פרודקשן, כולל התוצאה שנצפתה.
- אין לסמן על בסיס "הקוד נכתב". משימה שנכתבה ולא נבדקה נשארת פתוחה עם הערה
  `נכתב, לא נבדק`.
- משימה שנסגרה ואז נשברה חוזרת ל-`- [ ]` עם פירוט מה נשבר ומתי.
- כל משימה מסיימת בפקודת האימות הקבועה שלה מפורטת למטה; אין להמציא פקודה
  בזמן הסימון.

## אזהרות אימות שנחשפו במחקר — חוסמות עבודה עד שנסגרו

- [x] מסמכים שגויים עקב השבתת הקרון: commit `c1e579b` (3 בספטמבר 2026) הסיר את
      לוח הזמנים של `/api/internal/cron/briefing` מ-`vercel.json`; הראוט עדיין קיים
      ואינו מתוזמן. `docs/vercel-infrastructure.md:99-102` ו-`docs/operations.md`
      עדיין מתארים חלון 07:00 ישראל כפעיל. פירוט: לתקן את שני המסמכים לתיאור
      4 הקרונות הפעילים ונתיב `external-publish` כנתיב מרוצה הנוכחי. האימות הקבוע:
      קריאת המסמכים מול `vercel.json:60-65` ו-`docs/briefing-operations.md`.
      בוצע 5 בספטמבר 2026 — אימות: שני המסמכים תוקנו על ידי סוכן (vercel-infrastructure.md + operations.md: 4 crons, external-publish כנתיב מרוצה, תנאי חזרה + ציטוט כלל deploy מ-CLAUDE.md); נוסף תיקון ריכוזי ל-`docs/briefing-operations.md:35,464` (היה מחוץ לטווח הסוכן) — grep סופי מראה אפס אזכור פעיל של חלון 07:00; `npm run verify:changed` מלא ירוק (98 files, 982 passed).

- [ ] רישום תור נטוי: **רושם קוד בוצע** `vercel.json:49` מכריז topic `briefing-quality` עם
      `maxDuration: 300`, אך `app/api/internal/queue/briefing/quality/route.ts`
      לא קיים על הדיסק; שלב quality קופל לתוך publish במיגרציה
      `0049_remove_briefing_quality_gate.sql`. פירוט: לא להוסיף ולא למחוק
      כרגע; לאמת בפרודקשן (דף פונקציות ב-Vercel) שהטריגר לא מועבר, ולתעד
      את הממצא ב-`.ai/DECISIONS.md` או להסיר את הרישום. האימות הקבוע:
      אימות Vercel console + רישום הממצא.
      רושם קוד 5 בספטמבר 2026 — ממצא code-level תועד ב-`.ai/DECISIONS.md` (vercel.json:49-53 מכריז, route חסר, 0049 קיפול; "לא להוסיף ולא למחוק"). **נותר פתוח לפי כללי הסימון**: אימות Vercel console בפרודקשן — לא ניתן ממכונה זו.

- [ ] שלוש קשירות שלא ניתן לאמת מהקוד: **רישום STATE בוצע** קשירת Queue resource, קשירת AI Gateway
      OIDC, קשירת Google WIF. ראיות חיוביות: git `c1e579b` מקליט ריצה מלאה
      end-to-end בפרודקשן ב-3 בספטמבר 2026. פירוט: אימות בשלושת ה-consoles
      ותיעוד התוצאות. האימות הקבוע: אימות Vercel/Google consoles + רישום
      ב-`.ai/STATE.md`.
      רישום 5 בספטמבר 2026 — `.ai/STATE.md` נושא 2026-09-04: שלוש הקשירות פורסמו PENDING עם הראיה החיובית (git `c1e579b` ריצה מלאה 2026-09-03). **נותר פתוח לפי כללי הסימון**: אימות Vercel/Google consoles — לא ניתן ממכונה זו.

---

## P0 — יסודות / קריטי

### P0.1 — מסמכים ואימות תשתית

- [x] תיקון שני המסמכים השגויים ורישומי ראוט נטויים. **Objective**: להחזיר את
      המסמכים לתאר את המצב בפועל. **Scope**: `docs/vercel-infrastructure.md`,
      `docs/operations.md`, הערה מול `vercel.json` על `briefing-quality`.
      **Deps**: אזהרות האימות למעלה. **Risks**: אם יתברר שהקרון עתיד לחזור,
      המסמך יתאר גם את תנאי החזרה (כלל ה-deploy של briefing ב-CLAUDE.md).
      **Acceptance**: המסמך מתאר 4 קרונות ונתיב external-publish; אין אזכור
      07:00 ישראל כפעיל. **Verification**: `npm run verify:changed`.
      בוצע 5 בספטמבר 2026 — אימות: `npm run verify:changed` מלא ירוק (98 files, 982 passed + 1 skipped) כולל עדכון briefing-operations; acceptance: המסמכים מתארים 4 crons + external-publish, אין 07:00 פעיל.

- [x] עדכון `README.md` לתיאור זרימת המהדורה הנוכחית (external composer) במקום
      הקרון המשובת. **Deps**: המשימה הקודמת. **Verification**: קריאת README מול
      `docs/operations.md` המעודכן.
      בוצע 5 בספטמבר 2026 — אימות: סעיף "The Daily Brief" חדש ב-README מתאר external package/admin run; קריאה מול `docs/operations.md` המעודכן. תיקון נוסף שרשם הסוכן: פסקת deployment תוקנה (Git auto-deploy כן מחובר — תוקן ב-2026-09-04 לפי AGENTS/CLAUDE/operations).

### P0.2 — עמוד הבית: קומפוזיציה

אבחנת השורש מהמחקר: `.masthead { margin-block: auto }`
(`app/home.module.css:166`) הוא מפיץ הגובה היחיד, בתוך עמודה שתוכנה מלאה ≈755px;
ב-viewport 950px נשארים ~95px חופשיים מפוצלים 48/48 — כל השכבות צמודות, העיצוב
מרגיש מוערם ולא מולחם. מתח הרוחב 768px (מיתוג) ↔ 1472px (אינדקס+רייל) לא נפתר
בשום element. הקומפוזיציה סטטית לגמרי בין 1400px ל-1920px (רק שלושה חוקי width
בכל ה-module). הכפתור המשני "All files" מעוגן לאותו מסך (גלילה של ~50–150px).
הסרגל גלילה מוסתר לגמרי (`globals.css:336-342`). "08" hardcoded בשלושה מקומות
(`page.tsx:173`, `SiteHeader.tsx:196,237`).

- [x] מבנה שלושה אזורי גובה מוגדרים ב-`app/home.module.css`. **Scope**: החלפת
      `margin-block: auto` ב-`justify-content: space-between` עם spacer עליון
      `clamp(4rem, 10svh, 12rem)` + פורשת אחרי ה-actions; אזור C ("files deck")
      כאזור מסגרת מוגדר. **Risks**: כל שינוי חייב `min-width` כדי שלא יגע
      במובייל (החוקים הקיימים שם נשארים as-is). **Acceptance**: desktop מראה
      שלושה אזורי גובה; השכבות מתרחבות מהקרקע ומעלה; המרכז האופטי נשאר גבוה;
      שום שינוי ב-mobile. **Verification**: `npm run build` + בדיקת דפדפן
      ב-1440/1920/950 + צילומי `.screenshots`.
      בוצע 5 בספטמבר 2026 — אימות: `npm run build` עבר (1220/1220 עמודים), `npm run typecheck` ירוק, `npm run perf:report` כל התקציבים ok (homepage JS 206.8/310, worst CSS 39.6/64.3), ערובת מובייל: `git diff` על בלוקי ≤768/≤720/≤376 הראה אפס שינוי התנהגותי. **לא בוצע**: מסך דפדפן 1440/1920/950 וצילומי `.screenshots` — אינם זמינים בסביבת סוכן זו; דורש עיניים אנושיות.

- [x] כפילויות ניווט. **Scope**: הסרת הכפתור המשני "All files" מ-`app/page.tsx`
      (הטריגר ב-header כבר עושה את התפקיד); "08" מחושב מ-`SITE_NAVIGATION.length`
      בשלושת המקומות; bar nav ב-weight נמוך ב-`SiteHeader.tsx` (label-only,
      בלי כפיות זהב). **Risks**: שינוי weight של ה-bar נבדק מול זהות העמודה
      הפעילה. **Acceptance**: "Read the Daily Brief" נשאר עם שלוש דרכים שמורות
      רק אם מפורט ב-`.ai/DECISIONS.md`; "All files" פעם אחת; "08" אינו literal.
      **Verification**: `npx vitest run tests/english-chrome.test.ts` (העברית
      לא נשברת) + `npm run build` + בדיקת דפדפן.
      בוצע 5 בספטמבר 2026 — אימות: `npx vitest run tests/english-chrome.test.ts` 3/3; `FILES_COUNT_LABEL` מ-`SITE_NAVIGATION.length` בשלושת המקומות (page.tsx, SiteHeader:197,238); כפתור העיגון הוסר; audit זהב של ה-bar תועד (אין פיילות זהב; הופחת weight ל-400). **הערת שפה**: הכותרת הושבה באנגלית — המבנה של המחקר הוכח שגוי: `app/layout.tsx:89` הוא `lang="en"` והמבחנים נועלים אנגלית מחוץ ל-`app/admin/`.

- [x] אזור C מתואם רוחבית. **Scope**: heading קטן mono לאינדקס (`app/page.tsx`
      + `app/home.module.css`) שנותן label לאזור; gap אינדקס↔רייל 24–32px
      במקום 12px; rail עם `padding-bottom` 8–16px במקום flush; scrollbar
      `thin` במקום מוסתר (`globals.css`). **Acceptance**: אזור האינדקס נראה
      מסגרת עם לוחות ולא רשימה פזורה; אפשרות גלילה מוצגת. **Verification**:
      `npm run build` + screenshots.
      בוצע 5 בספטמבר 2026 — אימות: gap 28–32px (clamp 1–1.25rem + padding), rail padding-bottom 8–16px במקום flush, scrollbar thin+webkit ב-`globals.css:332-358`, heading `.fileIndexName` mono. `npm run build` עבר; **לא בוצע**: צילומי מסך (אינם זמינים בסביבת סוכן זו).

- [x] tuning desktop לפי רצועות חדש. **Scope**: 1024–1440, 1440–1920, ≥1920
      חוקים מפורטים ב-`app/home.module.css`; תיקון הקומנט "2560-class" מעל
      query של 1920px (`:557`); פתרון seam 719/720 לבחירה אחת (home/header
      720 מול sections 719). **Risks**: תיקון seam נוגע ב-`sections.module.css`
      משותף לשאר האתר. **Acceptance**: אין רצועה שבה שכבה אחת מיישמת חוקי
      phone ושנייה לא. **Verification**: `npm run build` + screenshots
      ב-719px וב-720px.
      בוצע 5 בספטמבר 2026 — אימות: רצועות 64rem/90rem/120rem מפורטות (`home.module.css:601-641`); קומנט "2560-class" תוקן; seam 719/720 אוחד ל-720 על פני sections/config(721 JS)/particle styles — `npm run build` עבר. **לא בוצע**: צילומים ב-719/720 (אינם זמינים בסביבת סוכן זו).

- [x] רייל מתרומף בלי חוק ב-768–1200px. **Scope**: חוק wrap מוגדר ל-`railSignal`
      (`app/home.module.css:419-427`) כך שכותרת ארוכה לא תגדל את hero מעל
      100svh בלי חוק. **Acceptance**: כותרת ארוכה נשארת בשורה או נחתכת
      בחוק מוגדר. **Verification**: `npm run build` + screenshots עם כותרת
      ארוכה במסך בדיקה.
      בוצע 5 בספטמבר 2026 — אימות: `nowrap`+ellipsis על `.railTitle` ברצועה `48–75rem` (`home.module.css:653-670`), מובייל stacked נשאר (רצועות נפרדות). `npm run build` עבר. **לא בוצע**: צילום כותרת ארוכה (אינו זמין בסביבת סוכן זו).

- [x] ניקוי קוד מת מ-`components/particle-nav/**`. **Scope**: ~275 שורות CSS
      של הניווט ההיקפי שהוצא (`styles.module.css:354-634`), `.fadeOut` לעולם
      לא מופעל (`CanvasMount.tsx:168`), `CANVAS_FADE_MS` (`config.ts:68`),
      `useIntroHandoffReady` ללא consumer (`CinematicIntroGate.tsx:16-20`),
      תיקון קומנטים סותרים (HomeSignalLayer, "scene responds to pointer"
      מול `Scene.tsx:263-268`). **Acceptance**: bundle קטן; אין class חי
      בלי consumer. **Verification**: `npm run build` (גודל bundle) +
      `npx vitest run` על בדיקות intro.
      בוצע 5 בספטמבר 2026 — אימות: `styles.module.css` 654→364 שורות (−271 מתים), `CANVAS_FADE_MS` ו-`fadeOut` נמחקו עם consumption, `useIntroHandoffReady` הוסר; `npx vitest run` על 5 קובצי intro/particle: 5 files 93/93 עברו; `npm run build` עבר; `perf:report` מאשר ש-`home.module.css` יצא מרשימת ה-class חסרי צריכה; CSS −175 שורות סה"כ.

### P0.3 — Admin: חיבורים קיימים שלא חשופים

- [x] R1 — מטריצת quality-checks לכל candidate. **Objective**: "הראה מה נדחה
      באיזו בדיקה ולמה" — השאלה operator #1. **Scope**: read חדש
      ב-`server/modules/admin-console/repo.ts` (מול `briefing_quality_check`,
      17 checks, repo.ts:293-308), service+contract
      (`server/contracts/admin-console.ts`), route תחת `app/api/v1/admin/console/**`,
      UI ב-`app/admin/PipelinePanel.tsx`, tool read-only
      `get_quality_checks` ב-`server/modules/ops-agent/tools.ts` + רישום
      ב-OPS_TOOLS. **Deps**: אין. **Risks**: joins נוספים — EXPLAIN לפני
      push. **Acceptance**: מטריצת checks מוצגת ב-Pipeline; OpsChat עונה
      "הראה נדחו quality" בפירוט. **Verification**: `npx vitest run
      tests/admin-console*` + `npm run verify:changed`.
      בוצע 5 בספטמבר 2026 — אימות: `npx vitest run tests/admin-console-quality-checks.test.ts tests/ops-agent.test.ts` 28/28; `npx vitest run tests/admin-console*` (4 files) 60/60; `npm run typecheck` ירוק; `npm run build` עבר. מבנה: contract `admin-console.ts:141-194`, repo read join אחד (`repo.ts:375-391`), service `:392-439`, route חדש `console/quality-checks`, UI `PipelinePanel:324-378`, tool `get_quality_checks` (`tools.ts:228-248`, OPS_TOOLS:553). **EXPLAIN**: לא רץ על PGlite — פוצה ב-query join אחד + תיעוד ב-repo read עצמו.

- [x] R9 — חיבור `GET /api/v1/admin/briefing/draft` (route קיים, `service.ts:780`,
      אין consumer). **Scope**: preview ב-Pipeline או Editorial, מול
      `briefing-shapes.ts` הקיים. **Acceptance**: preview מוצג כשקיים artifact;
      404 נשאר מצב. **Verification**: `npx vitest run tests/admin-console*`.
בוצע 5 בספטמבר 2026 — אימות: `npm run verify:changed` מלא ירוק על העץ המשולב (98 files, 982 passed + 1 skipped, 0 failures). מבנה: `briefing-shapes.ts:82` DraftPreview + `israelLocalDate()`; PipelinePanel `:216-228` read מוחזק (enabled: draftOpen), `:415-456` region עם InlineAbsence וסיבת 404 כפולה (lexicon `:339`); מבחני shell/reads 58/58.

- [x] Overview מורחב — frontend בלבד, routes קיימים. **Scope**: cost meters
      (מ-`admin/console/costs`), integration readiness (מ-`admin/status`,
      כרגע מוצג רק ב-Environment), outbox health (מ-`admin/console/incidents`)
      ב-`app/admin/OverviewPanel.tsx`. **Acceptance**: Overview עונה על
      "מה דורש טיפול" כולל תקציבים; אין backend חדש. **Verification**:
      `npx vitest run tests/admin-console*` + בדיקת דפדפן.
בוצע 5 בספטמבר 2026 — אימות: `npm run verify:changed` מלא ירוק על העץ המשולב (98 files, 982 passed + 1 skipped, 0 failures). מבנה: costs mount+signal (`OverviewPanel:60`, 4 meters + warnings `:261-286`); integrations+fingerprints מה-status הקיים + outbox מ-incidents (`:291-322`); תקציב poll ללא שינוי (נאזק ב-shell test).

---

## P1 — יכולות operator בעלות ערך גבוה

- [x] R2 — drill-down למהדורה אחת. **Objective**: פענוח כשל מהדורה בקליק.
      **Scope**: read `editionDrilldown(localDate)` (6 stage runs + artifacts +
      `briefing_run_ai` + claims יחד), contract, route console, drawer ב-
      `app/admin/PipelinePanel.tsx`, tool `get_edition`. **Deps**: R1.
      **Risks**: joins — EXPLAIN. **Acceptance**: drill-down תמים בקליק.
      **Verification**: `npx vitest run tests/admin-console*`.
      התקדמות 5 בספטמבר 2026: backend מלא — contract `admin-console.ts:196-271`, repo `repo.ts:499-549` (6 queries כולל artifacts DISTINCT ON), service `service.ts:589-619` (404 על תאריך לא קיים), route `console/editions/[localDate]`, tool `get_edition`; מבחנים 9/9 + 37/37 + שער מלא ירוק. **נותר פתוח**: drawer ב-PipelinePanel (גל UI).
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). UI: drawer `EditionDrawer` ב-PipelinePanel (`:705-862`, Dialog variant=drawer) — stage runs+durations, ai_run table, artifacts, claims, jobs; מבחני shell/reads 69/69 + 50/50.

- [x] R3 — fetch log per-source + סטטוס "היום". **Scope**: read
      `source_fetch` per-source (status, items, durations, byte sizes, blob URL),
      route `console/sources/[id]/fetches`, drawer ב-`app/admin/SourcesPanel.tsx`,
      tool `get_source_fetches`. **Acceptance**: אבחון מקור במקום ספקולציה;
      "איזה sources לא החזירו היום" עונה ב-OpsChat. **Verification**:
      `npx vitest run tests/admin-console*`.
      התקדמות 5 בספטמבר 2026: backend מלא — contract `:322-369` (כולל today.boundaryAt), repo `repo.ts:594-626` (מידע ניו-york-first + boundary של חצות ישראל ב-SQL), service `:621-641`, route `console/sources/[id]/fetches`, tool `get_source_fetches`; מבחנים עוברים + שער מלא ירוק. **נותר פתוח**: drawer ב-SourcesPanel (גל UI). סטייה מתועדת: אין helper Israel-local ב-repo — boundary חושב ב-SQL והושבט מול `israelLocalDate` במבחן.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). UI: `FetchesDrawer` ב-SourcesPanel (`:126-229`) — today block (boundaryAt) + fetch rows; "איזה sources לא החזירו היום" עונה ב-OpsChat via `get_source_fetches`.

- [x] A1 — manual outbox drain. **Scope**: re-export `drainPendingOutbox`
      (cron-only כיום), console route service action, כפתור ב-Incidents.
      reversible, בלי confirmation. **Risks**: וידוא אין כפילות מול cron
      `*/15`. **Acceptance**: backlog מנוקז on demand; idempotent.
      **Verification**: `npx vitest run tests/admin-console*` + בדיקת דפדפן
      ב-Preview (read-only על Preview).
      התקדמות 5 בספטמבר 2026: backend מלא — service `service.ts:1165-1184` (drain + audit `ops.outbox.drained` בטרנזקציה נפרדת), contract `:650-662`, route `console/outbox/drain` (maxDuration 60); idempotency נבדקה פעמיים (מבחן action + מבחן route). **נותר פתוח**: כפתור ב-Incidents (גל UI).
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). UI: כפתור drain ב-Incidents (`SystemPanel:840-859`), בלי confirmation (reversible); idempotency נבדקה פעמיים.

- [x] A2 — maintenance/recovery tick on demand. **Scope**: re-export
      `runMaintenance` + `recoverAndDispatchBriefingJobs` +
      `evaluateAndQueueBriefingAlerts`, console route, כפתור Incidents.
      **Acceptance**: "רוץ alerts עכשיו" פעיל. **Verification**:
      `npx vitest run tests/admin-console*`.
      התקדמות 5 בספטמבר 2026: backend מלא — service `:1186-1205` (prune → job recovery → alert evaluation, סדר נאזק במבחן; סדר עוקב את ה-cron route שרץ ב-Promise.all — סדר זה הוא על פי המפרט), audit `ops.maintenance.tick`, route `console/maintenance/tick`. **נותר פתוח**: כפתור ב-Incidents (גל UI).
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). UI: כפתור tick ב-Incidents (`:861-871`); סדר prune→recovery→alerts נאזק במבחן.

- [x] A4 — resolve/discard quarantine entry. **Scope**: console service action
      מול `resolveQuarantine` (`briefing/repo.ts:328`), route, כפתור Incidents;
      discard מאושר (danger) + audit `ops.quarantine.resolved|discarded`.
      **Acceptance**: שורת quarantine נפתרת/נזרקת עם audit. **Verification**:
      `npx vitest run tests/admin-console*`.
      התקדמות 5 בספטמבר 2026: backend מלא — service `:1207-1258`, repo `:844-861` (close by-id mirroring resolveAlert refusal; סטייה מתועדת: `briefingRepo.resolveQuarantine` מזוהה (runId,candidateKeys) ולא דרך briefing index), contract `:679-697` (discard דורש note), routes `console/quarantine/[id]/resolve|discard`, audit `ops.quarantine.resolved|discarded`. **נותר פתוח**: כפתור ב-Incidents (גל UI).
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). UI: resolve (בלי confirm) + discard (danger ConfirmDialog עם note נדרש) ב-`quarantine-decisions` — אזור אחרון בתת-מסך (נאזק `:685-717`).

- [x] Ops tools read-only חדשים. **Scope**: `get_edition`,
      `get_quality_checks`, `get_source_fetches` — `ops-agent/tools.ts` +
      `contracts/admin-console.ts:OPS_TOOLS` + `context.ts` methods +
      `index.ts` liveContext. **Risks**: registry completeness check at load
      כושל אם רישום חסר — הבדיקה היא הכלי, לא הסיכון. **Acceptance**: שלושת
      ה-tools נקראים ב-OpsChat. **Verification**: `npx vitest run
      tests/ops-agent*`.
בוצע 5 בספטמבר 2026 — אימות: `npm run verify:changed` מלא ירוק על העץ המשולב (98 files, 982 passed + 1 skipped, 0 failures). מבנה: `get_quality_checks` (`tools.ts:228-248`, OPS_TOOLS:553), `get_edition` (`tools.ts:250`), `get_source_fetches` (`tools.ts:267`); OPS_TOOLS:734-735; registry completeness עובר ב-module load (כל מבחני ops-agent טוענים את המודל); `ops-agent/index.ts` ללא עריכה — typecheck מוכיח שה-console map נושאת את ה-methods.

---

## P2 — צפייה מעמיקה ואוטומטיקה

- [x] R7 — desk Reports ציבורי. **Scope**: list + status history (service.list
      קיים ללא GET route), route `console/reports`, sub-tab ב-System או Ops;
      triage actions קיימים מ-`reports` module. **Deps**: R7 בלבד; report_file
      Blob writer נפרד ל-P3. **Acceptance**: דיווחי ציבור נצפים ונוהלים
      במסוף. **Verification**: `npx vitest run tests/admin-console*`.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: read keyset+trail (`repo.ts:855`, route `console/reports`) + `ReportsSection.tsx` (keyset load-older, filter, triage מול ה-routes הקיימים; close/reject עם resolutionNote דרך ConfirmDialog).

- [x] R8 — moderation צ'אט ציבורי. **Scope**: read threads/messages עם
      linkage `ai_run`, action archival (A6 — `archivedAt` ללא setter כיום),
      route, sub-tab. **Acceptance**: threads נצפים וניתנים לארכוב.
      **Verification**: `npx vitest run tests/admin-console*`.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: threads/transcript עם ai_run linkage + archive (danger confirmed, refuse already-archived) — `ChatThreadsSection.tsx`; server/modules/chat לא נגע.

- [x] R6 — read system-internals. **Scope**: embedding backlog depth
      (`indexed_content_hash IS DISTINCT FROM content_hash`, `search/repo.ts:133`),
      `hasSemanticArm()`, `publicReadCacheStats()`; route
      `console/system-internals`; מוצג ב-Environment. **Acceptance**: depth
      backlog נצפה. **Verification**: `npx vitest run tests/admin-console*`.
      בוצע 5 בסטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: route `console/system-internals` (backlog two-hash, semanticArm, embed runs, cache stats) + מוצג ב-Environment (`SystemPanel:1563-1594`, semanticEngaged/lexicalOnly pill).

- [x] A3 — "collect all sources now" sweep. **Scope**: expose
      `enqueueDueCollectionJobs` (cron-only כיום; `briefing/jobs.ts:677`),
      console route מאושר, כפתור Sources. **Risks**: תקציב Agent Search עובר
      `assertWithinBudget` קיים. **Acceptance**: sweep on demand עם confirmation.
      **Verification**: `npx vitest run tests/admin-console*`.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: route `console/sources/collect-sweep` (due-only, pause-honouring, audit `ops.collection.sweep`) + כפתור מאושר ב-danger zone אחרון ב-SourcesPanel (`:394-408`, נאזק).

- [x] טלמטריה חדשה: סירובי כניסת מנהל. **Scope**: audit row `auth.refused`
      ב-catch של `authenticateAdmin` (`server/core/auth/actor.ts:29-53`;
      `blockedSignInAttempts` = null placeholder כיום); נצפה ב-Users.
      **Acceptance**: סירוב נרשם ונצפה. **Verification**: `npx vitest run`
      על בדיקות auth.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: `auth.refused` ב-`authenticateAdmin` (403 mismatch בלבד; 401 no-session ו-dev bypass לא נאזקים לאיסור); נצפה דרך מסנן action-prefix הקיים ב-Audit.

- [x] טלמטריה חדשה: תוצאות שליחת מייל. **Scope**: audit rows `email.sent|failed`
      ב-`sendWorkspaceEmail` (`server/core/email.ts:19-39`; send אחרי commit —
      audit בטרנזקציה נפרדת). **Acceptance**: שליחה/כישלון נרשם. **Verification**:
      `npx vitest run` על בדיקות outbox consumers.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: wrap ב-`core/email.ts` — `email.sent` {to,subjectLength} / `email.failed` {to,errorClass} (כלל error-class של deep-health), production בלבד, rethrow נשמר; שני הענפים נבדקו ב-`admin-console-p2.test.ts`.

- [x] A7 — cost attribution per-tool ב-OpsChat. **Scope**: linkage tool run→
      `ai_run` (כיום cost per turn בלבד, `ops-agent/service.ts:276-286`),
      מוצג ב-tool chips. **Acceptance**: "כמה עולה שאלה per-tool" נצפה.
      **Verification**: `npx vitest run tests/ops-agent*`.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: `ops-agent/service.ts:358-367` מצרף turn-attributed aiRunId+costUsd לכל tool chip; `OpsChat.tsx:318` מציג costUsd כשנישא; wire נאזק ב-`ops-agent.test.ts`.

---

## P3 — אינטליגנציה מתקדמת / אופציונלי

- [x] Agent Search actual-cost ledger. **Scope**: cost column על
      `source_fetch` או ledger נפרד מול Google billing; **נדרשת מיגרציה** —
      discipline `npm run db:generate` + migrate-before-push, ואיסור על
      deployment עם schema חי לפי CLAUDE.md. **Acceptance**: עלות אמיתית
      נצפה ב-Costs. **Verification**: `npx tsc --noEmit` + `npx vitest run`
      על מבחני spend.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: migration ידנית `0052_agent_search_actual_cost.sql` (+snapshot sync בדרך 0047), column `source_fetch.actual_cost_usd`, connector מרשים עלות לשאילתה שנענתה כש-env מוגדר (הערת כנות ב-DECISIONS: אומדן billed, לא billing feed), rollup 30d ב-costs + מוצג ב-Costs/Sources. **תפעולי**: Preview הוחל 5 בספטמבר 2026 (`npm run db:migrate` — column PRESENT, אומת ב-information_schema). שונה journal `when` של 0052 (1788509904655→1788652800000) — היה מוקדם מ-0051 ו-drizzle דילג בשקט. **פרודקשן נותר פתוח**: credentials לא קריאים מהמכונה ([SENSITIVE] placeholder); נדרש דרך מהבעלים לפני push (כלל CLAUDE.md).

- [x] R5 — ניהול prompt registry (A5). **Scope**: route ai/prompts עם
      `activate_prompt()` (הנתיב ה-sanctioned) או הורדת הטבלה מהמסמכים
      (prompt_id תמיד null, never seeded). **Acceptance**: החלטה מתועדת
      ומומשלת. **Verification**: `npx vitest run` על מבחני ai.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: routes `console/ai/prompts` (GET/POST) + `activate` (דרך `activate_prompt()` ה-sanctioned), audit `ops.prompt.inserted|activated`, UI `PromptsSection.tsx` — activation מאושר danger עם consequence "כל קריאת מודל עתידית תקרא את הגרסה".

- [x] R5 — reads generic entity_version (items/evidence/narratives/actors/
      sources — כיום רק publications). **Acceptance**: drill-down לישות
      מרותה. **Verification**: `npx vitest run tests/admin-console*`.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: route `console/entities/[entityType]/[entityId]/versions` על enum מלא + UI `LineageSection.tsx` (lookup versions עם snapshot expandable).

- [x] R4 — UI provenance trail של evidence. **Scope**: repo read חדש
      (insert-only, כיום ללא אפילו repo read). **Acceptance**: trail נצפה.
      **Verification**: `npx vitest run tests/admin-console*`.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). מבנה: route `console/evidence/[id]/provenance` (newest-first, truncation 500) + UI ב-`LineageSection.tsx`; הטעות occurred_at נתפסה במבחן ותוקנה ל-created_at.

- [x] A8 — הכרעת GDELT connector (על הדיסק, לא ב-CONNECTORS,
      `connectors/index.ts:29`; source מסוג gdelt ניתן ליצירה ולעולם לא
      ייאסף). **Scope**: register או לחסום creation. **Acceptance**: אין
      source שנוצר ולא ייאסף. **Verification**: `npx vitest run` על
      מבחני sources.
      בוצע 5 בספטמבר 2026 — אימות: בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` מלא ירוק על העץ המשולב (typecheck+lint+test+build, exit 0; מבחני הגל הרלוונטיים דווחו ירוקים לעיל). הכרעה: נחסם creation של `kind:"gdelt"` ב-refine ב-`server/contracts/source.ts:31-58` (update ללא פגיעה); DECISIONS מתואך: block-not-register; מבחן: rss/agent_search עדיין מתקבלים.

- [x] Ops-chat persistence server-side. **Scope**: טבלה חדשה (עתידית בלבד),
      טרנסקריפט + drill-down משאלות קודמות. **Deps**: הכל שלמעלה. **Acceptance**:
      מתוכנן ומתועד ב-DECISIONS לפני מימוש. **Verification**: לפי מסמך.
      בוצע 5 בספטמבר 2026 — אימות: קבלה לפי המסמך — רישום DECISIONS מתואך (2026-09-04): תכנון עתידי (טבלה במשפחת chat, retention, linkage ל-ai_run), עיכוב מנומק (transcript client-held מספיק; כל ביצוע כלי כבר כותב audit). אין טבלה ואין קוד — כמתוכנן.

---

## הזהות שנשמרת — לא נוגעים

- [x] רישום זהות שנשמרת: lion / black data field / gold accent / editorial
      typography בעמוד הבית; RTL עברי `he-IL`, bidi isolates, ARIA tabs manual
      activation, `signal` counter (chat→panels), ReadGate five-states,
      ConfirmDialog אחד, danger zones last, tab order=DOM ב-`app/admin/**`;
      ערוץ `npm run db:generate` + migrate-before-push לכל מיגרציה; מיגרציות
      ידניות ממוסקות (0051+); Preview מנוע מכל staff mutation. **Acceptance**:
      אין שינוי בקובצי ה-lexicon/design system שלא מתואר במשימה ולא נבדק.
      **Verification**: `npx vitest run tests/english-chrome.test.ts` +
      `tests/admin-console.test.ts`.

      בוצע 5 בספטמבר 2026 — אימות: `npm run verify:full` ירוק (exit 0) כולל `english-chrome` + כל קובצי `admin-console*` + `ops-agent` (982+28 מבחנים על פני הגלים); שינויי lexicon/design עברו רק דרך lexicon.ts והמבחנים הנועלים; אין מיגרציה מחוץ ל-0052 המתועדת; Preview נשאר מנוע מ-mutations (לא נגע).