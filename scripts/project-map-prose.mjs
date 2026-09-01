/**
 * Hebrew educational catalog for the project map.
 *
 * Exact entries (AREAS, FILES) are authored. Everything else is matched by
 * pattern so a new file still gets a real explanation rather than vanishing
 * or rendering as "לא מתועד".
 */
export const LAYERS = {
  frontend: "פרונטאנד",
  backend: "בקאנד",
  content: "תוכן",
  data: "נתונים",
  tests: "בדיקות",
  docs: "תיעוד",
  deploy: "תשתית",
  local: "מקומי",
  bridge: "גשר",
  archive: "ארכיון",
  stale: "מיושן",
};

export const SOT = new Set([
  "server/contracts", "server/core", "server/db", "content-packages",
  "docs", ".ai", "assets", ".github", "components/intro-scene", "components/intro",
]);

/** @type {Record<string, {layer: string, role: string, lesson: string, sot?: boolean}>} */
export const AREAS = {
  "app": {
    layer: "frontend",
    role: "כל מסלולי האתר — שם התיקייה הוא הכתובת",
    lesson: "ב־Next.js App Router כל תיקייה תחת app/ היא URL חי. app/page.tsx הוא /, app/we-are/page.tsx הוא /we-are. לכן שינוי שם כאן משנה כתובת באתר, לא רק מבנה קבצים. כאן גם יושבים layout.tsx (מעטפת לכל דף), globals.css (טיפוס וצבע של כל משטח הקריאה), ו־sitemap/robots.",
  },
  "app/api": {
    layer: "backend",
    role: "מטפלי ה־API — דלת הכניסה לכל בקשה",
    lesson: "כל קובץ route.ts מפרסר את הבקשה, קורא למודול אחד דרך index.ts שלו, ומחזיר JSON. אסור לו לייבא את מסד הנתונים או את service/repo ישירות — eslint יכשיל. לפני שהקובץ הזה רץ, handler.ts כבר סיווג את הבקשה והחליף תפקיד במסד.",
  },
  "app/admin": {
    layer: "frontend",
    role: "לוח בקרה תפעולי בעברית",
    lesson: "דשבורד מאחורי Neon Auth. קורא את GET /api/v1/admin/status. זה לא חלק מהאתר הציבורי — זה כלי של בעל האתר. /admin חסום למי שאינו החשבון היחיד.",
  },
  "app/auth": {
    layer: "frontend",
    role: "כניסת X הציבורית",
    lesson: "שלושה מסלולים: begin, callback, signout. יש להם carve-out מתועד ב־eslint כדי לייבא מ־server/modules/public-x-auth. זה משטח זהות ציבורי במאגר ציבורי — לא כלי פיתוח מוסתר.",
  },
  "app/account": {
    layer: "frontend",
    role: "חשבון המבקר אחרי כניסת X",
    lesson: "דף החשבון של מי שנכנס דרך X. לא אחד משמונת היעדים ולא חלק מלוח הניהול.",
  },
  "app/october-7": {
    layer: "frontend",
    role: "מרכז 7 באוקטובר — לא יעד תשיעי",
    lesson: "היעד עצמו הוא המרכז. מתחתיו ~1,177 דפים מוכנים מראש (עדויות ותיעוד) שנגזרים מהאינדקסים. SITE_NAVIGATION נשאר שמונה — הארכיונים אינם יעד חדש. רנדרר אחד מגיש את שני הארכיונים בלי הסתעפות.",
  },
  "app/fake-resistance": {
    layer: "frontend",
    role: "מרכז התנגדות מזויפת",
    lesson: "היעד עצמו הוא המרכז. מתחתיו מחברת הטכניקות, גרף הרשת, ושבעה תיקי מקרה. שער הפרסום הוא EDITORIAL_STAGE. הציונים לעולם לא משודרגים לתג אימות — הם תוויות במכוון.",
  },
  "app/geopolitical-brief": {
    layer: "frontend",
    role: "התדריך הגאופוליטי",
    lesson: "היעד היחיד עם פריסה משלו במקום מעטפת התיקים. התוכן עדיין חתך ייחוס סטטי, מותאם דרך adapters.ts אל רכיבי content/.",
  },
  "app/israels-story": {
    layer: "frontend",
    role: "הסיפור הישראלי",
    lesson: "תיק קריאה על מעטפת SectionPage. התוכן מגיע מ־lib/content/israels-story.ts.",
  },
  "app/war-update": {
    layer: "frontend",
    role: "עדכון הלחימה",
    lesson: "תיק קריאה שמפצל רכיב לקוח (WireFeed) לסינון ולקישורים קבועים. התוכן מ־lib/content/war-update.ts.",
  },
  "app/we-are": {
    layer: "frontend",
    role: "מי אנחנו",
    lesson: "תיק קריאה על מעטפת SectionPage. דף הזהות של האתר.",
  },
  "app/our-heroes": {
    layer: "frontend",
    role: "הגיבורים",
    lesson: "תיק קריאה. הדף היחיד שבו כרטיסים בגריד מוותרים על שולי הראיות — כרטיס רב־עמודה לא יכול לשאת ציטוט לידו בלי לדרוס את השכן.",
  },
  "app/support-us": {
    layer: "frontend",
    role: "תמיכה בנו",
    lesson: "מחזיקה את הטפסים האינטראקטיביים (דיווח, התנדבות, תרומת PayPal). שולחים למסלולי API ציבוריים חיים.",
  },
  "app/corrections": {
    layer: "frontend",
    role: "יומן תיקונים",
    lesson: "מוגש מתפר שמחזיר רשימה ריקה. ריק כן — לא placeholder. כשתיקון יתווסף ל־lib/content/corrections.ts הוא יופיע כאן בלי לגעת בדף.",
  },
  "app/methodology": {
    layer: "frontend",
    role: "המתודולוגיה",
    lesson: "דף מדיניות על מעטפת DocPage — איך האתר בודק, מה הוא לא עושה, ואיפה הגבול בין עובדה לפרשנות.",
  },
  "app/articles": {
    layer: "frontend",
    role: "מאמרים מפורסמים מה־API",
    lesson: "דף דינמי לפי publicId. בניגוד לתיקים הסטטיים, כאן התוכן מגיע מפרסום חי במודל המידע — לא מחבילת JSON. לא יעד תשיעי.",
  },
  "app/information-war": {
    layer: "frontend",
    role: "משטח מלחמת המידע",
    lesson: "דף קריאה נוסף מחוץ לשמונת היעדים. לא מרחיב את SITE_NAVIGATION.",
  },
  "components": {
    layer: "frontend",
    role: "תיקיות פיצ'ר — הרכיבים לפי משטח",
    lesson: "כל תיקייה כאן היא פיצ'ר, לא סוג רכיב. intro-scene היא הסצנה, content הם אבני הבניין העריכותיים, sections הן המעטפות. רכיב שמשמש מסלול אחד יכול לשבת ליד הדף או כאן — המאגר עושה את שניהם.",
  },
  "components/intro-scene": {
    layer: "frontend", sot: true,
    role: "הרנדרר החי היחיד ושעון ציר הזמן היחיד",
    lesson: "קנבס אחד לאינטרו. Scene.tsx מחזיק שעון אחד; הפריים המשתף מניע אריה, טקסט TSL ומסירה מדורגת בלי React state לכל פריים. אין סצנת כוכבים ואין רקע רסטר — כל סימן נראה הוא גאומטריית חלקיקים. הסצנה היא שכבת כניסה בלבד ומתפרקת במסירה.",
  },
  "components/content": {
    layer: "frontend",
    role: "אבני הבניין העריכותיים ושולי הראיות",
    lesson: "בלוקים משותפים לכל משטחי הקריאה: ציטוט, ציר זמן, תג אימות, רשימת מקורות. marginNote ב־content.module.css הוא גריד דו־מסלולי — ציטוט גבוה מאריך את השורה שלו במקום לדרוס את הבאה. כרטיס בגריד רב־עמודה מוותר על השוליים האלה.",
  },
  "components/sections": {
    layer: "frontend",
    role: "שתי מעטפות הקריאה",
    lesson: "SectionPage לתיקים (שבעה יעדים): פס זהות לרוחב ומידת קריאה 68ch. DocPage לארכיון ולמדיניות. אין כותרת תחתונה — הדף נגמר איפה שהתוכן נגמר. מעל 1220px נכנסים TOC משמאל ושולי ראיות מימין.",
  },
  "components/archive": {
    layer: "frontend",
    role: "רנדרר אחד לשני הארכיונים",
    lesson: "בלי הסתעפות לפי סוג ארכיון: סוגי הבלוקים של האחד הם תת־קבוצה של השני, והבדיקות מצהירות על זה. שום דבר בגוף רשומה אינו קישור; קרדיטים תמיד מוצגים. מקור האמת של הרשומה הוא החבילה, לא הרכיב.",
  },
  "components/intro": {
    layer: "frontend", sot: true,
    role: "נתוני ציר הזמן — בלי רינדור",
    lesson: "העתק ותזמון בלבד, ודגימת ענן הטקסט ב־CPU. Scene.tsx הוא שמרנדר. STORY_PARAGRAPHS מניחים בדיוק 12 פעימות. מערכי דסקטופ ומובייל חייבים להתחבר חזרה לטקסט הקנוני. hook אחרי כל עריכה בודק את זה.",
  },
  "components/briefs": {
    layer: "frontend",
    role: "התדריך הגאופוליטי — הפריסה הייחודית",
    lesson: "הדף היחיד עם פריסה וטיפול התקדמות־קריאה משלו. התוכן עדיין חתך ייחוס ב־geopolitical-reference.ts, מותאם דרך adapters.ts אל רכיבי content/.",
  },
  "components/support": {
    layer: "frontend",
    role: "טפסי תמיכה, דיווח ותרומה",
    lesson: "הרכיבים האינטראקטיביים היחידים באתר הציבורי ששולחים ל־API. דיווח ציבורי, התנדבות, כפתור PayPal ושיתוף מאומת.",
  },
  "components/graphics": {
    layer: "stale",
    role: "חוזה לסצנה הצילומית שפרשה",
    lesson: "נשאר כי בדיקה אחת עדיין מייבאת אותו. לא משטח חי. אל תבנו עליו סצנה חדשה.",
  },
  "components/auth": {
    layer: "frontend",
    role: "בקרת הכניסה הציבורית ב־DOM",
    lesson: "רכיב הכניסה של מבקר (לא אדמין). יושב ליד הצ'אט. לא לבלבל עם app/admin.",
  },
  "lib": {
    layer: "content",
    role: "תפר התוכן של הפרונטאנד",
    lesson: "סטטי היום, בנוי כך שמעבר לשאילתת תוכן אמיתית ישנה גופי פונקציות ולא אתרי קריאה. מוחזק לאותו גבול ייבוא כמו app/ ו־components/.",
  },
  "lib/content": {
    layer: "content",
    role: "מודול לכל משטח קריאה",
    lesson: "כולם אסינכרוניים חוץ מ־home.ts. זה היה הכרחי כש־loading.tsx בשורש הסתיר כל await בלי JavaScript. הקובץ ההוא נמחק, והייצוא הסינכרוני נשאר כי אין סיבה לשנות אותו — לא כי await ישבור עכשיו את המסלול.",
  },
  "server": {
    layer: "backend",
    role: "API של מודל המידע",
    lesson: "לעולם לא מייבא את הפרונטאנד. מקורות נקלטים, ראיות נקשרות לפריטים, הערכות נסקרות בידי אדם שני, ופריטים מפורסמים ניתנים לחיפוש. Neon, Blob ו־AI Gateway מחוברים ב־Production.",
  },
  "server/db": {
    layer: "data", sot: true,
    role: "סכימה, מיגרציות ומעבדת הבדיקות",
    lesson: "חוקים עסקיים חיים ב־triggers לא פחות מב־TypeScript: מעברי סטטוס, טבלאות append-only, ושער הפרסום. שינוי כלל בדרך כלל אומר מיגרציה ממוספרת חדשה. client.ts מייצא רק את דרייבר ה־WebSocket — neon-http לא מחזיק טרנזקציה אינטראקטיבית.",
  },
  "server/modules": {
    layer: "backend",
    role: "עשרה מודולי נתונים באותה צורה",
    lesson: "index.ts קושר db() ומחזיר service; service הוא זרימת העבודה; repo הוא השאילתות; לפעמים rules.ts — מדיניות טהורה בלי מסד. המסלול רשאי לייבא רק את index.ts. public-x-auth הוא החריג המכוון: חזית בלי service ובלי מסד.",
  },
  "server/core": {
    layer: "backend", sot: true,
    role: "תשתית רוחבית של ה־API",
    lesson: "config.ts הוא הקובץ היחיד בזמן ריצה שקורא process.env. recordVersion() הוא נתיב הכתיבה היחיד לישות עם גרסאות. emit() של outbox נכתב בתוך הטרנזקציה שגרמה לו — פרסום לתור אחרי commit אינו אטומי ולא נעשה כאן.",
  },
  "server/contracts": {
    layer: "bridge", sot: true,
    role: "הדלת היחידה בין הפרונטאנד ל־server/",
    lesson: "zod ותו לא — בלי drizzle, בלי next, בלי server-only. לכן אפשר לייבא מכאן גם מ־RSC וגם מבדיקה בלי מסד. eslint אוכף: app/ ו־components/ רשאים לייבא רק את השכבה הזו מתוך server/.",
  },
  "server/http": {
    layer: "backend",
    role: "כל בקשה עוברת כאן לפני המסלול",
    lesson: "handler() עוטף כל מסלול: מזהה בקשה, סיווג תפקיד, SET ROLE + RLS, ותרגום שגיאות ל־problem+json. accessFor() היא נקודת ההכרעה היחידה. גוף המסלול לא מחליט על הרשאות.",
  },
  "server/jobs": {
    layer: "backend",
    role: "צרכני התור",
    lesson: "לא ניגשים למסד ישירות. drainOutbox והמסלולים תחת app/api/internal/ מגישים את מה ש־emit() כתב בתוך הטרנזקציה.",
  },
  "content-packages": {
    layer: "content", sot: true,
    role: "נתוני מקור מחויבים לגיט — לא פלט",
    lesson: "כ־14MB JSON מחויבים; כ־1.8GB מדיה לעולם לא. נכסים נפתרים לפי media_id, ולכן רק קידומת ה־CDN משתנה. רשומה חדשה נכנסת לאתר בלי לגעת בקוד, כי האינדקס מייצר את המסלולים. המאגר ציבורי: push כבר מפרסם את הטקסט.",
  },
  "content-packages/october7": {
    layer: "content",
    role: "עדויות october7.org",
    lesson: "האינדקס מייצר את המסלולים, לא רשימה ידנית. כל רשומה מתפרשת לגרסאות שפה. אפס חפיפת מזהים עם ארכיון התיעוד.",
  },
  "content-packages/hamas-massacre": {
    layer: "content",
    role: "תיעוד hamas-massacre.net",
    lesson: "אותו רנדרר כמו עדויות october7, כי סוגי הבלוקים כאן הם תת־קבוצה. אפס חפיפת מזהים עם הארכיון השני — זה נבדק.",
  },
  "content-packages/fake-resistance": {
    layer: "content",
    role: "תיקי המחקר",
    lesson: "שבעה תיקים + אינדקס + גרף רשת. שום משיכת ראיות גולמית לא נכנסה לגיט. הייבוא לוקח publication_wording ולעולם לא את שדה analysis הפנימי. שיפוט עריכתי חי ב־lib/content/fake-resistance-editorial.ts כדי שייבוא מחדש לא ימחק אותו.",
  },
  "docs": {
    layer: "docs", sot: true,
    role: "תיעוד עזר שנכתב כדי להיות נכון",
    lesson: "לא שאפתני. architecture, api, data-model, environment, operations. מספר שמופיע בשני מסמכים ייסחף — מונים שייכים למסמך אחד והשאר מקשרים.",
  },
  "docs/archive": {
    layer: "archive",
    role: "מסמכים שעשו את שלהם",
    lesson: "שום דבר כאן אינו מקור אמת. לפני שמעבירים מסמך לכאן מרימים ממנו כל דבר ייחודי שעוד נכון.",
  },
  "tests": {
    layer: "tests",
    role: "vitest מול פוסטגרס אמיתי ב־WASM",
    lesson: "PGlite, ממוגרר מחדש לכל בדיקה, כך שטריגרים ואילוצים מתנהגים כמו ב־Neon. אין pgvector מקומית — בדיקות חיפוש סמנטי מדלגות בלי TEST_DATABASE_URL. החיפוש המילוני מכוסה במלואו.",
  },
  "scripts": {
    layer: "tests",
    role: "אימות, ייבוא ואפייה",
    lesson: "חמישה סקריפטים נועלים נתיב Chrome מוחלט ורצים רק על תחנת macOS. ci-smoke הוא מה ש־CI מריץ. אפיית החלקיקים דטרמיניסטית: אותו זרע — אותם בתים.",
  },
  "public": {
    layer: "data",
    role: "פלט אפוי וקורפוס שנטענים לפי נתיב מילולי",
    lesson: "שינוי שם שובר בשקט בזמן ריצה, בלי כשל ב־build. חוצצי האריה והפוסטרים מחויבים במכוון — הם הארטיפקטים שנשלחים. public/archive/ היא סימלינק לפיתוח ולא נכנסת לגיט.",
  },
  "public/particles": {
    layer: "data",
    role: "חוצצי LNP1 של האריה",
    lesson: "שלוש רמות ביצועים: 45k, 90k, 180k. הסצנה בוחרת לפי מדד. נטענים לפי נתיב מילולי מתוך Scene.",
  },
  "public/posters": {
    layer: "data",
    role: "הפוסטר לשכבת בלי־WebGL, וכרטיס OG",
    lesson: "דטרמיניסטי. אותם קישורים אמיתיים יושבים מעל הפוסטר — אין סט שני של קישורי נפילה. זה למה האינדקס הסטטי למובייל נמחק במקום להישמר.",
  },
  "public/assets": {
    layer: "data",
    role: "הגופן של Three.js",
    lesson: "gentilis_regular.typeface.json. שני הצרכנים היחידים הם האינטרו ובדיקה אחת. נתיב מילולי.",
  },
  "public/matrix": {
    layer: "data",
    role: "קורפוס הסריקה של הסצנה",
    lesson: "תוכן עריכתי שנכתב ביד ויושב ב־public/. הסצנה דוגמת ממנו את סימני הרשת. זה לא פלט אפוי.",
  },
  "assets": {
    layer: "data", sot: true,
    role: "מקורות האפייה — וגם ייבוא בזמן ריצה",
    lesson: "לכן זה נשלח, לא רק חומר גלם מקומי. תמונת הייחוס של האריה. שינוי כאן דורש אפייה מחדש (bake:nav-lion) ואז commit של הפלט ב־public/particles/.",
  },
  "assets/reference": {
    layer: "data",
    role: "תמונת הייחוס לאפיית האריה",
    lesson: "גם מקור אפייה וגם ייבוא בזמן ריצה, ולכן נשלחת עם האתר.",
  },
  "assets/source": {
    layer: "data",
    role: "אייקוני המקור של שמונת היעדים",
    lesson: "גם מקור אפייה ל־SDF וגם ייבוא של רכיבי React. צורה אחת, שני צרכנים.",
  },
  "assets/marketing": {
    layer: "data",
    role: "נכסי שיווק ותרומה",
    lesson: "אייקוני הסכמה וגלריית תרומת PayPal. לא נכנסים לסצנת האינטרו; נצרכים ממשטחי תמיכה ומזהות האפליקציה.",
  },
  "scripts/intro-scene": {
    layer: "tests",
    role: "האפייה הדטרמיניסטית",
    lesson: "חוצצי האריה. אותו זרע — אותם בתים. אם הפלט ב־public/particles/ השתנה בלי שינוי כאן, מישהו אפה מכונה אחרת או שינה זרע.",
  },
  ".ai": {
    layer: "docs", sot: true,
    role: "יומן הפרויקט לכל הסוכנים",
    lesson: "DECISIONS הוא append-only — לעולם לא עורכים רשומה ישנה. STATE נכתב מחדש במקומו. DESIGN-V2 הוא חוזה הטיפוס של משטחי הקריאה. אלה תיאור של המערכת, לא וטו על הוראת הבעלים.",
  },
  ".claude": {
    layer: "local",
    role: "סוכנים, hooks ומיומנויות",
    lesson: "מוחרג מה־deploy. מיומנות design-director חלה על כל שינוי נראות. hook אחרי עריכת ציר הזמן מריץ גם tsc.",
  },
  ".claude/hooks": {
    layer: "local",
    role: "כלי עזר מקומיים",
    lesson: "חלקם רצים אחרי עריכה (ציר הזמן), חלקם לא מופעלים אוטומטית. לא חלק מהאתר החי.",
  },
  ".claude/skills": {
    layer: "local",
    role: "מיומנויות אופציונליות למפעיל",
    lesson: "design-director, verify-intro, sync. נקראות כשהמשימה מתאימה, לא בכל סיבוב.",
  },
  ".design-sync": {
    layer: "local",
    role: "צינור ייצוא מערכת העיצוב",
    lesson: "מונע מכלי חיצוני — אין npm script ואין שלב CI שמריץ אותו. ה־previews מייבאים את שם החבילה הבנויה, לא את המקור המקומי, ולכן שום דבר במאגר לא מייבא אותם.",
  },
  ".design-sync/previews": {
    layer: "local",
    role: "דוגמאות שימוש לחבילת העיצוב",
    lesson: "הכלי החיצוני מוצא אותן לפי מוסכמת ספרייה. לא חלק מגרף הייבוא של האתר.",
  },
  ".design-sync/shims": {
    layer: "local",
    role: "מתאמים לבנייה מחוץ ל־Next",
    lesson: "מאפשרים לרכיבים להיבנות בלי runtime של Next (Image, Link, navigation).",
  },
  ".github": {
    layer: "deploy", sot: true,
    role: "ה־CI היחיד",
    lesson: "שער (typecheck, lint, test, build, map:check) ואז עשן מסלולים עם Chromium מובנה. הפריסה ל־production היא פעולת Vercel ידנית נפרדת — push מפרסם מקור, deploy מפרסם אתר.",
  },
  ".github/workflows": {
    layer: "deploy",
    role: "הגדרת ה־CI",
    lesson: "קובץ אחד. אם נוסף מסלול מדור חדש, ci-smoke בודק אותו רק אם מישהו זכר להוסיף אותו לרשימה — 15 המסלולים ידניים, הארכיון נגזר.",
  },
};

