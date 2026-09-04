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

/* ── Edition drilldown ────────────────────────────────────────────────── */

/* A per-stage run row's status. Feminine, because the subject is a `ריצה` —
   the same inflection `EDITION_STATUS_LABEL` uses for an edition. */
export const RUN_STATUS_LABEL: Record<string, string> = {
  running: "רצה",
  completed: "הושלמה",
  failed: "נכשלה",
};

/* The claim layers the drilldown lists. Enum values on the wire; these are
   the words an operator reads beside them. */
export const CLAIM_LAYER_LABEL: Record<string, string> = {
  source_claim: "טענת מקור",
  observed_fact: "עובדה שנצפתה",
  model_inference: "הסקת מודל",
  editorial_conclusion: "מסקנת מערכת",
};

/* The machine assessments attached to a claim. Distinct from the quality
   check's pass/fail: this is what the pipeline judged the claim itself. */
export const ASSESSMENT_LABEL: Record<string, string> = {
  verified: "מאומת",
  refuted: "נסתר",
  misleading: "מטעה",
  unsupported: "בלתי נתמך",
  disputed: "שנוי במחלוקת",
  unresolved: "בלתי מוכרע",
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
  /* The briefing pipeline's recorded checks. Feminine, because the subject
     is a `בקרה` — a check `passes` (`עברה`) or `fails` (`נכשלה`), the same
     inflection EDITION_STATUS_LABEL uses for an edition. The check names
     themselves are identifiers and stay Latin; see rule 2 above. */
  qualityChecks: "בקרות איכות",
  checkPassed: "עברה",
  checkFailed: "נכשלה",

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
  /* A budget or a threshold nobody has set yet. Distinct from `none`: `none`
      is a count of zero, `notSet` is the absence of a configured value, and a
      console that renders both as "אין" cannot tell an unconfigured limit
      from a limit of nothing. */
  notSet: "לא הוגדר",

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

  /* ── Costs, readiness and the inner delivery queue (overview) ──────── */

  /* The overview's budget region: the four meters of System & Security's
     costs sub-area, read there first. The labels mirror that sub-area's so
     the same meter never carries two names on the same console. */
  budgetsPanel: "תקציבים והוצאות",
  budgets: "תקציבים",
  costsRead: "תקציבי הפריסה",
  warnNotePrefix: "אזהרה ב",
  noBudget: "אין תקציב",
  noQueryBudget: "אין תקציב שאילתות",
  queries: "שאילתות",
  meterAiDaily: "AI, יומי",
  meterAiMonthly: "AI, חודשי",
  meterBriefingMonthly: "בריף, חודשי",
  meterSearchMonthly: "חיפוש, חודשי",
  ofTotal: "מתוך",
  integrations: "חיבורים",
  resourceIdentity: "זהות משאבים",
  fingerprintNote: "טביעות אצבע חד-כיווניות, להשוואה בין סביבות. סודות ומזהים מלאים אינם מוצגים כאן לעולם.",
  outboxPanel: "תור המסירה הפנימי",
  outboxUndelivered: "Outbox — לא נמסרו",
  outboxDeadLettered: "Outbox — נזנחו",
  outboxOldest: "הישן ביותר שלא נמסר",

  /* ── The draft preview (pipeline) ──────────────────────────────────── */

  /* The persisted draft artifact, read per Israel-local date. `draftWhat`
     is the definite form the absence sentences complete ("הפריסה הזו עדיין
     לא מגישה את …"). */
  draftPreview: "תצוגת טיוטה",
  draftWhat: "תצוגת הטיוטה",
  draftPreviewNote: "הנוסח שנוסח ונשמר למהדורה, לפני הפרסום — כפי שהקורא יקרא אותו.",
  headline: "כותרת",
  summary: "תקציר",
  body: "גוף הכתבה",
  date: "תאריך",

  /* ── The edition drilldown (pipeline) ──────────────────────────────── */

  /* One edition's full recovery payload, opened as an end-edge drawer from
     the editions list. */
  editionDetail: "פירוט המהדורה",
  editionDetailToggle: "פירוט",
  editionWhat: "פירוט המהדורה",
  editionDetailClose: "סגירת פירוט המהדורה",
  contractVersion: "גרסת חוזה",
  promptVersion: "גרסת פרומפט",
  opened: "נפתחה",
  closed: "נסגרה",
  publishedWord: "פורסמה",
  runsByStage: "ריצות לפי שלב",
  input: "נכנסו",
  output: "יצאו",
  duration: "משך",
  started: "התחילה",
  finished: "הסתיימה",
  aiRuns: "קריאות מודל לפי שלב",
  model: "מודל",
  profile: "פרופיל",
  tokensIn: "אסימוני קלט",
  tokensOut: "אסימוני פלט",
  latency: "השהיה",
  artifacts: "מוצרי ביניים",
  latestVersion: "הגרסה האחרונה לכל שלב",
  artifactVersion: "גרסה",
  payload: "מטען",
  details: "פרטים",
  claims: "טענות",
  layer: "שכבה",
  assessment: "הערכה מכונה",
  attributedTo: "ייחוס",
  uncertainty: "אי-ודאות",

  /* ── The fetch log (sources) ───────────────────────────────────────── */

  /* One source's fetch attempts, newest first, plus the same day's rollup —
     both from the one `fetches` read. */
  fetchLog: "יומן שליפות",
  fetchWhat: "יומן השליפות",
  fetchLogClose: "סגירת יומן השליפות",
  todayBlock: "היום",
  itemsSeen: "נראו",
  itemsNew: "חדשים",
  fetchesPartial: "חלקיות",
  fetchesFailed: "כושלות",
  boundaryAt: "גבול היום",
  bytes: "נפח",
  httpStatus: "HTTP",

  /* ── Recovery: outbox, maintenance, quarantine (system) ────────────── */

  /* The manual outbox drain: reversible, so it is asked for nothing. */
  drainNow: "ניקוז מיידי",
  drainFailure: "לא ניתן לנקז את תור המסירה.",
  outboxDrainNote: "מוציא את הרשומות הממתינות אל התור עכשיו, במקום לחכות לטיק. הפעולה הפיכה — מה שלא נמסר נשאר בתור.",
  /* The manual maintenance tick: the same run the cron does, on demand. */
  runMaintenance: "הרצת תחזוקה",
  maintenancePanel: "תחזוקה",
  maintenanceNote: "אותה ריצה שהקרון מריץ מדי רגע: שחזור משימות תקועות, ניקוי מפתחות אידמפוטנטיות והגבלות קצב, והערכת התראות.",
  maintenanceFailure: "לא ניתן להריץ את התחזוקה.",
  /* Quality-quarantine decisions: resolve without asking, discard only
     through the shared confirmation, with a note the audit log requires. */
  qualityQuarantine: "בידוד בקרת איכות",
  quarantineDecisionNote: "לכל רשומה שתי הכרעות: סימון כטופל כשהיא כבר מטופלת בפועל, או הסרה מהתור כשהיא לא תרוץ שוב. ההסרה מבקשת סיבה ליומן הביקורת.",
  discard: "הסרה מהתור",
  discardAction: "הסרת רשומת בידוד מהתור",
  discardConsequence: "הרשומה יוצאת מתור ההתאוששות ולא תרוץ שוב בשום סבב. אין לה פלט ואין מה להחזיר; הסיבה נרשמת ביומן הביקורת.",
  discardFailure: "לא ניתן להסיר את הרשומה מהתור.",
  quarantineResolveFailure: "לא ניתן לסמן את הרשומה כטופלה.",
  reason: "סיבה",
  reasonNote: "שורה אחת, ליומן הביקורת. חובה.",
  pendingDecision: "ממתינות להכרעה",

  /* ── The collection sweep (sources) ────────────────────────────────── */

  /* Budget-adjacent even though it is reversible, so it confirms — and sits
     in a zone of its own, last in the sources area. */
  collectNow: "איסוף מיידי",
  sweepTarget: "כל המקורות הפעילים בפריסה הזו",
  sweepConsequence: "סבב שליפה רץ עכשיו על כל המקורות הפעילים, מחוץ לתור המתוכנן, ומוציא מתקציב החיפוש והעיבוד. המקורות עצמם והגדרותיהם אינם משתנים, והמשימות שנכנסות ניתנות לניהול כרגיל מאזור התהליך.",
  sweepNote: "האיסוף המיידי מריץ סבב שליפה על כל המקורות הפעילים עכשיו, מחוץ לתור המתוכנן, ומוציא מתקציב החיפוש והעיבוד.",
  sweepPanelLabel: "פעולה שמוציאה תקציב",
  sweepFailure: "לא ניתן להתחיל את האיסוף המיידי.",
} as const;

