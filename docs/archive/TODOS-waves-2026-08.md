# TODOS.md — the August 2026 wave log

Lifted verbatim out of [`TODOS.md`](../../TODOS.md) on 2026-08-27, where it had
grown to 610 of that file's 1,096 lines: eight session narratives, a
findings survey and a finished integration wave, all written in the past tense
while the file around them was supposed to say what is *left*.

Every task in here is closed. The narratives are kept because they record how
the work went — including four platform failures worth not repeating — and
because several of them are the only prose account of *why* a thing was built
the way it was, for decisions too small to have earned an entry in
`.ai/DECISIONS.md`.

**Nothing here is a source of truth.** Where this file and the live `TODOS.md`,
`CLAUDE.md` or `.ai/STATE.md` disagree, the live one wins. Per
[the archive's rule](README.md), it is not to be corrected — a record edited to
match the present stops being a record. Two things in it are known to be false
today and are left standing:

- **W1 marks `app/loading.tsx` as delivered.** It was later deleted, because a
  root-level `loading.tsx` wraps every route in a Suspense boundary that is
  never replaced without JavaScript. The A3 section further down this same file
  records the deletion. Do not reintroduce one — `CLAUDE.md` and
  `.ai/DECISIONS.md` (2026-08-26) carry the standing prohibition.
- **Wave narratives quote test counts of 250, 323, 331 and 358.** Each was true
  on its day. The live count belongs in `TODOS.md`.

The header numbering (W1–W6, A1–A7) is preserved so that the audit documents
which cite it still resolve.

---

## עדכון יישום — 24 באוגוסט 2026

הסימון במסמך משקף את מצב הקוד שנבדק בפועל. `[x]` פירושו שהמשימה הושלמה ואומתה בהיקף המתואר; משימה שסומנה כחלקית נשארת `[ ]` עד שכל היקף הפרודקשן שלה מושלם.

### הושלם ואומת

- [x] נבנו שלושת מסכי הייחוס של שפת `Signal Room → Evidence Desk`: בית בדסקטופ, בית authored במובייל ו־Geopolitical Brief רספונסיבי.
- [x] לבית נוספו זהות ברורה, פריט מאומת אחרון וקבוצות ניווט לפי כוונת משתמש: Now, Understand & Verify ו־Trust & Participate.
- [x] נבנה חתך ייחוס מתוארך ל־Geopolitical Brief עם סטטוס, מקורות, הפרדה בין reporting ל־assessment, known unknowns והיסטוריית תיקונים.
- [x] Ask the Lion נפתח כ־modal נגיש: `aria-modal`, ‏focus trap, ‏Escape, השבתת הרקע והחזרת focus למפעיל.
- [x] במובייל ה־WebGPU הגדול מוסר לאחר האינטרו והאריה של הצ׳ט משתמש ב־fallback סטטי, כדי למנוע render loop שני מאחורי התוכן.
- [x] `npm run typecheck`, ‏`npm run lint`, ‏`npm test`, ‏`npm run build` ו־`npm run verify:graphics` עברו; 250 בדיקות עברו ואחת דולגה.
- [x] בדיקת Chrome אמיתית אימתה ניווט, התקדמות קריאה, פתיחה/סגירה של הצ׳ט, focus trap והיעדר שגיאות קונסול בזרימות הייחוס.

### הושלם חלקית — עדיין פתוח לפרודקשן

- [ ] Phase 0: בריף הייחוס כולל מקורות ציבוריים, אך עדיין דרושים אישור מערכתי, כללי authorship, taxonomy סופי, בדיקת תוויות live/active ומיפוי זכויות/הסכמה/משפטי.
- [ ] Phase 1: מסכי הייחוס והמעטפת הרספונסיבית קיימים; משפחת אייקונים חדשה, memorial mode, טוקנים גלובליים ובדיקת נגישות פורמלית עדיין פתוחים.
- [ ] Phase 2: ה־Geopolitical Brief מוכיח את החוויה, אך עדיין סטטי. חסרים חיבור למערכת הפרסום, מפה, שיתוף, related content, הרשמה, ארכיון ומצבי loading/empty/stale/error.
- [ ] Phases 3–7: הרחבת שבעת היעדים האחרים, Ask מבוסס citations, תשתית אמון/השתתפות, SEO, עברית/RTL והקשחת פרודקשן עדיין פתוחים.

## עדכון יישום — 25 באוגוסט 2026

סבב P0 ממוקד. ארבעה שינויים, כולם מכוסים בבדיקות יחידה טהורות; אף אחד מהם לא
נלכד עדיין ב־Chrome אמיתי, כי סקריפטי הלכידה מקודדים נתיב Chrome של macOS ואינם
רצים בקונטיינר.

- כפתור הצ׳ט וה־attention cue אינם קיימים בזמן האינטרו — לא מוסתרים. הסתרה ב־CSS
  השאירה renderer שני של WebGPU פעיל מאחורי אלמנט בלתי נראה למשך כל האינטרו.
- ה־orbit נפתר מול מה שמצויר בפועל (`nodeHaloRadius`) ולא מול תיבת ה־DOM, והפתרון
  האנכי מחשב כל קצה בנפרד עם רזרבה לשורת הכתובת בטלפון.
- למתמטיקת ה־viewport של האינטרו יש בעלים אחד; תקרת השורה היא 86vw אמיתיים.
- נמצא באג חי שלא היה ידוע: ב־768×1024 השורה הרחבה ביותר נרנדרה ב־170vw.

**דרוש מעבר Chrome אמיתי במק** לפני שמסמנים את תנאי הקבלה הוויזואליים.

## סקירת פרויקט מלאה — 25 באוגוסט 2026: תוכנית המשך פיתוח

ארבע סקירות מקבילות: ויזואלית (צילומי מסך של כל הראוטים ב־390×844 וב־1440×900,
כולל מצב ללא JavaScript), סקירת עומק תוכן, סקירת מעטפת טכנית וסקירת שכבת
הנתונים. הסעיף הזה הוא תוכנית פיתוח בלבד — תוכן, UI/UX, העשרה, חוויית גלישה
ושיפור ויזואלי. אבטחה ובדיקות מנוהלות בסעיפים הקיימים ואינן חלק מהסבב הזה.

### עדכון ביצוע — 25 באוגוסט 2026: גל 1 של המרתון הושלם

שישה סוכנים מקביליים ביצעו את רוב W1, W2 (בקונטיינר), W3, W5 ו־W6; הסימונים
בסעיפים למטה משקפים את מה שבוצע ואומת בפועל. השער המלא ירוק: typecheck, ‏lint,
‏323 בדיקות (1 מדולגת), ‏build כולל כל נתיבי המטא־דאטה. כפילות סיומת הכותרת
שנוצרה מתבנית ה־title תוקנה בשמונת הדפים.

**גל 2 לא בוצע** — כל W4 (תוכן פר־עמוד: פידים, צירי זמן, תיקי case, פרופילים,
פרקים, טפסים, עמודי methodology/corrections/consent) פתוח והוא נקודת ההתחלה
של הסשן הבא. התשתית שלו מוכנה: ספריית `components/content/` (ה־README שם
מתעד כל prop), ‏props חדשים ב־`SectionPage` ‏(`surface`, ‏`aside`, ‏`id`
ב־`SectionBlock`), וכלל התוכן ב־`DECISIONS.md` (אין עובדות מומצאות; מבנים
מקדימים מסומנים reference). משימות המק (Chrome אמיתי) נשארות בתחנת העבודה.

### עדכון ביצוע — 25 באוגוסט 2026: גל 2 (חלקי) — War Update, Fake Resistance, Support Us

בוצע באותו יום, סשן נפרד: `lib/content/` נבנה בפועל (war-update.ts,
fake-resistance.ts, corrections.ts — כל אחד `async` כדי שההחלפה העתידית
ל־`GET /api/v1/published-items` תהיה שינוי גוף פונקציה, לא call site). War
Update ו־Fake Resistance עברו לתוכן אמיתי ומקורות אמיתיים שאומתו ב־WebSearch/
WebFetch בסשן (ראו `.ai/DECISIONS.md` לרשימת המקורות ולשינוי אחד בתיק Fake
Resistance שהוחלף אחרי שהתגלה כנוגע במחלוקת אמיתית). Support Us קיבל טופס
"דיווח על טענה" אמיתי מול `POST /api/v1/reports` הציבורי הקיים, וטופס
התנדבות מבוסס `mailto:` (אין endpoint אמיתי לכך עדיין — יושר על פני זיוף
מצב "נשלח"). נוספו `/methodology` ו־`/corrections` (`DocPage` — מעטפת קלה
ללא file rail, לא מצטרפות ל־`defaultNodes`). "Ask the Lion about this file"
בתחתית כל עמוד דוסייה מחייב `ChatOpenProvider` חדש ב־`app/layout.tsx`
(state שיתופי בין `ParticleChatLauncher` ל־`SectionPage`, שלא היה קיים
קודם) — פותח את הצ׳ט עם שאלת פתיחה ממולאת מראש אך לא נשלחת אוטומטית.

**עדיין פתוח מ־W4**: October 7, Our Heroes, Israel's Story, We Are — נדחו
במפורש (תוכן רגיש/דורש הסכמת משפחות/היקף גדול מדי לסבב אחד). עמוד הסכמה/
הסרה למשפחות ועדים לא נבנה. השער המלא ירוק: typecheck, ‏lint, ‏323 בדיקות
(1 מדולגת), ‏build כולל `/methodology` ו־`/corrections` הסטטיים.

### עדכון ביצוע — 25 באוגוסט 2026: גל 2 הושלם — October 7, Our Heroes, Israel's Story, We Are

באותו יום, סשן שלישי: ארבעת העמודים שנדחו קודם נבנו, בכפוף לשתי החלטות
עריכה שאושרו מראש עם המשתמש (מתועדות ב־`.ai/DECISIONS.md`):

- **Our Heroes** מפרסם רק אנשים אמיתיים ששמם וסיפורם כבר מכוסים בהרחבה
  בעיתונות מיינסטרים בשם מלא — שלוש כרטיסיות טקסט בלבד (בלי תמונות, אין
  לזה בכלל שדה תמונה ב־`ContentCard`), כל עובדה מצוטטת למקור. אין תהליך
  הסכמת משפחות אמיתי עדיין, אז זה התקרה האחראית לסבב הזה — לא רצפה
  שתורחב בלי בקרה. פסקת "How these stories are gathered" הישנה טענה
  "nothing appears that the family has not seen and approved" — זו טענה
  לא נכונה לגבי הפרופילים החדשים ותוקנה להיות כנה.
- **October 7** מקשר לארכיוני עדות אמיתיים (Edut 710, USC Shoah
  Foundation, October7.org) במקום לשחזר עדות או לבנות פרופילי קורבנות —
  האתר הזה אין לו הסכמה מאף אחד מהם. "The record" מכיל נתונים אמיתיים
  שנבדקו (ADL).
- **Israel's Story** נפתח בשני פרקים אמיתיים ומצוטטים בלבד (הקמת המדינה
  1947–48, הסכם השלום עם מצרים 1979) — לא "הקשת הארוכה" המלאה. מוצהר
  בעמוד עצמו מה עוד חסר (התקופה העתיקה, 1967, 1973, אוסלו, ירדן 1994,
  הסכמי אברהם) ולמה.