/** @type {Record<string, {layer: string, role: string, lesson: string, sot?: boolean, related?: string[]}>} */
export const FILES = {
  "CLAUDE.md": {
    layer: "docs", sot: true,
    role: "תיעוד היישום — מה אסור לשבור",
    lesson: "הבריף שעורך צריך לקרוא לפני שהוא נוגע בסצנה, בארכיון או ב־API. הוראת הבעלים גוברת על כל כלל היסטורי שבו. המסמך מתאר את המערכת; הוא לא מאשר לסוכן לסרב לבקשת בעלים.",
    related: ["AGENTS.md", ".ai/DECISIONS.md"],
  },
  "AGENTS.md": {
    layer: "docs", sot: true,
    role: "סמכות הבעלים היחיד, ואזהרת Next.js",
    lesson: "בלוק Next.js מנוהל שנשמר ללא שינוי — next dev יכתוב אותו מחדש אם יימחק. מעליו: המפתח היחיד הוא הבעלים, והוראתו גוברת על כל מסמך במאגר.",
  },
  "README.md": {
    layer: "docs",
    role: "דלת הכניסה למאגר",
    lesson: "מה זה, איך מתקינים, איפה כל תחום. נכתב לאדם שמגיע מגיטאהב, לא לסוכן.",
  },
  "TODOS.md": {
    layer: "docs", sot: true,
    role: "תוכנית האספקה בעברית",
    lesson: "המקום לבדוק בו מה נחשב לא גמור. לא רשימת משימות של סוכן — תוכנית של הבעלים.",
  },
  "TODOS-review.md": {
    layer: "docs",
    role: "סריקת ביקורת של תוכנית האספקה",
    lesson: "מסמך עזר לסקירה. לא מחליף את TODOS.md ולא את DECISIONS.",
  },
  "PROJECT_STRUCTURE_AUDIT.md": {
    layer: "docs", sot: true,
    role: "ביקורת המבנה עם הוכחה",
    lesson: "כל אזור מסווג, עם מה שנמצא ומה שהושאר להחלטת הבעלים. נכתב כבדיקה חד־פעמית; המפה החיה היא docs/project-map.html.",
  },
  "package.json": {
    layer: "deploy", sot: true,
    role: "התלויות והסקריפטים",
    lesson: "npm run map בונה את המפה הזו. verify:full הוא השער המלא. אף סקריפט כאן אינו מת — אם נוסף סקריפט שלא רץ משום מקום, זו סחיפה.",
  },
  "package-lock.json": {
    layer: "deploy",
    role: "נעילת גרסאות",
    lesson: "מה שהותקן בפועל. CI והמכונה המקומית צריכים לאותו עץ. אפס סחיפה מול package.json היא מצב תקין, לא מותרות.",
  },
  "tsconfig.json": {
    layer: "deploy",
    role: "הגדרות TypeScript",
    lesson: "מחריג תיקיות אוטומטיות כדי ש־typecheck מקומי יתאים ל־CI. שינוי include/exclude כאן משנה מה נחשב לשגיאה.",
  },
  "eslint.config.mjs": {
    layer: "deploy", sot: true,
    role: "הארכיטקטורה מנוסחת כשגיאות lint",
    lesson: "מי רשאי לייבא את מי. app/ ו־components/ → רק server/contracts. app/api/ לא נוגע ב־db ולא ב־service/repo. חוזים = zod בלבד. לקרוא לפני העברת קוד בין שכבות. carve-out יחיד: app/auth/**.",
    related: ["server/contracts", "server/http/handler.ts"],
  },
  "next.config.ts": {
    layer: "deploy",
    role: "הגדרות Next",
    lesson: "כותרות מטמון קבועות ל־/particles/ בלבד — קבצים דטרמיניסטיים שמשקלם כבד. אל תוסיפו כאן מטמון גורף לדפי תוכן.",
  },
  "vercel.json": {
    layer: "deploy", sot: true,
    role: "תור אחד וארבעה לוחות cron",
    lesson: "כל החמישה מגיעים למטפלים אמיתיים תחת app/api/internal/. הפריסה עצמה ידנית; הקובץ הזה מגדיר מה רץ אחרי שהאתר כבר באוויר.",
  },
  "vitest.config.ts": {
    layer: "tests",
    role: "הגדרות הבדיקות",
    lesson: "ממפה את server-only למודול ריק במקום לתת לבדיקות להשמיט את הייבוא. סביבת node, מול freshDatabase().",
  },
  "drizzle.config.ts": {
    layer: "data",
    role: "מכוון את drizzle-kit",
    lesson: "סכימה ומיגרציות מול DATABASE_URL אמיתי. הבדיקות לא צריכות אותו — הן רצות על PGlite.",
  },
  "proxy.ts": {
    layer: "deploy",
    role: "www אל apex, ו־Neon Auth על /admin",
    lesson: "הפניה 308 מ־www לאליאס הראשי, ושמירת סשן האדמין. זה לא middleware עסקי.",
  },
  ".gitignore": {
    layer: "deploy",
    role: "מה לא נכנס לגיט",
    lesson: ".env* נתפס כאן — לכן .env.example אינו במעקב. .claude/worktrees, .next, node_modules, סימלינקים של ארכיון.",
  },
  ".vercelignore": {
    layer: "deploy",
    role: "מה לא נשלח בפריסה",
    lesson: "חשוב במיוחד כאן: הפריסה ידנית, ולכן זה הסינון היחיד בין המאגר לבין מה ש־Vercel מקבל. כלי סוכנים ותיעוד פנימי לא צריכים לעלות.",
  },
  ".mcp.json": {
    layer: "local",
    role: "רישום שרתי MCP",
    lesson: "לכלי פיתוח מקומיים בלבד. לא נטען באתר החי.",
  },
  "app/page.tsx": {
    layer: "frontend",
    role: "דף הבית — מה שנשלח בכתובת /",
    lesson: "מרנדר את עמוד המודיעין העריכתי בתוך CinematicIntroGate. האינטרו הוא שכבת כניסה חד־פעמית שמתפרקת במסירה; בלי JavaScript הוא מוסתר והעמוד נשאר מלא ושמיש.",
    related: ["components/intro-scene/CinematicIntroGate.tsx", "app/layout.tsx", "lib/site-navigation.ts"],
  },
  "app/layout.tsx": {
    layer: "frontend",
    role: "מעטפת כל דף באתר",
    lesson: "ארבעה גופנים ומטא־דאטה משותף. כל מסלול עובר כאן. אל תחזירו לכאן loading.tsx — קובץ כזה בשורש עוטף כל מסלול ב־Suspense, ובלי JavaScript הדף לעולם לא מופיע.",
    related: ["app/globals.css"],
  },
  "app/globals.css": {
    layer: "frontend",
    role: "טוקני הטיפוס והצבע של כל משטח קריאה",
    lesson: "שלושה פרצופים (Newsreader, IBM Plex Sans, Geist Mono), שבעה גדלים, שישה צבעים. Cinzel שייך לסצנת הבית בלבד — החזרתו לדף קריאה הופכת החלטה מתועדת. לקרוא DESIGN-V2 לפני נגיעה.",
    related: [".ai/DESIGN-V2.md"],
  },
  "app/sitemap.ts": {
    layer: "frontend",
    role: "מפת האתר — נגזרת, לא ידנית",
    lesson: "הכתובות הציבוריות נגזרות מ־SITE_NAVIGATION ומהאינדקסים של החבילות. רשומה חדשה נכנסת לכאן בלי לשכפל ניווט.",
  },
  "app/robots.ts": {
    layer: "frontend",
    role: "מה זחלנים רשאים לסרוק",
    lesson: "חוסם /api/, /admin ו־/auth. כל השאר פתוח לסריקה, וה־sitemap מוצהר כאן.",
  },
  "app/error.tsx": {
    layer: "frontend",
    role: "גבול שגיאה ברמת האפליקציה",
    lesson: "מה שהמבקר רואה כשמסלול נכשל בזמן ריצה. לא דף 404.",
  },
  "app/not-found.tsx": {
    layer: "frontend",
    role: "דף 404",
    lesson: "כתובת שלא קיימת. נשאר במערכת הטיפוס של משטחי הקריאה, לא בסצנת החלקיקים.",
  },
  "app/manifest.ts": {
    layer: "frontend",
    role: "מניפסט PWA",
    lesson: "שם, צבעים, אייקון. זה מה שהמכשיר מציג כששומרים את האתר למסך הבית.",
  },
  "app/opengraph-image.tsx": {
    layer: "frontend",
    role: "תמונת השיתוף של האתר",
    lesson: "מה שמופיע כשמדביקים קישור ב־X או בוואטסאפ. לא הפוסטר של הסצנה — זה כרטיס OG.",
  },
  "components/intro-scene/Scene.tsx": {
    layer: "frontend", sot: true,
    role: "הרנדרר החי היחיד ושעון ציר הזמן היחיד",
    lesson: "אל תרכבו קנבס שני לאינטרו. האריה הוא אפייה אחת (lion-v2-*.bin) בשלוש רמות ביצועים. העתק האינטרו נדגם ב־CPU ואז מונפש בחומרי TSL — בלי GLSL גולמי ובלי ShaderMaterial בזמן ריצה.",
    related: ["components/intro/story-timeline.ts", "app/page.tsx"],
  },
  "lib/site-navigation.ts": {
    layer: "frontend", sot: true,
    role: "חוזה שמונת היעדים",
    lesson: "SITE_NAVIGATION הוא מקור האמת היחיד לשמונת היעדים — מזהה, תווית, שם תצוגה, כתובת, תיאור, סמל וגוון. נקרא מ־SiteHeader, sitemap, דף 404 ו־SectionPage. label נשמר באותיות גדולות כזהות; משטחי קריאה משתמשים ב־displayName.",
  },
  "server/http/handler.ts": {
    layer: "backend", sot: true,
    role: "כל בקשת API עוברת כאן",
    lesson: "מסווג, מחליף תפקיד במסד, מתרגם שגיאות. PUBLIC_V1 נסרק מהקוד — כל השאר נכשל סגור דרך authenticateAdmin. withDatabaseRole לוקח חיבור מהבריכה, SET ROLE, set_config('app.identity'), ובשחרור RESET ALL.",
    related: ["server/http/internal-guard.ts", "server/http/responses.ts"],
  },
  "server/core/config.ts": {
    layer: "backend", sot: true,
    role: "קורא process.env היחיד בזמן ריצה",
    lesson: "שלושה אחרים קוראים env, אף אחד מהם לא runtime: drizzle.config.ts, server/db/testing.ts, ובדיקת NODE_ENV ב־viewport.ts. משתנה חדש נכנס לכאן, לא מפוזר ב־service.",
  },
  "server/core/versioning.ts": {
    layer: "backend", sot: true,
    role: "נתיב הכתיבה היחיד לישות עם גרסאות",
    lesson: "recordVersion() בטרנזקציה אחת: עדכון שורה, שורת גרסה, מצביע ראש, שובל ביקורת ופליטת reindex. שום דבר אחר לא רשאי UPDATE לטבלה מנוהלת־גרסאות.",
  },
  "server/core/outbox.ts": {
    layer: "backend", sot: true,
    role: "כוונת עבודה נכתבת בתוך הטרנזקציה שגרמה לה",
    lesson: "emit() לא מפרסם לתור אחרי commit. drainOutbox והמסלולים הפנימיים מגישים. פרסום אחרי commit אינו אטומי ולא נעשה כאן.",
  },
  "lib/content/home.ts": {
    layer: "content",
    role: "תפר העמוד הראשי — ייצוא סינכרוני במכוון",
    lesson: "היה הכרחי כש־await שם את המסלול מאחורי loading.tsx. הקובץ ההוא נמחק; הייצוא הסינכרוני נשאר כי אין צורך לשנות. מי שהופך אותו ל־async צריך לבדוק את רינדור הבית בלי JavaScript.",
  },
  "lib/content/fake-resistance-editorial.ts": {
    layer: "content", sot: true,
    role: "שיפוט עריכתי על המחקר — מיושם בתפר, לא בייבוא",
    lesson: "תגיות טכניקה, ממצאים מוחזקים עם נימוק, מסגור פר־תיק, ומילון שמחליף קיצורי תוכנית (case-05, groups 01/03) במה שהם מתייחסים אליו. לכן ייבוא מחדש לא מוחק את השיפוט. דוגמאות המחברת נגזרות מהתגיות — פרק לא יכול להצביע על משהו שהאתר לא מפרסם.",
  },
  "scripts/project-map.mjs": {
    layer: "tests",
    role: "הגנרטור של המפה הזו",
    lesson: "סורק את המאגר וכותב את docs/project-map.html. אין לערוך את ה־HTML ביד. npm run map:check נכשל אם הדף אינו תואם לעץ. רק הפרוזה ב־project-map-prose.mjs מאומתת ביד — כל מספר נמדד.",
    related: ["docs/project-map.html", "scripts/project-map-prose.mjs"],
  },
  "scripts/project-map-prose.mjs": {
    layer: "docs",
    role: "הקטלוג העברי של המפה",
    lesson: "הסבר לכל אזור, לכל קובץ ידוע, ולכל דפוס. קובץ חדש בלי רשומה מדויקת עדיין מקבל הסבר לפי הדפוס — לא נעלם ולא נשאר 'לא מתועד' בלי סיבה.",
  },
  "docs/project-map.html": {
    layer: "docs",
    role: "המפה החיה — נוצרת, לא נערכת",
    lesson: "הקובץ שאתם קוראים. כל מספר, גודל, מסלול והפרה נמדדו בהרצה האחרונה של npm run map. עריכה ידנית תידרס, ו־map:check ייכשל עד שתריצו map מחדש.",
  },
  "docs/PROJECT_MAP.md": {
    layer: "docs",
    role: "גרסת הייחוס הכתובה של המפה",
    lesson: "איפה קובץ חדש צריך לשבת, ומה מקורות האמת. התמונות והספירות החיות הן ב־HTML שנוצר.",
  },
  "docs/engine-explainer.html": {
    layer: "docs",
    role: "מנוע האימות — הסבר לימודי",
    lesson: "אחות של המפה הזו: קנבס, מגירת הסבר, עברית. מתארת איך מידע נכנס, נבדק ומפורסם — לא את עץ הקבצים.",
  },
};