/* ── The sentences panels report an operation back with ────────────────── */

/* The one-off result lines a `useOperations` notice carries. Numbers stay
   Latin inside Hebrew prose; see the rules at the top of this file. */
export const SENTENCE = {
  drained: (attempted: number, dispatched: number, failed: number) =>
    `נוסו ${attempted} רשומות, נמסרו ${dispatched}, נכשלו ${failed}.`,
  maintenanceDone: (recovered: number, evaluated: number, created: number) =>
    `התחזוקה הסתיימה: שוחזרו ${recovered} משימות, נבדקו ${evaluated} התראות, נוצרו ${created}.`,
  swept: (enqueued: number, alreadyCompleted: number, dispatchFailed: number) =>
    `האיסוף המיידי רץ: נכנסו לתור ${enqueued} מקורות, כבר הושלמו ${alreadyCompleted}${dispatchFailed ? `, נכשלה השליחה של ${dispatchFailed}` : ""}.`,
  sweepPaused: () => "העיבוד מושהה, ולכן הסבב לא הורץ. שום מקור לא נשלח.",
  quarantineResolved: (key: string) => `הרשומה ${key} סומנה כטופלה.`,
  quarantineDiscarded: (key: string) => `הרשומה ${key} הוסרה מתור ההתאוששות ולא תרוץ שוב.`,
  needReason: () => "נדרשת סיבה כדי להסיר רשומה מהתור. שום דבר לא שונה.",
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

  /* The draft route answers 404 for a day with no edition as well as for a
     route the deployment does not serve, so the unavailable state has two
     causes the read alone cannot tell apart. This line names the one the
     shared absence wording does not cover. */
  draftEditionAbsent: "ייתכן שאין מהדורה לתאריך הנבחר — המסלול מחזיר 404 גם עבור יום ללא מהדורה.",
} as const;

/* ── Formatting, Hebrew locale ────────────────────────────────────────── */

export const LOCALE = "he-IL";
