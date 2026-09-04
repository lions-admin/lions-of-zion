/**
 * The console's Hebrew vocabulary — one word per concept, decided once.
 *
 * The operations console is the owner's own surface and reads in Hebrew. The
 * public site stays English; `tests/english-chrome.test.ts` still forbids
 * Hebrew everywhere under `app/` and `components/` except `app/admin/**`.
 *
 * This file exists because the console was translated across a dozen files at
 * once, and the failure mode of that is not a mistranslation — it is three
 * files calling the same thing three names. A reader who sees "טיוטה" in one
 * panel and "מסמך" in the next cannot tell whether they are looking at the
 * same object. So every recurring term is decided here and imported, never
 * retyped.
 *
 * Three rules were applied, and they are worth knowing before adding a term:
 *
 *  1. **A word an operator would say, not a literal rendering.** `stuck` is
 *     "תקוע", not "נעוץ". `quarantine` is "בידוד" because that is what the
 *     rows are — held aside, not destroyed.
 *  2. **Identifiers stay as they are.** Enum values, tool names, model slugs,
 *     job keys, HTTP codes and env-var names appear in the database, in the
 *     logs and in this repository in Latin script; translating them on screen
 *     would break the one thing a console is for — matching what you see to
 *     what you can grep. `STATUS_LABEL` translates the *label*; the value
 *     underneath stays `under_review`.
 *  3. **Numbers and dates are Hebrew-locale but Latin-digit.** `he-IL`
 *     formats dates the way an Israeli reader expects while keeping digits
 *     legible next to the English identifiers they sit beside.
 */

import type { PublicationSection, PublicationStatus } from "@/server/contracts/enums";

/* ── The five areas ───────────────────────────────────────────────────── */

export const AREA_LABEL = {
  overview: "תמונת מצב",
  pipeline: "תהליך העיבוד",
  sources: "מקורות מידע",
  editorial: "תור עריכה",
  system: "מערכת ואבטחה",
} as const;

/* ── Publication lifecycle ────────────────────────────────────────────── */

export const STATUS_LABEL: Record<PublicationStatus, string> = {
  draft: "טיוטה",
  under_review: "בבדיקה",
  approved: "מאושרת",
  published: "פורסמה",
  updated: "עודכנה",
  archived: "בארכיון",
};

export const SECTION_LABEL: Record<PublicationSection, string> = {
  daily_brief: "בריף יומי",
  israel_update: "סיפור ישראלי",
  /* Retired from production but still a legal enum value, so the archive and
     /war-update keep rendering. See CLAUDE.md. */
  war_update: "עדכון ביטחוני",
  narrative_watch: "ניטור נרטיבים",
};

/**
 * The editorial desk's lanes.
 *
 * Separate from `STATUS_LABEL` and not derived from it. A status names one
 * publication — `פורסמה`, singular and feminine — while a lane heads a column
 * of many, and Hebrew inflects for both number and gender where English does
 * not. Reusing the status label gave "פורסמה" above eleven articles, which
 * reads as a caption for one of them.
 */
export const LANE_LABEL = {
  drafts: "טיוטות",
  inReview: "בבדיקה",
  ready: "מוכנות לפרסום",
  published: "פורסמו",
  archived: "בארכיון",
} as const;

/* ── Pipeline stages ──────────────────────────────────────────────────── */

export const STAGE_LABEL: Record<string, string> = {
  collect: "איסוף",
  enrich: "העשרה",
  cluster: "אשכול",
  triage: "מיון",
  draft: "ניסוח",
  quality: "בקרת איכות",
  publish: "פרסום",
};

/**
 * Briefing edition states.
 *
 * Feminine, because the subject is a `מהדורה`. Distinct from both job states
 * and publication statuses even where the English word is the same: an
 * edition that is `published` reads `פורסמה`, a job that is `completed`
 * reads `הושלם`, and collapsing the two would make a Hebrew reader think the
 * pipeline had published something it had not.
 */
export const EDITION_STATUS_LABEL: Record<string, string> = {
  collecting: "באיסוף",
  processing: "בעיבוד",
  quarantined: "בבידוד",
  published: "פורסמה",
  failed: "נכשלה",
};

export const JOB_STATE_LABEL: Record<string, string> = {
  pending: "ממתין",
  running: "רץ",
  completed: "הושלם",
  quarantined: "בבידוד",
};

/* ── Sources ──────────────────────────────────────────────────────────── */

export const SOURCE_KIND_LABEL: Record<string, string> = {
  rss: "RSS",
  atom: "Atom",
  api: "API",
  agent_search: "חיפוש סוכן",
  google_search: "חיפוש Google",
  gdelt: "GDELT",
  scraper: "גריפה",
  manual: "ידני",
};

export const FETCH_STATUS_LABEL: Record<string, string> = {
  success: "הצליח",
  partial: "חלקי",
  failed: "נכשל",
};

/* ── Narratives ───────────────────────────────────────────────────────── */

export const NARRATIVE_STATUS_LABEL: Record<string, string> = {
  emerging: "מתהווה",
  active: "פעיל",
  declining: "נחלש",
  dormant: "רדום",
  retired: "הוסר",
};