const KIND_HE = {
  dir: "תיקייה",
  page: "דף מסלול",
  layout: "מעטפת מסלול",
  route: "מטפל API",
  component: "רכיב React",
  css: "גיליון עיצוב",
  test: "קובץ בדיקה",
  migration: "מיגרציה",
  snapshot: "צילום סכימה",
  contract: "חוזה zod",
  module: "כניסת מודול",
  service: "שירות",
  repo: "שאילתות",
  rules: "מדיניות טהורה",
  schema: "טבלת סכימה",
  record: "רשומת מקור",
  asset: "נכס",
  buffer: "חוצץ חלקיקים",
  doc: "מסמך",
  code: "קוד",
  data: "נתונים",
  config: "הגדרה",
  file: "קובץ",
};

function kindOf(path, isDir) {
  if (isDir) return "dir";
  const base = path.split("/").pop();
  if (base === "page.tsx") return "page";
  if (base === "layout.tsx") return "layout";
  if (base === "route.ts") return "route";
  if (base.endsWith(".module.css") || base.endsWith(".css")) return "css";
  if (base.endsWith(".test.ts")) return "test";
  if (/migrations\/\d+.*\.sql$/.test(path)) return "migration";
  if (/_snapshot\.json$/.test(path)) return "snapshot";
  if (path.startsWith("server/contracts/") && base.endsWith(".ts")) return "contract";
  if (path.startsWith("server/modules/") && base === "index.ts") return "module";
  if (path.startsWith("server/modules/") && base === "service.ts") return "service";
  if (path.startsWith("server/modules/") && base === "repo.ts") return "repo";
  if (path.startsWith("server/modules/") && base === "rules.ts") return "rules";
  if (path.startsWith("server/db/schema/") && base.endsWith(".ts")) return "schema";
  if (/content-packages\/[^/]+\/(records|cases)\//.test(path)) return "record";
  if (/\.(png|jpe?g|webp|avif|svg|ico)$/i.test(base)) return "asset";
  if (/\.bin$/.test(base)) return "buffer";
  if (/\.md$/.test(base)) return "doc";
  if (/\.json$/.test(base)) return "data";
  if (/\.(ts|tsx|mjs|js)$/.test(base)) return "code";
  return "file";
}

function layerGuess(path) {
  if (path.startsWith("app/api") || path.startsWith("server/")) return path.startsWith("server/contracts") ? "bridge" : path.startsWith("server/db") ? "data" : "backend";
  if (path.startsWith("app/") || path.startsWith("components/")) return "frontend";
  if (path.startsWith("lib/") || path.startsWith("content-packages/")) return "content";
  if (path.startsWith("tests/") || path.startsWith("scripts/")) return "tests";
  if (path.startsWith("docs/archive")) return "archive";
  if (path.startsWith("docs/") || path.startsWith(".ai/")) return "docs";
  if (path.startsWith("public/") || path.startsWith("assets/")) return "data";
  if (path.startsWith(".github/")) return "deploy";
  if (path.startsWith(".claude/") || path.startsWith(".design-sync/")) return "local";
  return "local";
}

function parentArea(path) {
  const parts = path.split("/");
  for (let i = parts.length; i > 0; i--) {
    const p = parts.slice(0, i).join("/");
    if (AREAS[p]) return AREAS[p];
  }
  return null;
}

/**
 * @param {string} path
 * @param {{isDir?: boolean, glean?: string}} [ctx]
 */
export function lessonFor(path, ctx = {}) {
  const isDir = !!ctx.isDir;
  const exact = isDir ? AREAS[path] : FILES[path];
  const kind = kindOf(path, isDir);
  const base = path.split("/").pop();
  const parts = path.split("/");
  const dir = parts.slice(0, -1).join("/");

  if (exact) {
    return {
      layer: exact.layer,
      role: exact.role,
      lesson: exact.lesson,
      kind,
      sot: !!exact.sot || SOT.has(path),
      related: exact.related || [],
    };
  }

  const m = (re) => path.match(re);

  let hit;
  if ((hit = m(/^app\/api\/v1\/(.+)\/route\.ts$/))) {
    return {
      layer: "backend", kind: "route", sot: false, related: [],
      role: `מטפל API ציבורי או צוות — /api/v1/${hit[1]}`,
      lesson: "שכבת הכניסה. מפרסר, קורא למודול אחד דרך index.ts, מחזיר JSON. לא מכיל לוגיקה עסקית ולא נוגע במסד. לפני שהוא רץ, handler.ts כבר נתן לבקשה תפקיד. אם הנתיב אינו ב־PUBLIC_V1 הוא נכשל סגור בלי סשן אדמין.",
    };
  }
  if ((hit = m(/^app\/api\/internal\/(.+)\/route\.ts$/))) {
    return {
      layer: "backend", kind: "route", sot: false, related: ["server/http/internal-guard.ts"],
      role: `מסלול פנימי — ${hit[1]}`,
      lesson: "cron או תור. מאומת ב־CRON_SECRET דרך internal-guard, רץ כ־app_service. לא חשוף למבקר. vercel.json הוא שמצביע לכאן.",
    };
  }
  if (m(/^app\/api\/auth\//)) {
    return {
      layer: "backend", kind: "route", sot: false, related: ["app/admin"],
      role: "מסלול Neon Auth של לוח הניהול",
      lesson: "ההזדהות של האדמין, לא של מבקר X. הרשמה מוגבלת ל־ADMIN_EMAIL.",
    };
  }
  if (m(/^app\/api\/public-auth\//)) {
    return {
      layer: "backend", kind: "route", sot: false, related: ["app/auth", "server/modules/public-auth"],
      role: "מסלול סשן של כניסת X הציבורית",
      lesson: "קורא/מסנכרן את סשן המבקר אחרי OAuth. לא Neon Auth של /admin.",
    };
  }
  if ((hit = m(/^app\/([^/]+)\/page\.tsx$/))) {
    const area = AREAS[`app/${hit[1]}`];
    return {
      layer: "frontend", kind: "page", sot: false, related: [`app/${hit[1]}`],
      role: `דף המסלול /${hit[1]}`,
      lesson: area
        ? `${area.role}. ב־App Router הקובץ הזה הוא מה שנשלח בכתובת. הוא קורא מתפר התוכן ומרנדר מעטפה — לא מחזיק לוגיקה כבדה.`
        : `ב־App Router שם התיקייה הוא הכתובת. הקובץ הזה הוא מה שנשלח ב־/${hit[1]}. העברת התיקייה תשנה כתובת חיה.`,
    };
  }
  if ((hit = m(/^app\/([^/]+)\/page\.module\.css$/))) {
    return {
      layer: "frontend", kind: "css", sot: false, related: [`app/${hit[1]}/page.tsx`],
      role: `עיצוב מקומי של /${hit[1]}`,
      lesson: "CSS Modules — השמות לא דולפים לגלובלי. טיפוגרפיית הקריאה מגיעה מ־globals.css; כאן רק סטיות הדף. Cinzel לא שייך לכאן.",
    };
  }
  if (m(/^app\/[^/]+\/.+\/page\.tsx$/)) {
    const url = "/" + dir.slice("app/".length).replace(/\[/g, ":").replace(/\]/g, "");
    return {
      layer: "frontend", kind: "page", sot: false, related: [],
      role: `דף דינמי ${url}`,
      lesson: "סגמנט דינמי. generateStaticParams נגזר מהאינדקס, ולכן רשומה חדשה בחבילה הופכת לדף בלי לגעת כאן. [locale] מחזיק שפות שאינן ברירת המחדל; המסלול החשוף מחזיק את שפת הרשומה — אף גרסה לא מקבלת שתי כתובות מתחרות.",
    };
  }
  if ((hit = m(/^server\/modules\/([^/]+)\/index\.ts$/))) {
    return {
      layer: "backend", kind: "module", sot: false, related: [`server/modules/${hit[1]}/service.ts`],
      role: `דלת הכניסה למודול ${hit[1]}`,
      lesson: "קושר את db() בעצלתיים ומחזיר את ה־service. מסלול API רשאי לייבא רק את הקובץ הזה — לא את service.ts ולא את repo.ts. זה מה ששומר על השכבות.",
    };
  }
  if ((hit = m(/^server\/modules\/([^/]+)\/service\.ts$/))) {
    return {
      layer: "backend", kind: "service", sot: false, related: [`server/modules/${hit[1]}/repo.ts`],
      role: `זרימת העבודה של מודול ${hit[1]}`,
      lesson: "הלוגיקה העסקית: טרנזקציות, מעברי מצב, קריאות ל־repo. לא SQL גולמי (זה repo) ולא פענוח HTTP (זה המסלול). כתיבה לישות עם גרסאות עוברת ב־recordVersion().",
    };
  }
  if ((hit = m(/^server\/modules\/([^/]+)\/repo\.ts$/))) {
    return {
      layer: "backend", kind: "repo", sot: false, related: [`server/modules/${hit[1]}/service.ts`],
      role: `שאילתות מודול ${hit[1]}`,
      lesson: "שכבת ה־SQL. השירות קורא לפונקציות מכאן, לא כותב drizzle inline. שינוי צורת שאילתה לא אמור לשנות את חוזה ה־service.",
    };
  }
  if ((hit = m(/^server\/modules\/([^/]+)\/rules\.ts$/))) {
    return {
      layer: "backend", kind: "rules", sot: false, related: [`tests/${hit[1] === "assessments" ? "assessment-rules" : hit[1]}.test.ts`],
      role: `מדיניות טהורה של ${hit[1]} — בלי מסד`,
      lesson: "פונקציה שמקבלת מצב ומחזירה האם מעבר מותר. נבדקת ישירות ב־unit test, בלי PGlite. assessments/rules.ts הוא המודל.",
    };
  }
  if ((hit = m(/^server\/contracts\/([^/.]+)\.ts$/))) {
    return {
      layer: "bridge", kind: "contract", sot: true, related: ["server/contracts"],
      role: `חוזה ${hit[1]} — zod בלבד`,
      lesson: "הצורה שחולקים הפרונטאנד וה־API. בלי drizzle ובלי next, כדי שישאר ניתן לייבוא מ־RSC ומבדיקה בלי מסד. שינוי כאן הוא שינוי חוזה — המסלול והלקוח צריכים לזוז יחד.",
    };
  }
  if ((hit = m(/^server\/db\/schema\/([^/.]+)\.ts$/))) {
    return {
      layer: "data", kind: "schema", sot: false, related: ["server/db/schema/index.ts"],
      role: `טבלאות ${hit[1]} ב־drizzle`,
      lesson: "הסכימה ש־TypeScript רואה. האילוצים שפוסטגרס אוכף חיים במיגרציות (triggers, RLS, CHECK). שינוי עמודה כאן דורש מיגרציה ממוספרת, לא רק עריכת טיפוס.",
    };
  }
  if ((hit = m(/^server\/db\/migrations\/(\d+)_(.+)\.sql$/))) {
    return {
      layer: "data", kind: "migration", sot: false, related: ["server/db/migrations/meta/_journal.json"],
      role: `מיגרציה ${hit[1]} — ${hit[2].replace(/_/g, " ")}`,
      lesson: "רצה פעם אחת, לפי הסדר. חוקים עסקיים חיים כאן לא פחות מב־TypeScript. מיגרציה שנכתבה ביד (GRANT, RLS, trigger) לא מקבלת snapshot — וזה תקין. מה שחשוב: snapshot אחרון לא יישאר מאחורי מיגרציית DDL.",
    };
  }
  if ((hit = m(/^server\/db\/migrations\/meta\/(\d+)_snapshot\.json$/))) {
    return {
      layer: "data", kind: "snapshot", sot: false, related: [],
      role: `צילום סכימה ${hit[1]}`,
      lesson: "drizzle שומר את מצב הסכימה אחרי מיגרציה שהוא עצמו יצר. אם ה־snapshot האחרון מאחורי מיגרציית CREATE/ALTER TABLE, db:generate יפלוט מחדש שינוי שכבר רץ.",
    };
  }
  if (path === "server/db/migrations/meta/_journal.json") {
    return {
      layer: "data", kind: "data", sot: true, related: [],
      role: "יומן המיגרציות",
      lesson: "רשימת המיגרציות שdrizzle חושב שהוחלו. מספר הרשומות חייב להתאים למספר קבצי ה־SQL. סחיפה כאן היא באג, לא סגנון.",
    };
  }
  if ((hit = m(/^tests\/(.+)\.test\.ts$/))) {
    return {
      layer: "tests", kind: "test", sot: false, related: [],
      role: `בדיקות ${hit[1]}`,
      lesson: "vitest מול PGlite — פוסטגרס אמיתי ב־WASM, ממוגרר מחדש. טריגרים ואילוצים מתנהגים כמו ב־Neon. אין צורך ב־DATABASE_URL. בדיקת חיפוש סמנטי מדלגת בלי pgvector.",
    };
  }
  if ((hit = m(/^lib\/content\/([^/.]+)\.ts$/))) {
    return {
      layer: "content", kind: "code", sot: false, related: ["lib/content"],
      role: `תפר התוכן של ${hit[1]}`,
      lesson: "הפרונטאנד לא קורא חבילות ישירות מהדפים — הוא עובר כאן. היום הקובץ קורא JSON סטטי; מחר אפשר להחליף את גוף הפונקציה לשאילתה בלי לגעת באתרי הקריאה.",
    };
  }
  if ((hit = m(/^content-packages\/([^/]+)\/(records|cases)\/(.+)$/))) {
    return {
      layer: "content", kind: "record", sot: false, related: [`content-packages/${hit[1]}`],
      role: `רשומת מקור ב־${hit[1]}`,
      lesson: `JSON מחויב לגיט (${hit[3]}). האינדקס קורא אותו בזמן build ו־generateStaticParams מייצר ממנו דף. המדיה עצמה לא כאן — רק media_id ל־CDN. המאגר ציבורי: push כבר מפרסם את הטקסט, גם לפני פריסה.`,
    };
  }
  if ((hit = m(/^content-packages\/([^/]+)\/(\w+)\.json$/))) {
    const what = {
      index: "האינדקס שמייצר מסלולים",
      manifest: "המניפסט של החבילה",
      media: "מפת המדיה — media_id אל קבצים ב־CDN",
      languages: "שפות זמינות",
      categories: "קטגוריות הארכיון",
      "translation-links": "קישורי תרגום בין גרסאות",
      network: "גרף הרשת של תיקי המחקר",
    }[hit[2]] || `קובץ ${hit[2]} של החבילה`;
    return {
      layer: "content", kind: "data", sot: hit[2] === "index", related: [`content-packages/${hit[1]}`],
      role: `${what} — ${hit[1]}`,
      lesson: hit[2] === "index"
        ? "זו הרשימה ש־generateStaticParams קורא. רשומה חדשה כאן הופכת לדף באתר בלי לגעת בקוד."
        : "מטא־נתונים של חבילת התוכן. לא רשומת גוף — המידע שמאפשר לבנות אינדקסים, שפות ומדיה.",
    };
  }
  if ((hit = m(/^public\/particles\/lion-v2-(.+)\.bin$/))) {
    return {
      layer: "data", kind: "buffer", sot: false, related: ["scripts/intro-scene/bake/bake-lion-reference.ts"],
      role: `חוצץ אריה ${hit[1]} נקודות`,
      lesson: "פורמט LNP1. הסצנה בוחרת 45k / 90k / 180k לפי מדד ביצועים. כתר, פנים ורעמה הם אפייה אחת.",
    };
  }
  if ((hit = m(/^assets\/source\/icons\/([^.]+)\.svg$/))) {
    return {
      layer: "data", kind: "asset", sot: false, related: ["lib/site-navigation.ts"],
      role: `אייקון מקור של יעד ${hit[1]}`,
      lesson: "ייבוא של רכיב React בלבד. עד 1.9.2026 זה היה גם מקור אפיית ה־SDF לצמתי הניווט הרדיאלי; האפייה ההיא נמחקה עם הניווט.",
    };
  }
  if (m(/^assets\/marketing\//)) {
    return {
      layer: "data", kind: "asset", sot: false, related: ["app/support-us"],
      role: `נכס שיווק — ${base}`,
      lesson: "לא נכנס לסצנת החלקיקים. משמש משטחי תמיכה, תרומה או זהות אפליקציה. אם אינו מקושר משום מקום, המפה תסמן אותו כלא־נגיש.",
    };
  }
  if (m(/^\.design-sync\/previews\//)) {
    return {
      layer: "local", kind: "component", sot: false, related: [".design-sync"],
      role: `תצוגת עיצוב של ${base.replace(/\.tsx$/, "")}`,
      lesson: "דוגמת שימוש לחבילת מערכת העיצוב. מייבאת את שם החבילה הבנויה, לא את המקור. שום דבר במאגר לא מייבא אותה — הכלי החיצוני מוצא אותה לפי מוסכמת ספרייה.",
    };
  }
  if (m(/^\.design-sync\/shims\//)) {
    return {
      layer: "local", kind: "code", sot: false, related: [".design-sync"],
      role: `מתאם ${base} לבנייה מחוץ ל־Next`,
      lesson: "מאפשר לרכיב להיבנות בלי runtime של Next. לא רץ באתר החי.",
    };
  }
  if (m(/^\.claude\/skills\//)) {
    return {
      layer: "local", kind: base.endsWith(".md") ? "doc" : "code", sot: false, related: [".claude/skills"],
      role: `מיומנות מקומית — ${base}`,
      lesson: "הנחיות למפעיל, לא קוד אתר. design-director חלה על כל שינוי נראות; verify-intro מצלם את האינטרו ב־Chrome אמיתי.",
    };
  }
  if (m(/^\.claude\/hooks\//)) {
    return {
      layer: "local", kind: "code", sot: false, related: [".claude/hooks"],
      role: `hook מקומי — ${base}`,
      lesson: "כלי עזר ליד העורך. חלקם רצים אחרי עריכת ציר הזמן (כולל tsc). לא חלק מהאתר החי.",
    };
  }
  if (m(/^\.ai\//)) {
    return {
      layer: "docs", kind: "doc", sot: base === "DECISIONS.md", related: [".ai"],
      role: {
        "DECISIONS.md": "יומן ההחלטות — append-only",
        "STATE.md": "איפה העבודה עומדת עכשיו — נכתב מחדש",
        "DESIGN-V2.md": "חוזה הטיפוס של משטחי הקריאה",
        "ROLLBACK.md": "איך חוזרים אחורה",
        "WORKFLOW.md": "לולאת העבודה המשותפת",
      }[base] || `מסמך יומן — ${base}`,
      lesson: base === "DECISIONS.md"
        ? "למה נעשתה בחירה עמידה. מוסיפים רשומה, לא עורכים ישנה. החלטה שנמצאת כאן אינה וטו על הוראת הבעלים — היא תיאור של מה שקיים."
        : "יומן פנימי לסוכנים ולבעלים. לא נשלח לקורא. אלה תיאור של המערכת, לא רשות לסרב לבקשה.",
    };
  }
  if (m(/^docs\/archive\//)) {
    return {
      layer: "archive", kind: "doc", sot: false, related: ["docs/archive"],
      role: `מסמך סגור — ${base}`,
      lesson: "עשה את שלו. אינו מקור אמת. אם יש בו דבר שעוד נכון, הוא כבר הורם למסמך חי ב־docs/ או ב־DECISIONS.",
    };
  }
  if (m(/^docs\//) && base.endsWith(".md")) {
    return {
      layer: "docs", kind: "doc", sot: false, related: ["docs/README.md"],
      role: `תיעוד עזר — ${base.replace(/\.md$/, "")}`,
      lesson: "נכתב כדי להיות נכון, לא שאפתני. מספר שמופיע גם כאן וגם במסמך אחר ייסחף — המונה שייך למסמך אחד.",
    };
  }
  if ((hit = m(/^scripts\/([^/]+)$/))) {
    return {
      layer: "tests", kind: "code", sot: false, related: ["docs/operations.md"],
      role: `סקריפט ${hit[1]}`,
      lesson: /verify|smoke|final/.test(hit[1])
        ? "סקריפט אימות. חלקם דורשים Chrome אמיתי על macOS (נתיב מוחלט + executablePath). ci-smoke הוא מה ש־CI מריץ, עם Chromium מובנה, כולל טעינת / בלי JavaScript."
        : /import/.test(hit[1])
          ? "ייבוא תוכן. המחקר לוקח publication_wording ולעולם לא analysis, ולעולם לא את evidence/** הגולמי."
          : /upload|verify-archive/.test(hit[1])
            ? "נכסי הארכיון חיים ב־CDN, לא בגיט. הסקריפט הזה מדבר עם הקידומת, לא עם 1.8GB מקומיים."
            : "כלי מאגר. ראו את הטבלה ב־docs/operations.md לפני הרצה — חלקם הורסים או כותבים.",
    };
  }
  if (m(/^scripts\/intro-scene\//)) {
    return {
      layer: "tests", kind: "code", sot: false, related: ["scripts/intro-scene"],
      role: `שלב באפיית החלקיקים — ${base}`,
      lesson: "דטרמיניסטי: אותו זרע, אותם בתים. הפלט נוחת ב־public/particles ומחויב במכוון.",
    };
  }
  if (m(/^components\/[^/]+\/.+\.module\.css$/)) {
    return {
      layer: "frontend", kind: "css", sot: false, related: [dir],
      role: `עיצוב מודול של ${dir.split("/").pop()}`,
      lesson: "CSS Modules — מחלקות מקומיות לרכיב. טיפוס וצבע של משטח קריאה מגיעים מ־globals.css. כאן פריסה, מצבים, וחריגות מקומיות בלבד.",
    };
  }
  if (m(/^components\/[^/]+\/.+\.tsx$/)) {
    const feature = parts[1];
    const area = AREAS[`components/${feature}`];
    return {
      layer: "frontend", kind: "component", sot: false, related: [`components/${feature}`],
      role: `רכיב ${base.replace(/\.tsx$/, "")} במשפחת ${feature}`,
      lesson: area
        ? `${area.role}. רכיב React בתיקיית הפיצ'ר — לא ספרייה גלובלית. אם הוא משמש פיצ'ר שני, הוא צריך לעבור דירה או להישאר כאן במודע.`
        : `רכיב React בתיקיית ${feature}. תיקיות components/ הן פיצ'רים, לא סוגי רכיבים.`,
    };
  }
  if (m(/^server\/core\//)) {
    return {
      layer: "backend", kind: "code", sot: false, related: ["server/core"],
      role: `תשתית רוחבית — ${base}`,
      lesson: "קוד שכל המודולים רשאים להישען עליו: הזדהות, תור, חתימה, שער AI, דוא״ל. לא מודול נתונים — אין לו repo משלו.",
    };
  }
  if (m(/^server\/modules\/[^/]+\/connectors\//)) {
    return {
      layer: "backend", kind: "code", sot: false, related: ["server/modules/sources"],
      role: `מחבר מקורות — ${base}`,
      lesson: "מוריד ומפענח פורמט חיצוני (RSS, חיפוש). רץ לפני טרנזקציית המסד — לא מחזיק טרנזקציה פתוחה מול רשת איטית.",
    };
  }
  if (path === ".github/workflows/ci.yml") {
    return {
      layer: "deploy", kind: "config", sot: true, related: ["scripts/ci-smoke.mjs"],
      role: "שער CI ואז עשן מסלולים",
      lesson: "typecheck, lint, test, build, map:check, ואז ci-smoke על 21 מסלולים כולל / בלי JavaScript. הפריסה ל־production אינה כאן — היא פעולת Vercel ידנית.",
    };
  }

  const area = parentArea(isDir ? path : dir);
  const glean = (ctx.glean || "").trim();
  const kindHe = KIND_HE[kind] || KIND_HE.file;
  const role = isDir
    ? `תיקייה תחת ${parts[0]}/`
    : `${kindHe} — ${base}`;
  const lesson = [
    isDir
      ? `תיקייה במאגר שאין לה רשומת הסבר משלה עדיין. היא יושבת תחת ${parts[0]}/.`
      : `${kindHe} בתיקיית ${dir || "שורש המאגר"}.`,
    area ? area.lesson.split(".").slice(0, 2).join(".") + "." : "",
    glean ? `הקובץ אומר על עצמו: ${glean}` : "",
    isDir ? "לחצו כדי לראות את הקבצים בתוכה — כל אחד מהם נפתח לחלון הסבר." : "פתחו את הקובץ עצמו אם צריך פרט שאין בדפוס; הוסיפו רשומה מדויקת ב־project-map-prose.mjs אם זה מקור אמת.",
  ].filter(Boolean).join(" ");

  return {
    layer: area?.layer || layerGuess(path),
    role,
    lesson,
    kind,
    sot: SOT.has(path),
    related: area ? [isDir ? parts[0] : dir] : [],
  };
}

export { KIND_HE, kindOf };