- **We Are** מתאר את הצינור האמיתי (ingest → evidence → assessment →
  human review → publish → search), עם FAQ מבוסס עובדות שניתן לבדוק בקוד
  (למשל: `assessment.publish` לא יכול אף פעם להיות ביד זהות אוטומטית).

בנוסף: `surface="quiet"` הופעל על כל שבעת עמודי הדוסייה (7/7);
`openGraph` פר־עמוד על כל תשעת הראוטים (9/9); שורת קישורים
"Methodology · Corrections" נוספה לפוטר של `SectionPage` ולסגירה של
הברייף — **לא** נבנה footer גלובלי אחד ב־`app/layout.tsx`, כי `CLAUDE.md`
קובע מפורשות שלדף הבית אין תוכן מתחת לקיפול וה־layout עוטף גם אותו.
השער המלא ירוק: typecheck, ‏lint, ‏323 בדיקות (1 מדולגת), ‏build.

### עדכון ביצוע — 25 באוגוסט 2026: גל רביעי — הגירת הברייף, שני פרקים נוספים, נגישות

באותו יום, סשן רביעי, בוצע דרך שלושה סוכני `fork` מקבילים ב־worktrees
מבודדים (`isolation: "worktree"`), שמוזגו ידנית ל־`main`:

- **הגירת הברייף**: `GeopoliticalBrief.tsx` עבר במלואו ל־`components/content/`
  (`VerificationBadge`, ‏`PublicationMeta` — קיבל שדה `coverageWindow` חדש,
  שתוקן גם ב־War Update שלא הציג אותו כלל —, ‏`FigureRow`, ‏`KnownUnknownPanel`,
  `Timeline`, ‏`SourceList`, ‏`CorrectionHistory`). `BriefStatus` ממופה ל־
  `AssessmentValue` האמיתי; שני מקרי גבול מתועדים ב־`.ai/DECISIONS.md`.
  Developments ו־Corrections שינו צורה (מפריסה ייעודית ל־`Timeline`/
  `CorrectionHistory` המשותפים) — זה שינוי מכוון, לא תקלה. `ReadingProgress`
  עבר להיות משותף (`components/sections/ReadingProgress.tsx`) ומופיע גם
  ב־`SectionPage`. Scrollbar גלובלי מעוצב; focus-within מרגיע את אנימציית
  הרקע בכל עמוד.