export const TREND_LABEL: Record<string, string> = {
  new: "חדש",
  rising: "במגמת עלייה",
  stable: "יציב",
  declining: "נחלש",
  /* `narrativeWatchDetails.trendDirection` carries this; the console's own
     `trendDirection` derivation does not produce it. Both feed this map. */
  unclear: "לא ברור",
};

/* ── Severity and health ──────────────────────────────────────────────── */

export const SEVERITY_LABEL: Record<string, string> = {
  critical: "קריטי",
  warning: "אזהרה",
};

/* ── The recurring nouns, so twelve files spell them the same ─────────── */

export const T = {
  /* Objects */
  publication: "כתבה",
  publications: "כתבות",
  source: "מקור",
  sources: "מקורות",
  evidence: "ראיות",
  narrative: "נרטיב",
  narratives: "נרטיבים",
  job: "משימה",
  jobs: "משימות",
  run: "ריצה",
  runs: "ריצות",
  edition: "מהדורה",
  alert: "התראה",
  alerts: "התראות",
  user: "משתמש",
  users: "משתמשים",
  capability: "הרשאה",
  capabilities: "הרשאות",
  auditLog: "יומן ביקורת",
  version: "גרסה",
  versions: "גרסאות",

  /* States */
  active: "פעיל",
  inactive: "מושבת",
  paused: "מושהה",
  stuck: "תקוע",
  quarantined: "בבידוד",
  failed: "נכשל",
  ok: "תקין",

  /* Column headings — the word that names a column, not the values in it.
     `STATUS_LABEL` and `STAGE_LABEL` map values; nothing named the header. */
  colStatus: "מצב",
  colStage: "שלב",
  colRecovery: "שחזור",
  colCalls: "קריאות",

  /* Lifecycle states, as opposed to the verbs in the action list below. */
  resolved: "טופלה",
  raised: "נפתחה",
  configured: "מוגדר",
  missing: "חסר",
  ready: "מוכן",
  waiting: "ממתין",
  current: "נוכחית",

  /* Hebrew inflects for number and gender and the singular forms above do
     not carry over. These are the plurals the panels actually needed —
     `נכשל` cannot head a count of sources, and `תקוע` cannot head a count of
     jobs. Add the form you need rather than bending one that nearly fits. */
  failingPlural: "כושלים",
  failuresPlural: "כשלים",
  stuckPluralF: "תקועות",
  pendingPluralF: "ממתינות",
  activePlural: "פעילים",
  inactivePlural: "מושבתים",

  /* Measures */
  cost: "עלות",
  budget: "תקציב",
  spend: "הוצאה",
  attempts: "ניסיונות",
  successes: "הצלחות",
  duplicates: "כפילויות",
  errors: "שגיאות",
  lastError: "שגיאה אחרונה",

  /* Time */
  last24h: "ב-24 השעות האחרונות",
  last7d: "בשבוע האחרון",
  last30d: "ב-30 הימים האחרונים",
  thisMonth: "החודש",
  never: "מעולם",
  none: "אין",

  /* Actions — the verb on the button is the verb in the confirmation. */
  refresh: "רענון",
  retry: "הרצה מחדש",
  resolve: "סימון כטופל",
  verify: "אימות",
  enable: "הפעלה",
  disable: "השבתה",
  publish: "פרסום",
  unpublish: "הסרה מפרסום",
  archive: "ארכוב",
  remove: "מחיקה",
  rollback: "החזרה לגרסה קודמת",
  save: "שמירה",
  cancel: "ביטול",
  close: "סגירה",
  send: "שליחה",
  clear: "ניקוי",
  signOut: "יציאה",
  tryAgain: "לנסות שוב",
  loadOlder: "טעינת ישנים יותר",
  applyFilters: "החלת סינון",
} as const;

/* ── Absence and failure, phrased as causes rather than blanks ────────── */

export const ABSENCE = {
  /* STATE-005: a refused read and a broken one need different first moves,
     and the words are what carry that difference to the operator. */
  authTitle: "יש להתחבר כדי לפתוח את הקונסולה",
  authBody:
    "הסשן אינו מחובר, או שתוקפו פג. שום דבר לא תקול — הקונסולה מסרבת לענות לקריאה לא מאומתת, וזה בדיוק תפקידה.",
  authAction: "מעבר להתחברות",

  unavailableTitle: (what: string) => `הפריסה הזו עדיין לא מגישה את ${what}`,
  unavailableBody:
    "המסלול החזיר 404. הקונסולה נבנתה מול החוזה המשותף לפני שכל נקודת קצה נכתבה; שאר הקונסולה ממשיכה לעבוד. שום דבר לא נכשל.",
  unavailableAction: "בדיקה חוזרת",

  failedTitle: (what: string) => `לא ניתן לקרוא את ${what}`,
  failedAction: T.tryAgain,

  loading: (what: string) => `טוען ${what}`,
} as const;

/* ── Formatting, Hebrew locale ────────────────────────────────────────── */

export const LOCALE = "he-IL";
