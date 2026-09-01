export interface GlossaryTerm {
  termEn: string;
  termHe: string;
  category: "ingest" | "evidence" | "model" | "briefing" | "search" | "ai" | "infra";
  shortDescriptionHe: string;
  deepExplanationHe: string;
  exampleHe?: string;
  relatedDbTable?: string;
}

export const PIPELINE_GLOSSARY: GlossaryTerm[] = [
  {
    termEn: "Outbox (Transactional Outbox)",
    termHe: "תיבת יוצא טרנזקציונית",
    category: "infra",
    shortDescriptionHe: "דפוס תוכנה המבטיח שכל אירוע מערכתי נשמר במסד הנתונים באותה טרנזקציה שבה בוצע השינוי.",
    deepExplanationHe:
      "כאשר פריט מאושר או מתפרסם, המערכת אינה שולחת הודעות לתורים חיצוניים ישירות, שכן קריסת רשת עלולה לגרום לחוסר תיאום. במקום זאת, האירוע נרשם בטבלת `outbox` כחלק מאותה פעולה במסד, ועבודה ברקע (`cron/outbox-drain`) מושכת ומפיצה אותו בבטחה.",
    exampleHe: "אישור פריט מידע רושם מיד שורת outbox המפעילה עדכון באינדקס החיפוש והפקת הטמעה וקטורית.",
    relatedDbTable: "outbox",
  },
  {
    termEn: "Blob Storage",
    termHe: "אחסון קבצים ומסמכים גולמיים בענן",
    category: "ingest",
    shortDescriptionHe: "שירות אחסון קבצים ייעודי (Vercel Blob) השומר את דפי האינטרנט והמסמכים המלאים כפי שנלכדו ברשת.",
    deepExplanationHe:
      "כדי למנוע תלות בשינויים עתידיים או מחיקת כתבות באתרים חיצוניים, המערכת שומרת את ה־HTML או ה־JSON המקורי המלא בענן, ומחשבת לו חתימת אבטחה דיגיטלית (SHA-256).",
    exampleHe: "שמירת עמוד חדשות מלא מרויטרס בגודל 240KB עם חתימה דיגיטלית שמונעת טענות לזיוף.",
    relatedDbTable: "source_fetch",
  },
  {
    termEn: "RLS (Row-Level Security)",
    termHe: "אבטחת שורות ברמת מסד הנתונים",
    category: "infra",
    shortDescriptionHe: "מנגנון אבטחה ב־Postgres המגביל קריאה וכתיבה של שורות ספציפיות בהתאם להרשאות המשתמש.",
    deepExplanationHe:
      "במקום לסמוך רק על קוד האפליקציה, מסד הנתונים עצמו חוסם שאילתות מהציבור (משתמש `app_public`) מלקרוא טיוטות, הערכות פנימיות או ראיות חסויות, ומתיר גישה רק לנתונים שעברו שער פרסום רשמי.",
    exampleHe: "משתמש אנונימי אינו יכול לשלוף פריט שטרם אושר ע\"י עורך, גם אם הוא מנחש את המזהה שלו.",
    relatedDbTable: "publication, published_item",
  },
  {
    termEn: "canAssignVerdict",
    termHe: "מנוע בדיקת חוקי אימות (פונקציה טהורה)",
    category: "model",
    shortDescriptionHe: "פונקציית קוד טהורה המוודאת קיום לפחות 2 מקורות עצמאיים לפני קביעת פסק אימות.",
    deepExplanationHe:
      "כדי למנוע טעויות אנוש או לחצים עיתונאיים, לא ניתן לקבוע מעמד 'מאומת' (Verified) לטענה אלא אם מקושרות אליה לפחות שתי ראיות המגיעות ממשפחות מקור שונות לחלוטין (למשל: סוכנות ישראלית וסוכנות בינלאומית עצמאית).",
    exampleHe: "חמישה אתרים שציטטו את אותו ציוץ נחשבים למקור בודד, והמערכת תחסום מתן מעמד 'מאומת'.",
    relatedDbTable: "item_assessment",
  },
  {
    termEn: "Quarantine",
    termHe: "הסגר ובידוד תכנים פגומים",
    category: "briefing",
    shortDescriptionHe: "אזור בידוד אוטומטי למאמרים או בריפים שנכשלו בבדיקות האיכות ומנועים מפרסום.",
    deepExplanationHe:
      "אם בריף יומי שנכתב ע\"י בינה מלאכותית נכשל אפילו באחת מתוך 8 בדיקות האיכות (למשל: ציטט מקור לא מאושר, או חסר הצלבה), הוא מועבר מיידית לטבלת `briefing_quarantine` ונחסם מפרסום לציבור עד לסקירה אנושית.",
    exampleHe: "בריף שכלל רק מקור חדשותי יחיד מועבר להסגר ונשלחת התרעה דחופה לצוות העורכים.",
    relatedDbTable: "briefing_quarantine, briefing_alert",
  },
  {
    termEn: "Triage",
    termHe: "טריאז' וסינון ראשוני",
    category: "briefing",
    shortDescriptionHe: "תהליך סיווג ודירוג מהיר של ידיעות חדשותיות לקביעת מידת הרלוונטיות והעניין הציבורי.",
    deepExplanationHe:
      "מודל שפה מהיר וחסכוני (`gpt-5-nano`) עובר על עשרות אשכולות חדשות, מנפה דיווחים שוליים או יחסי ציבור, ובוחר את 5 עד 8 הסיפורים הגיאו-פוליטיים המשמעותיים ביותר עבור המהדורה היומית.",
    exampleHe: "סינון של 140 דיווחים יומיים ל־6 כתבות מפתח בעלות השפעה אסטרטגית על המזרח התיכון.",
    relatedDbTable: "briefing_candidate",
  },
  {
    termEn: "Grounded RAG (Retrieval-Augmented Generation)",
    termHe: "יצירת תשובות מעוגנת מסמכים בלבד",
    category: "ai",
    shortDescriptionHe: "ארכיטקטורת שיחה המחייבת את הבינה המלאכותית להשיב אך ורק על בסיס עובדות שאוחזרו מהמאגר.",
    deepExplanationHe:
      "בצ'אט המודיעיני של המערכת, המודל אינו רשאי 'להמציא' עובדות מהזיכרון הכללי שלו. כל תשובה נשענת על פריטים שנשלפו בזמן אמת, והמערכת רושמת מראש את מזהי המסמכים ביומן `chat_tool_run` לפני שהמודל משיב.",
    exampleHe: "שאלה על אירועי 7 באוקטובר תתבסס אך ורק על מסמכי עדות רשמיים שאוחזרו במסד.",
    relatedDbTable: "chat_thread, chat_tool_run",
  },
  {
    termEn: "Citation Guard",
    termHe: "שומר הציטוטים (טריגר אטומי לחסימת הזיות)",
    category: "ai",
    shortDescriptionHe: "טריגר SQL המוודא שכל ציטוט שמופיע בתשובת הצ'אט אכן נשלף בפועל בשאילתה הנוכחית.",
    deepExplanationHe:
      "אם מודל ה־AI הוזה ציטוט של מסמך שלא היה חלק מתוצאות החיפוש שהוזנו אליו, טריגר ה־SQL של מסד הנתונים (`chat_citation_must_be_retrieved`) פוסל את הציטוט ומונע הטעיה של המשתמש.",
    exampleHe: "המודל מנסה לצטט מסמך בדיוני -> מסד הנתונים חוסם את הקישור ומחזיר רק ציטוטים אמיתיים.",
    relatedDbTable: "chat_citation",
  },
  {
    termEn: "RRF (Reciprocal Rank Fusion)",
    termHe: "מיזוג דירוגים הדדי (אלגוריתם חיפוש)",
    category: "search",
    shortDescriptionHe: "אלגוריתם מתמטי הממזג תוצאות מ־4 מנועי חיפוש שונים לדירוג איכותי אחד.",
    deepExplanationHe:
      "המערכת מריצה במקביל 4 שאילתות: חיפוש מילולי בעברית (פשוט), חיפוש באנגלית (מוטה שורשים), חיפוש טריגרמות לשגיאות כתיב, וחיפוש וקטורי סמנטי. נוסחת RRF עם קבוע k=60 ממזגת את 4 הרשימות לפי מיקום התוצאות.",
    exampleHe: "מסמך שהופיע במקום שני בחיפוש העברי ובמקום שלישי בחיפוש הסמנטי יקבל ציון משוקלל עליון.",
    relatedDbTable: "search_document",
  },
  {
    termEn: "pgvector",
    termHe: "חיפוש וקטורי מתקדם במסד הנתונים",
    category: "search",
    shortDescriptionHe: "הרחבה של מסד הנתונים Postgres המאפשרת שמירה והשוואה של וקטורים מתמטיים (1536 ממדים).",
    deepExplanationHe:
      "כל מאמר או עדות עוברים קידוד למערך של 1536 מספרים המייצגים את המשמעות הסמנטית שלהם. חיפוש לפי מרחק קוסינוס מאפשר למצוא כתבות דומות גם אם הן משתמשות במילים נרדפות לחלוטין.",
    exampleHe: "חיפוש 'חדירה קרקעית' ימצא כתבות על 'פלישה של כוחות רגלים' בזכות הדמיון הסמנטי.",
    relatedDbTable: "search_document",
  },
  {
    termEn: "Cron (Vercel Crons)",
    termHe: "מתזמן משימות אוטומטי",
    category: "infra",
    shortDescriptionHe: "מנגנון ענן המפעיל נקודות קצה בשרת לפי לוח זמנים קבוע ומדויק.",
    deepExplanationHe:
      "המערכת מפעילה 5 מתזמנים מרכזיים: איסוף מקורות כל 30 דקות, הפקת בריף יומי ב־07:00 בבוקר, ניקוז תיבת היוצא כל 5 דקות, הפקת הטמעות וקטוריות כל שעה, ותחזוקת מערכת יומית.",
    exampleHe: "בדיוק ב־07:00 בבוקר מתקבלת קריאה מאובטחת המזניקה את שרשרת הפקת המהדורה היומית.",
  },
  {
    termEn: "Two-Human Rule",
    termHe: "כלל שני בני האדם (אימות כפול)",
    category: "model",
    shortDescriptionHe: "חוק אבטחה מחמיר האוסר על כותב הפריט לאשר או לפרסם אותו בעצמו.",
    deepExplanationHe:
      "טריגר SQL מובנה (`enforce_publish_gate`) מוודא שהמשתמש שכתב או ערך את פריט המידע שונה לחלוטין מהעורך שמאשר אותו לפרסום, וכן ששני המשתמשים הם אנשים אמיתיים ולא בוטים או סוכני AI.",
    exampleHe: "ניסיון של עורך לאשר פריט שהוא עצמו יצר ייחסם אוטומטית ברמת מסד הנתונים בשגיאת הרשאה.",
    relatedDbTable: "information_item, item_assessment",
  },
  {
    termEn: "Circuit Breaker",
    termHe: "מנתק זרם (הגנה מפני שרתים קורסים)",
    category: "ingest",
    shortDescriptionHe: "מנגנון המשהה פניות למקורות מידע חיצוניים שחוו מספר כשלים רצופים.",
    deepExplanationHe:
      "אם אתר חדשות חיצוני אינו מגיב או מחזיר שגיאות 5 פעמים ברציפות, המערכת משביתה אותו זמנית כדי לא לבזבז משאבי רשת ולא לתקוע את שרשרת האיסוף.",
    exampleHe: "פיד RSS של אתר שנפל מושבת אוטומטית עד לבדיקת מנהל מערכת.",
    relatedDbTable: "source",
  },
  {
    termEn: "GDELT Project",
    termHe: "מאגר אירועים עולמי (Global Database of Events)",
    category: "ingest",
    shortDescriptionHe: "פרויקט בינלאומי המנטר ומנתח עשרות אלפי מקורות חדשותיים בעולם בזמן אמת.",
    deepExplanationHe:
      "מחבר ה־GDELT במערכת סורק דיווחים עולמיים הקשורים לישראל, למזרח התיכון וללוחמת תודעה, ומאפשר לאתר מוקדי עניין ונרטיבים חדשים שמתפשטים בעולם.",
    exampleHe: "איתור של 50 דיווחים חדשים בדרום אמריקה על אירועי המלחמה תוך דקות מפרסומם.",
  },
  {
    termEn: "Evidence Provenance",
    termHe: "שובל ייחוס ראייתי (שרשרת משמורת)",
    category: "evidence",
    shortDescriptionHe: "תיעוד היסטורי מקיף של כל גלגול שעברה ראיה מרגע לכידתה ועד לפרסומה.",
    deepExplanationHe:
      "לכל ראיה נרשם שובל מלא הכולל את זהות הלוכד (אדם או בוט), חותמת הזמן, ה־URL המקורי, חתימת ה־SHA-256 של הקובץ הגולמי, וכל פעולת אישור שנעשתה עליה.",
    exampleHe: "הוכחה משפטית שצילום מסך של מסמך חמאס נלכד במועד מסוים ולא עבר עריכה גרפית.",
    relatedDbTable: "evidence_provenance",
  },
];