- **Israel's Story**: שני פרקים אמיתיים ומצוטטים נוספים — מלחמת ששת הימים
  (1967, כולל חסימת מצרי טיראן ממקור משרד החוץ) ו־הסכמי אוסלו (1993,
  המורשת שלהם מסומנת כשנויה במחלוקת ולא מוכרעת). ארבעה פרקים כעת.
- **נגישות**: skip links ל־`SectionPage`/`DocPage`; תיקוני contrast אמיתיים
  (כמה טקסטים היו מתחת ל־4.5:1 מול הפלטה בפועל); `role="alert"` על שגיאות
  בטפסי Support Us.
- **תקלת פלטפורמה אמיתית שתועדה**: אחד משלושת ה־fork-ים ניסה בעצמו לפצל
  סוכנים נוספים וקיבל "Fork is not available inside a forked worker" —
  סוכן forked לא יכול לפצל fork נוסף. הוא ביצע את כל שלוש המשימות בעצמו
  בתוך אותו worktree; העבודה הכפולה שלו על הברייף ו־Israel's Story נזרקה
  בזמן המיזוג לטובת שני הענפים הייעודיים. סוכן נוסף החזיר תוצאה כוזבת
  (85 שניות, 0 קבצים שהשתנו בפועל) — זוהה בבדיקת `git worktree list` ולא
  לפי הטקסט שהוחזר, והמשימה הופעלה מחדש בהצלחה. פירוט מלא ב־
  `.ai/DECISIONS.md`. השער המלא ירוק אחרי המיזוג: typecheck, ‏lint, ‏323
  בדיקות, ‏build.

### עדכון ביצוע — 25 באוגוסט 2026: גל חמישי — קומפוזיציה ייחודית לכל שמונת העמודים

באותו יום, סשן חמישי, דרך `frontend-design` skill: שבעה סוכני `fork`
מקבילים ב־worktrees מבודדים, כל אחד עם בריף מדויק מבוסס-נושא (לא חופש
יצירתי כללי) כדי שהתוצאה תישאר משפחה אחת קוהרנטית ולא שבע זהויות שונות.
המעטפת המשותפת (rail, ‏prev/next, אינדקס קבצים, אמבלם) לא נגעה — ההבדלה
היא רק בקומפוזיציית ה־`.body` של כל עמוד, באותה מערכת טיפוגרפיה/צבע
הקיימת (Cinzel, ‏Geist Mono, גוונים gold/blue/ember). אין עובדות חדשות בשום
עמוד — זו עבודה קומפוזיציונית/טיפוגרפית על תוכן קיים בלבד:

- **War Update** — ריתמוס dateline של סוכנות ידיעות ("SHARM EL-SHEIKH —
  OCT 9, 2025"), נגזר ממיקום שכבר מופיע בטקסט המקורי של כל פריט — לא הומצא.
  פריטים בלי מיקום מצוין נשארים תאריך-בלבד.
- **Fake Resistance** — תיוג Exhibit A/B/C, "חותמת" ורדיקט בפינה (aria-hidden,
  ה־`VerificationBadge` הנגיש נשאר מקור האמת), יומן custody מקושר
  origin→amplification.
- **October 7** — הנתונים (1,200+/251/22+) עברו מרשת סטטיסטיקות קטנה
  לכתובת-לוח מונומנטלית (מספרות Cinzel גדולות, ללא מסגרות כרטיס), וה־
  timeline קיבל מרווח אנכי גדול יותר להאטת הקצב — הריסון עצמו הוא העיצוב.
- **Our Heroes** — פורמט ציטוט/הוקרה רשמי ("In recognition — October 7,
  2023") עם מסגרת פינות דקה, במקום גריד כרטיסים גנרי; עדיין אין תמונות.
- **Israel's Story** — עימוד פרקי ספר אמיתי: מספרות רומיות גדולות, כותרת
  "Chapter II of IV" רצה, drop cap אמיתי בפתיחת כל פרק, ותפריט תוכן
  עובד. סימון המחלוקת של אוסלו נשמר בולט (מסונן לפי id, לא טקסט שביר).
- **We Are** — "The method" הפך למסלול pipeline מחובר אמיתי (מסלול רציף,
  שלב ה־human review שובר צורה מעיגול ליהלום — כי הוא שונה מבנית, לא
  רק תיאורית), עם זרימה אמביינטית שמכבדת `prefers-reduced-motion`.
- **Support Us** — שני מודולים אמיתיים (Report/Volunteer) בתוך מסגרת
  toolkit ברורה, ו־Amplify/Sustain הורדו לרצועה קלה יותר שמבדילה בכנות
  בין תרגול קבוע לערוץ "עדיין לא פתוח".

**תקלה נוספת שתועדה**: אחד הסוכנים נעצר לפני שסיים לכתוב את הדוח הסופי
שלו (בזמן שהמתין לריצת בדיקות ברקע) — הקוד עצמו היה שלם ותקין (typecheck/
lint/build אומתו ידנית בעת המיזוג), רק הנרטיב לא הושלם. שני סוכנים (Our
Heroes, Support Us) השאירו שינויים לא-commit-ים ב־worktree שלהם והוחלו
כ־patch. השער המלא ירוק אחרי מיזוג כל שבעת הענפים: typecheck, ‏lint, ‏323
בדיקות, ‏build; בדיקת smoke ב־dev server אימתה תוכן אמיתי וללא שגיאות
בכל שבעת העמודים.

### עדכון ביצוע — 25 באוגוסט 2026: גל שישי — יתרת ה־backlog (P3/P6/P7)

באותו יום, סשן שישי: שישה מסלולים מקבילים על קבצים לא-חופפים, מתוך רשימת
המשימות ש"אני יכול לבצע בפועל" (לא Mac, לא backend, לא הסכמת משפחות)
שסוכמה עם המשתמש קודם לכן:

- **War Update**: פילטרים אמיתיים (front/home front/hostages/humanitarian/
  diplomacy) דרך רכיב `WireFeed.tsx` חדש, permalink + כפתור שיתוף לכל
  אירוע, תג "Latest" על האירוע העדכני ביותר — **לא** מנגנון "מה השתנה מאז
  הביקור האחרון" מזויף (האתר לא עוקב אחר ביקורים אמיתיים), ו־Article
  JSON-LD.
- **Fake Resistance**: `archiveUrl` אמיתי לשלושת המקורות — כל אחד אומת
  ידנית מול Wayback Machine's availability API לפני שנוסף, לא ניחוש.
  סעיף "Claim propagation" לפי התאריכים האמיתיים. JSON-LD מסוג
  **`ClaimReview`** (לא `Article` גנרי) — הסוג האמיתי של schema.org
  לתוכן fact-checking, עם מיפוי מפורש בין 9 ערכי `AssessmentValue` לסולם
  1–5 של `reviewRating`.
- **Israel's Story**: שלושה פרקים נוספים — מלחמת יום כיפור 1973, הסכם
  השלום עם ירדן 1994 (כפרק נפרד, לא מוזג לתוך "Peace, when it came"),
  הסכמי אברהם 2020 (כולל מרוקו וסודן). שבעה פרקים בסך הכול.
- **Geopolitical Brief**: שלוש נסיונות סוכן נכשלו בשקט על המשימה הזו
  (שניים עם אפס שינויים בפועל, אחד עם אפס קריאות tool) — ככל הנראה
  מגבלת concurrency כש־5 forks אחרים רצו במקביל, אך גם אחרי שהתפנו
  סלוטים נכשל שוב; בוצע ישירות בלי fork. הודעת "stale" כשה־`publishedAt`
  ישן מ־14 יום; מצבי "empty" כנים ל־Developments ו־Sources (לא שקט); רכיב
  `BriefError.tsx` חדש **שלא מחובר** לשום נתיב כשל אמיתי — אין עדיין
  fetch אסינכרוני אמיתי לברייף, אז אין נתיב כשל לדמות; `loading.tsx` לא
  נוסף מאותה סיבה. Article JSON-LD + canonical.
- **SEO לשישה עמודים נותרים** (Our Heroes, October 7, We Are, Support Us,
  Methodology, Corrections): canonical URL + JSON-LD בסוג schema.org
  הנכון לכל עמוד — `Article`+`Person` graph ל־Our Heroes, `Article`
  ל־October 7, **`Organization`** ל־We Are (זה עמוד ה"about" של האתר עצמו,
  לא כתבה), **`WebPage`** ל־Support Us/Methodology/Corrections (עמודי
  מדיניות, לא כתבות) — **לא** "Report" הכללי מהתיעוד הישן, כי זה לא סוג
  schema.org אמיתי. Support Us קיבל גם `ShareVerifiedButton` חדש
  (Web Share API + fallback העתקה) שמפנה לברייף — אין לו verdict משלו
  לשתף.
- **CI ו־rollback**: `.github/workflows/ci.yml` הראשון אי־פעם בריפו הזה —
  gate (typecheck/lint/test/build) + smoke test נתיבים דרך Chromium
  headless המובנה של Playwright (`scripts/ci-smoke.mjs`), **לא** נתיב
  ה־Chrome הקבוע ל־macOS ששאר סקריפטי האימות משתמשים בו — זה לא היה עובד
  ב־Linux runner. `.ai/ROLLBACK.md` מתעד את נוהל ה־rollback האמיתי
  ב־Vercel לפריסה הידנית של הפרויקט הזה. אין secrets, אין שלב deploy.

השער המלא ירוק אחרי מיזוג כל שישה: typecheck, ‏lint, ‏323 בדיקות, ‏build;
`node scripts/ci-smoke.mjs` (הכלי החדש עצמו) אישר 11/11 נתיבים תקינים
בלי שגיאות קונסול.

### ממצאי העל

- מתוך שמונת העמודים, רק Geopolitical Brief מכיל תוכן אמיתי — מתוארך, ממוספר,
  עם מקורות, badges והפרדת reporting/assessment. ארבעה עמודים (War Update,
  October 7, Our Heroes, Israel's Story) הם הצהרות כוונות טהורות: אפס פריטים,
  אפס תאריכים, אפס קישורים. Support Us הוא עמוד המרה בלי אף מנגנון המרה —
  האלמנט הלחיץ היחיד בו הוא "Back to the scan".
- אין מעטפת אתר: אין header, אין footer, אין `not-found`/`error`/`loading`
  בשפת העיצוב (ה־404 הוא מסך לבן של Next), אין `aria-current`, ואין שום קישור
  צולב בין עמודים. מעבר מ־War Update ל־October 7 מחייב חזרה הביתה — והאינטרו
  של ~45 שניות מתנגן מחדש בכל חזרה, ללא זיכרון session.
- הברייף מוכיח שהכול בר־ביצוע בלי backend: מודול תוכן סטטי מוקלד + רכיבי
  Status/Sources/Meta/Unknowns שכבר קיימים בתוכו וממתינים לחילוץ.
- שכבת הנתונים: `GET /api/v1/published-items` ציבורי קיים, אבל לצורת
  `PublishedItem` אין חוזה ב־`server/contracts` שה־frontend רשאי לייבא;
  אוצר המילים של הברייף הסטטי (5 סטטוסים) לא תואם את 9 ערכי ההערכה של המערכת;
  ולצ׳ט אין מצב degraded — הוא מציג "Something went wrong" בלולאה.
- ויזואלית: ה־rail הדביק מתנגש בשורות הרקע ונהיה בלתי־קריא בגלילה; כותרות
  מודלפות דרך הפאנל השקוף; אריחי הגליפים הם ריבועים שחורים בלי אלפא; בפוסטר
  ללא JS הכיתוב הדקורטיבי צועק יותר מהקישורים האמיתיים; והעמודים מסתיימים
  בחיתוך לחלל שחור בלי שום סיום או צעד הבא.

### W1 — מצבי מערכת ומעטפת ניווט

- [x] `app/not-found.tsx` בשפת העיצוב: פלטת האתר, Cinzel, קישור חזרה לסריקה
  ורשימת שמונת היעדים (`SectionPlaceholder` הרדום נמחק).
- [x] `app/error.tsx` באותה שפה; ה־guard על `corrections[0]` תוקן בברייף עצמו.
- [x] `app/loading.tsx` שמכסה את המרווח המת שבין `router.push` לרינדור העמוד.
- [x] זיכרון session לאינטרו (`loz-intro-seen`): מבקר שכבר ראה או דילג נוחת
  ישירות על הניווט, דרך מסלול ה־skip הקיים. **אימות ויזואלי סופי — רק
  ב־Chrome אמיתי במק.**
- [x] סרגל prev/next בתחתית כל עמוד דוסייה, ברוח מספור `File NN / 08`, מונע
  מ־`defaultNodes`, עם wrap-around.
- [x] רצועת כל־היעדים קומפקטית בתחתית כל עמוד + `aria-current="page"`.
- [x] סיום אמיתי לכל עמוד: prev/next, אינדקס היעדים, שורת "File closed ·
  Return to the scan", וכעת גם ה־CTA ההקשרי "Ask the Lion about this file"
  (פותח את הצ׳ט עם שאלת פתיחה ממולאת, לא נשלחת אוטומטית).
- [ ] Footer גלובלי רזה: זהות, שמונת היעדים, Methodology / Corrections /
  Contact, כניסת צ׳ט — **עדיין לא נוסף ל־`app/layout.tsx`**. הנימוק המקורי
  (לדף הבית אין תוכן מתחת לקיפול) כבר לא נכון: לבית יש עכשיו רצועת עמוד ראשון
  שנסגרת בשורת "Methodology · Corrections" משלה. המסקנה נשארה בעינה בבחירת
  המשתמש — שורת קישורים, לא footer גלובלי.
  במקום זאת: שורת קישורים "Methodology · Corrections" נוספה לפוטר של
  `SectionPage` (`components/sections/SectionPage.tsx`) ולסגירה של הברייף
  (`GeopoliticalBrief.tsx`) — שני הדפים האלה מקושרים מכל עמוד תוכן עכשיו.
  Contact ו־כניסת צ׳ט גלובלית עדיין לא נבנו במפורש כפריט כזה.
- [x] אחידות לשונית של קישורי החזרה: "Signal room" ב־`GeopoliticalBrief.tsx`
  הוחלף ל־"Back to the scan"/"Return to the scan" כמו שאר האתר.
- [x] עוגני `id` לכל `SectionBlock` (slug אוטומטי מהכותרת, תומך עברית) +
  `scroll-margin-top`.

### W2 — תיקוני שפה ויזואלית

- [x] scrim ל־rail הדביק ולכותרת הקובץ במובייל כך ששורות הרקע לא נקראות דרכם.
- [x] gradient עליון מאחורי ה־H1 של הפאנל — כיתובי רקע כבר לא נקראים דרכו.
- [x] אריחי הגליפים: ה־rail מציג כעת את מקורות ה־SVG עם גוון זהב; ה־SDF נשאר
  לדוגם ה־GPU בלבד (ראו `DECISIONS.md`).
- [x] `Monitoring · active` הוחלף ב־`Reference edition` — עיקרון
  "No false live state".
- [x] המשטח השקט על כל עמודי הדוסייה: `surface="quiet"` מופעל עכשיו על כל
  שבעת עמודי הדוסייה (7/7). עצירת תנועה ב־focus עדיין לא מומשה (פריט נפרד).
- [x] טוקני צבע גלובליים ב־`:root` — נוספו ל־`app/globals.css`
  (`--loz-ground`, ‏`--loz-gold`, ‏`--loz-blue` וכו׳); `sections.module.css`
  ו־`geopolitical-brief.module.css` מכנים אליהם עם fallback זהה לערך
  המקומי הקודם — אין שינוי ויזואלי, רק מקור אמת אחד.
- [x] rail ימני בדסקטופ — **הושלם** בכיוון העיצוב "the intelligence desk":
  מעל 1220px השוליים הימניים נושאים את המקורות של כל רשומה, בגובה הרשומה
  עצמה, והשוליים השמאליים נושאים ניווט במסמך ועומק קריאה. המקורות כבר היו
  קיימים ברמת הפריט בכל `lib/content/` — לא הומצא שום מיפוי. prop ‏`aside`
  נשאר זמין לתוכן rail ברמת העמוד (ראו `DECISIONS.md`).
- [x] header נדבק של הברייף במובייל אטום; רצועת ה־TOC קיבלה fade וגלילה.
- [x] "DESK 01 / 08" הפך ל־"Desk 01".
- [x] scrollbar/חיווי גלילה לעמודים ארוכים — `::-webkit-scrollbar { display:
  none }` הגלובלי הוחלף בסקרולבר דק מעוצב (thumb זהב שקוף); `scrollbar-width`/
  `scrollbar-color` נוספו גם ל־`sections.module.css`'s `.page`.
- [x] `ReadingProgress` מוחל גם על עמודי דוסייה, לא רק על הברייף — הרכיב עבר
  מ־`components/briefs/` ל־`components/sections/ReadingProgress.tsx` המשותף;
  `SectionPage` מקבל `data-reading-scroll` ומרנדר אותו.
- [x] מטמון `cache()` לקריאת ה־JSON של `ScanBackdrop`; פיזור `--rest`
  ב־reduced-motion תוקן לכל רוחב המסך ללא overflow.

**גיבוי במק (Chrome אמיתי) — לא לביצוע בקונטיינר:**

- [ ] איזון הפוסטר ללא JS בדסקטופ: הנמכת הכיתוב הדקורטיבי, הגדלת תוויות
  הקישורים, פתרון התנגשויות ("OCTOBER 7" על "NARRATIVE SPIKE", "INCITEMENT
  SIGNAL" נחתך למעלה).
- [ ] כוונון חפיפת שורות באינטרו: הפרדת בהירות/גודל בין השורה הפעילה לשכנותיה
  כך ששתי שורות לא יישבו באותה רצועה בבהירות כמעט שווה.
- [ ] אפייה מחדש של אייקוני ה־SDF עם אלפא תקין (`bake:nav-icons`).

### W3 — ספריית רכיבי תוכן ושכבת נתונים

- [x] ספריית `components/content/` נבנתה (עם README מדויק של כל ה־props):
  `VerificationBadge`, `SourceList`, `PublicationMeta`, `KnownUnknownPanel`,
  `CorrectionHistory`, `FigureRow`. הברייף עצמו הוגר בסבב רביעי (ראו למטה) —
  ההגירה סגורה.
- [x] רכיב `Timeline` משותף בשלושה וריאנטים: `feed`, `history`, `spread`.
- [x] primitives כרטיס: `ContentCard` ו־`ClaimRecordPair`.
- [x] רכיב `SensitiveContent` — שער אזהרת תוכן נגיש עם חשיפה מפורשת וכפתור
  הסתרה.
- [x] `publishedItemSchema` / `PublishedItemView` נוספו ל־`server/contracts/item.ts`;
  ‏`server/modules/items/repo.ts` מייבא את החוזה במקום להכריז צורה משלו
  (18/18 בדיקות items עוברות).
- [x] יישור אוצר המילים בספרייה החדשה: `VerificationBadge` ממופה בצורה
  ממצה על כל 9 ערכי `ASSESSMENT_VALUES` + `CONFIDENCE_SUMMARIES`. הברייף
  ממופה כעת גם הוא ל־`AssessmentValue` (לא ל־5 הסטטוסים הפרטיים —
  `BriefStatus` נשאר בקוד אך משמש רק כדי לתרגם את הנתונים הקיימים; מיפוי
  מלא ב־`.ai/DECISIONS.md`, כולל שני מקרי גבול: `Attributed`→`unverified`,
  `Corrected`→`verified`).
- [x] מודול תוכן סטטי מוקלד לכל עמוד — קיים כעת ל־War Update, Fake
  Resistance, October 7, Our Heroes ו־Israel's Story (5 קבצים תחת
  `lib/content/`). Support Us ו־We Are נשארו ב־JSX ישיר בכוונה — הם תוכן
  תהליך/מדיניות של האתר עצמו, לא פריטים עריכתיים שיתחלפו למקור פרסום.
- [x] seam אחד `lib/content/` — נבנה: `getWarUpdateEdition()`,
  ‏`getFakeResistanceEdition()`, ‏`getOctober7Record()`,
  ‏`getOurHeroesEdition()`, ‏`getIsraelsStoryEdition()`,
  ‏`getCorrectionsLog()`, כל אחת `async` ומחזירה מודול מקומי היום. עדיין
  לא קוראות ל־`GET /api/v1/published-items` בפועל — ל־`PublishedItemView`
  אין שדה שממפה פריט לעמוד היעד שלו, וזה חוזה שעוד לא תוכנן (ראו הערת
  הקוד בכל קובץ).

### W4 — תוכן ומבנה פר־עמוד

תקן הייחוס: מה שהברייף כבר מוכיח. תוכן חדש חייב מקורות ציבוריים אמיתיים
וסטטוס כן; מבנה שממתין לאישור (הסכמת משפחות, אימות) מסומן כ־reference בדיוק
כמו "Reference brief 001" — לא מוצג כעובדה חיה.

- [x] **War Update** — נבנה מחדש: `lib/content/war-update.ts` עם שבעה אירועים
  מתועדים ומקוריים (ספטמבר 2025–יולי 2026: תוכנית 20 הנקודות, חתימת
  הפסקת האש ב־Sharm el-Sheikh, כניסתה לתוקף, שחרור 20 החטופים תוך 72 שעות,
  אימוץ החלטה 2803 של מועצת הביטחון, הערכת "לא מלחמה ולא שלום" אחרי חצי
  שנה, וההסכם המותנה לפירוק נשק חמאס), כל אחד עם מקורות אמיתיים (NPR,
  Al Jazeera, Times of Israel, CBS News, Wikipedia, CNN — מקושרים בעמוד).
  אלה אבני דרך מנהליות/הומניטריות/דיפלומטיות מתועדות — לא טענות טקטיות
  חיות. ארבע פסקאות המדיניות עברו ל־`/methodology`; העמוד עצמו מציג רצועת
  אמון קצרה + `Timeline` (`components/content`) + `SourceList` +
  `CorrectionHistory` ריק.
- [x] **October 7** — נבנה מחדש: `lib/content/october-7.ts` עם נתונים
  אמיתיים מ־ADL (1,200+ הרוגים, 251 חטופים, 22+ יישובים+פסטיבל נובה) +
  ציר זמן מתועד של שבע אבני דרך (7.10.23 עד 26.1.26, כולל גשר ל־War
  Update). "Testimony" ו־"Remembrance" אוחדו לסעיף אחד שמקשר לשלושה
  ארכיוני עדות אמיתיים (Edut 710, USC Shoah Foundation, October7.org)
  דרך `SourceList` — **לא** משחזר עדות ו**לא** בונה פרופילי קורבנות; לאתר
  הזה אין הסכמה מאף אחד מהם. `SensitiveContent` לא הופעל בסבב הזה — אין
  כאן תוכן גרפי שדורש שער חשיפה. `register="muted"` נשמר.
- [x] **Our Heroes** — נבנה מחדש: `lib/content/our-heroes.ts` עם
  `HeroProfile[]` — שלושה אנשים אמיתיים ששמם וסיפורם כבר מכוסים בהרחבה
  בעיתונות מיינסטרים בשם מלא (Aner Elyakim Shapira — נפל, Nova; Rami
  Davidian — חקלאי שהציל כ־700 איש; אלוף (מיל.) נועם טיבון — חילץ את
  משפחת בנו מנחל עוז). מוצג ב־`ContentCard` (אין שדה תמונה בכלל — "ללא
  דיוקן כברירת מחדל" מובטח מבנית, לא כדגל לזכור), פרופיל אחד מובלט מעל
  grid של השניים הנותרים, כל אחד עם `SourceList` בפוטר הכרטיס. **אין**
  תהליך הסכמת משפחות אמיתי — זה הגבול האחראי לפרסום השלישייה הזו, לא
  רצפה. פסקת "How these stories are gathered" הישנה נכתבה מחדש כי טענה
  "nothing appears that the family has not seen and approved" — לא נכון
  לגבי הפרופילים האלה.
- [x] **Israel's Story** — נבנה מחדש, וגדל בסבב רביעי לארבעה פרקים אמיתיים
  ומצוטטים ב־`lib/content/israels-story.ts`: "The founding, 1947–1948"
  (תוכנית החלוקה → סוף המנדט → הכרזת העצמאות 14.5.1948 → פלישת
  מצרים/עבר-הירדן/עיראק/סוריה 15.5.1948), "The Six-Day War, 1967" (חסימת
  מצרי טיראן 23.5.1967 → מבצע מוקד 5.6.1967 → הפסקת אש 10.6.1967, כולל
  מקור ראשוני ממשרד החוץ הישראלי לחסימה), "Peace, when it came" (הסכם
  השלום עם מצרים, 26.3.1979), ו־"Oslo, 1993" (הכרה הדדית 9.9.1993 →
  הצהרת העקרונות 13.9.1993 — המורשת שלהם מסומנת במפורש כשנויה במחלוקת,
  לא מוכרעת בעמוד). זו עדיין מהדורה עובדת ומצומצמת — לא "הקשת הארוכה"
  המלאה; העמוד עצמו מצהיר במפורש מה עוד חסר (תקופה עתיקה, 1973, ירדן
  1994, הסכמי אברהם) כפער ידוע, לא כהשמטה שקטה. כל פרק: `Timeline`
  ‏(`variant="history"`) + `SourceList`.
- [x] **Fake Resistance** — נבנה מחדש: שלושה תיקי case אמיתיים ב־
  `lib/content/fake-resistance.ts`, כולם מאוקטובר 2023, מתועדים במקור
  ציבורי יחיד או יותר ולא נוגעים במחלוקת חיה (Arma 3 — קטעי משחק שהוצגו
  כלחימה אמיתית, מקור: Axios; סרטון פינוי בחיפה שתויג כחדירת חיזבאללה,
  מקור: Reuters Institute/BBC Verify; קטע behind-the-scenes מסרט קצר
  פלסטיני מ־2022 שתויג כתעמולת חמאס, מקור: PolitiFact). תיק שלישי חלופי
  אומת אחרי שהתיק שתואר במקור התגלה כנוגע במוות אמיתי ובטענה שנויה
  במחלוקת שהופצה על ידי גוף ממשלתי — הוחלף בכוונה (ראו `.ai/DECISIONS.md`).
  כל תיק: `ClaimRecordPair`, ‏`VerificationBadge` עם `assessment` מהאוצר
  המילים האמיתי בן 9 הערכים, ‏`SourceList`, וה־tells הרלוונטיים מתוך
  הרשימה הקיימת בעמוד.
- [x] **We Are** — נבנה מחדש: "The method" כרשימה ממוספרת של חמשת שלבי
  הצינור האמיתי (ingest → evidence → assessment עם 10 מימדי ביטחון →
  human review → publish/search) — לא תיאור כוונה, תיאור המסלול שקיים
  בפועל ב־`server/modules/*`. Grid תפקידים ללא שמות (`ContentCard`):
  Investigators, Verification reviewers, Linguists & translators,
  Engineers. עקרונות (עצמאות/מימון/פרטיות/ניגוד עניינים) כטקסט כנה על מה
  שעדיין לא פומבי. FAQ מבוסס עובדות שניתן לבדוק בקוד — למשל
  `assessment.publish` לא יכול אף פעם להיות ביד זהות אוטומטית
  (`NEVER_AUTOMATED_CAPABILITIES`).
- [x] **Support Us** — נבנה מחדש: "דווח על טענה לבדיקה"
  (`ReportClaimForm.tsx`) מחובר בפועל ל־`POST /api/v1/reports` הציבורי
  והלא-מאומת הקיים, עם ולידציה תואמת ל־`submitReportSchema` (url-או-body),
  קבלה מינימלית (`publicId`/`status`/`receivedAt`) ולא הד של מה שנשלח.
  כרטיסי skill (`ContentCard`) לשלושת תחומי המומחיות. טופס התנדבות
  (`VolunteerInterestForm.tsx`) מרכיב `mailto:` ממולא במקום להעמיד פנים
  שנשלח לשרת — אין endpoint אמיתי לקליטת מתנדבים עדיין; כתובת ה־inbox
  (`volunteers@lionsofzion.io`) היא placeholder שדורש אישור/כתובת אמיתית
  לפני production. "Sustain" נשאר טקסט — אין ערוצי תרומה מאומתים עדיין.
- [x] **Geopolitical Brief** — רצועת סגירה נוספה (desk הבא / חזרה לסריקה /
  back-to-top); הסתירה ברשומות התיקונים יושבה — ה־rail וה־footer נגזרים
  מאותם נתונים; אין יותר `corrections[0]` לא שמור.
- [ ] **עמודי יעד חדשים** — **חלקי**: `/methodology` ו־`/corrections` נבנו
  (`components/sections/DocPage.tsx` — מעטפת קלה ללא file rail, לא
  מצטרפות ל־`defaultNodes` כדי לא לשנות את מספור "File NN / 08"). עמוד
  הסכמה/הסרה למשפחות ועדים עדיין לא נבנה — נדרש אם Our Heroes ירצה
  להתרחב מעבר לשלוש הדמויות הציבוריות שכבר יש לו.

### W5 — צ׳ט: ממשק שמכבד את מה שאין

- [x] מצב degraded מפורש: הסתעפות על `error.code`; ‏INTERNAL_ERROR /
  UNAUTHENTICATED / NOT_IMPLEMENTED ⇐ מצב "desk not connected", composer
  מושבת, ללא לולאת retry; בדיקת יכולת אחת בפתיחה; ‏requestId מוצג רק
  לשגיאות לא צפויות.
- [x] שאלות מוצעות לפי עמוד — 3 chips נגזרים מ־`defaultNodes`, מוסתרים במצב
  offline.
- [x] תווית הקשרית לכל שמונת העמודים מ־`defaultNodes` ("Ask about October 7");
  הברייף שומר על הנוסח הקיים.
- [x] רינדור citations מוקלד מול `@/server/contracts/chat` — chips ממוספרים עם
  ציטוט נפתח; בטוח בהיעדרן.
- [x] auto-scroll להודעה החדשה (מכבד reduced-motion); ‏live region אחד על התור
  האחרון בלבד; חותמות זמן להודעות.
- [x] ניהול שיחה: thread חדש, העתקת תשובה, retry לתור שנכשל.
- [x] composer: auto-grow, מונה מ־9,000 תווים, ‏focus חכם לפי סוג מצביע
  (בלי מקלדת קופצת במובייל).

### W6 — מטא־דאטה, זהות והפצה

- [x] metadata פר־עמוד: `openGraph` ייחודי כעת על כל תשעת הדפים (כולל Our
  Heroes ו־We Are שנבנו מחדש הסבב הזה).
- [x] תמונת OG ‏1200×630 ב־`app/opengraph-image.tsx` (next/og, סימן הכתר).
- [x] `sitemap.ts`, ‏`robots.ts`, ‏`manifest.ts`; ‏`/particle-demo` קיבל
  `robots: { index: false }` דרך layout (הדף הוא client component).
- [x] favicon אמיתי (ICO תלת־גודל) + `icon.svg` (כתר זהב) + apple-icon;
  ‏`viewport.themeColor: #070b14` ו־`colorScheme: dark`.
- [x] ריכוז הדומיין ל־מקור אחד — `lib/site-config.ts` (`SITE_URL`), מיובא
  ב־`layout.tsx`, ‏`sitemap.ts` ו־`robots.ts` במקום שלושה `"https://lions-
  of-zion.vercel.app"` נפרדים. **עדיין פתוח**: אישור בפועל שזה הדומיין
  הקנוני לפרודקשן (לא רק ריכוז הכפילות).
- [x] ניקוי שאריות scaffold: חמשת קובצי ה־SVG נמחקו; `SectionPlaceholder.tsx`
  נמחק (ה־404 נבנה מחדש).

### סדר ביצוע לסבב

1. W1 + W2 (מעטפת ותיקונים ויזואליים) במקביל ל־W3 (רכיבים ושכבת נתונים)
   ול־W5/W6 — קבצים זרים אלה לאלה.
2. W4 (תוכן פר־עמוד) — אחרי ש־W3 מספק את הרכיבים ו־W1 את המעטפת.
3. משימות המק (פוסטר, אינטרו, אפיית אייקונים) — בנפרד, בתחנת העבודה.

## Wave — 26 August 2026: October 7 archive integration

Full brief: **[`docs/archive-integration.md`](docs/archive-integration.md)**.
Read [`.ai/DECISIONS.md`](.ai/DECISIONS.md)'s top entry first — this work
reverses the previous "link out, host nothing" boundary on `/october-7`, and
that reversal is deliberate.

Two crawled archives become ~1,180 static pages under `/october-7`. Both
packages live outside this repo and are not in git.

### A1 — Packaging ✅ complete

- [x] october7 package built and validated — 179 records, 505 language
      versions, 499 media, **29/29 checks pass**.
- [x] hamas-massacre package built from the raw archive — 335 records, 670
      language versions, 528 unique media from 1088 relations, **32/32 checks
      pass**. Pipeline at `~/Documents/october-7_toad/pkgbuild/`.
- [x] Both verified to share one contract: the story↔media relation is
      key-for-key identical and hamas block types are a strict subset of
      october7's, so **one renderer serves both**.
- [x] All 209 videos confirmed H.264/AAC faststart — no transcoding needed.
- [x] Reversal recorded in `.ai/DECISIONS.md`; superseded entry marked.

### A2 — Placement decisions ✅ settled

- [x] Radial nav stays at eight nodes; `defaultNodes` untouched. Archives are
      child routes of `/october-7`, not a ninth destination.
- [x] Content ships as JSON in the repo (~51 MB measured) behind the
      `lib/content/` seam — not through the unprovisioned backend.
- [x] Media (~1.8 GB served) goes to **Cloudflare R2** — inside its 10 GB free
      tier with free egress, so $0/month. Must be served from CDN URLs
      directly, never proxied through the Next app.

### A3 — Prerequisite ✅ fixed

- [x] **`app/loading.tsx` removed.** It wrapped every route in a Suspense
      boundary whose fallback is never replaced without JavaScript, parking the
      real markup inside `<div hidden id="S:0">`. Measured in the prerendered
      HTML of `/october-7`: the skip link sat at 6124 **inside** that wrapper,
      revealed only by a `$RC` script at 24139. After removal it renders plain
      in `<body>` at 4200, and the home route carries all eight orbit
      destinations, the poster, and zero Suspense boundaries — restoring the
      `CLAUDE.md` invariant that was silently broken. The ground colour it
      claimed to protect is painted by `globals.css` on `html, body` anyway.
      Gate: typecheck 0, 331 tests, lint unchanged, build prerenders all routes.
      **Do not reintroduce a root-level `loading.tsx`.**

### A4 — Build ✅ complete

- [x] `scripts/import-archive-package.mjs` — validates the source against its
      own manifest, copies in only what the site renders, rebuilds `records/`
      so a rename leaves no orphan. Takes october7 from 39 MB to 9.9 MB;
      both packages together are **14 MB**. Media never enters git.
- [x] `lib/content/archive.ts` plus thin `testimonies.ts` / `documentation.ts`
      faces. Package-level files are cached per process; records are not, since
      each is read by exactly one page. Record ids are validated as ids, not
      used as paths.
- [x] `components/archive/` — one renderer for both archives, no branching.
      Enforces the two presentation decisions structurally: nothing in a record
      body is a hyperlink, and credits always render.
- [x] Index and record pages on `DocPage`. Records take no rails, as settled.
- [x] Locale scheme: the bare route serves the default language and `[locale]`
      serves the rest, so no version ever has two URLs competing for one
      canonical. The `category_id: null` record routes under a literal
      `uncategorized` segment; the data still says null.
- [x] hreflang from each record's own `available_languages`, canonical, and
      `ArchiveComponent` JSON-LD carrying `isBasedOn` — which is what lets the
      prose stay free of outbound links.
- [x] 27 new tests (**358 total**); `ci-smoke` extended to 18 routes, sampling
      real record ids from the imported index so it cannot rot.
- [x] `defaultNodes` untouched; nothing here touches `components/particle-nav/`.

**Found by the build, worth knowing:** two videos have no `package_path` — the
source hosts them on YouTube and the packages record them without downloading
them. The first build crashed on it. They now render a note saying the archive
does not hold them, rather than dropping the block silently.

- [x] **Sitemap** — 527 entries, one per record with 1,103 hreflang alternates,
      rather than 1,177 pages competing with each other. `sitemap.ts` is async
      now, which is safe: it is prerendered and not in a suspending path.
- [x] **`scripts/verify-archive-assets.mjs`** — proves the CDN is populated.
      Nothing else can: media is not in git, so a wrong
      `NEXT_PUBLIC_ARCHIVE_CDN` fails quietly — pages build, tests pass, text
      renders, only the media 404s. Verified locally: 2,018 checked, 0
      unreachable.
- [x] **Both real-Chrome gates run and pass.** `verify:graphics` 7/7 viewports
      with every number unchanged (the scene did not move); `final-verify`
      clean including **no-JavaScript: 8 links, poster visible**.
- [x] Docs squared: `CLAUDE.md`, `docs/architecture.md`,
      `docs/environment.md`, `docs/operations.md`, `README.md`.

### A7 — The CDN ✅ provisioned

- [x] **Provision the CDN and upload the media.** Done on Vercel Blob rather
      than the costed R2 recommendation: store `lions-of-zion-archive`
      (`store_M70Ph8nWOJVAnaRn`), 1.94 GB across 2,018 objects, connected to
      the project. `NEXT_PUBLIC_ARCHIVE_CDN` is set on Preview and Production
      to `https://m70ph8nwojvanarn.public.blob.vercel-storage.com`.
      Verified 2026-08-26 against the live bucket: 2,018 checked, 0
      unreachable; live record pages emit blob URLs with no `/archive`
      fallback in the HTML.
      **`NEXT_PUBLIC_` is substituted at build time**, so changing the value
      later requires a redeploy, not just an env edit.

### A5 — Presentation ✅ settled

Full reasoning in `.ai/DECISIONS.md`, "The archive presents clean but keeps its
provenance". These are now constraints on A4, not choices.

- [x] **No outbound links in a record body.** Credits render as plain text, not
      hyperlinks, at `--t-data`. `source_url` goes to metadata and JSON-LD.
      `/methodology` replaces per-record link lists.
- [x] **Provenance is kept.** Rewording to escape attribution was considered
      and rejected. Only 3 of 528 (hamas) and 3 of 499 (october7) media items
      carry a named credit — there was no clutter to remove.
- [x] **Canonical points here**, with expectations set: the record pages will
      earn little search traffic either way. Traffic comes from the editorial
      layer, the cross-archive search, and Hebrew.
- [x] **Documentation records take no rails** — 3 blocks, 1 heading each.
      `DocPage` as-is. A right-margin variant for long testimonies is a later
      prop on the same shell, and must fix `--content-w`.
- [x] Rewrote `/october-7`'s testimony section — it claimed the site hosts no
      testimony, which this work made false. It now opens the two archives with
      counts read from their manifests (so a re-import cannot leave the page
      quoting a stale number). Edut 710 and USC Shoah stay, reframed as what
      they actually are: recorded-interview collections neither package holds.
      October7.org left the outbound list — its records are here now, so
      pointing readers elsewhere to read them would read as an editing mistake;
      its attribution sits on every record's provenance note instead.

### A6 — Later, deliberately

- [ ] Backend path: `database/schema.sql` → Neon, stories as items, media as
      evidence, written through `recordVersion()`. Blocked on Phase 8 auth.
- [ ] Refresh loop: crawl → pkgbuild → validate → import. Ids are contracts, so
      imports upsert and nothing is overwritten.

