#!/usr/bin/env node
/**
 * Generates docs/project-map.html from the repository as it actually is.
 *
 * Every number, file count, size, route list, edge and violation on that page
 * is scanned here at run time. Nothing is typed by hand — which is the point:
 * a map with hand-copied counts drifts, and this repository has already been
 * bitten by exactly that (migration counts lived in four documents and two
 * were wrong).
 *
 *   node scripts/project-map.mjs           # write docs/project-map.html
 *   node scripts/project-map.mjs --check   # exit 1 if the file is out of date
 *
 * Only the *prose* is authored: each area's one-line purpose, in AREAS below.
 * An area with no entry renders as "לא מתועד" rather than silently vanishing,
 * so a new directory announces itself.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => join(ROOT, p);
const sh = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const read = (p) => { try { return readFileSync(R(p), "utf8"); } catch { return ""; } };

/* ── authored prose, keyed by path ─────────────────────────────────────── */
const AREAS = {
  "app": ["frontend", "כל המסלולים. שם התיקייה הוא ה־URL עצמו, ולכן העברה כאן משנה כתובת חיה."],
  "app/api": ["backend", "מטפלי מסלולים. כל אחד מפרסר, קורא למודול אחד דרך index.ts, ומסדר תשובה."],
  "app/admin": ["frontend", "לוח בקרה תפעולי בעברית מאחורי Neon Auth."],
  "app/auth": ["frontend", "כניסת X ציבורית. עלתה לאוויר בלי רשומת החלטה — ראה את דוח הביקורת."],
  "app/october-7": ["frontend", "מרכז, לא צומת ניווט. הארכיונים שתחתיו נגזרים מהאינדקסים."],
  "app/fake-resistance": ["frontend", "מרכז. שער הפרסום שלו הוא החלטה פתוחה של הבעלים."],
  "components": ["frontend", "תיקיות פיצ'ר. גרף הייבוא נפתר במלואו — אפס מפרטים בלתי־פתירים."],
  "components/particle-nav": ["frontend", "הרנדרר החי היחיד ושעון ציר הזמן היחיד. קנבס אחד לאינטרו ולניווט גם יחד."],
  "components/content": ["frontend", "אבני הבניין העריכותיות, והרשת שמושיבה ציטוט בשוליים ליד הרשומה שלו."],
  "components/sections": ["frontend", "שתי מעטפות: SectionPage לתיקים, DocPage לארכיון ולמדיניות."],
  "components/archive": ["frontend", "רנדרר אחד לשני הארכיונים בלי הסתעפות."],
  "components/chat": ["frontend", "משגר גלובלי, חלון נגיש, וקנבס שני שרק הדסקטופ משלם עליו."],
  "components/intro": ["frontend", "נתוני ציר זמן טהורים ודגימת טקסט ב־CPU. לא מרנדר דבר בעצמו."],
  "components/briefs": ["frontend", "התדריך הגאופוליטי — הפריסה הייחודית היחידה."],
  "components/support": ["frontend", "טפסים אינטראקטיביים ששולחים למסלול API ציבורי חי."],
  "components/home": ["frontend", "רצועת העמוד הראשי שמתחת לקיפול."],
  "components/graphics": ["stale", "חוזה לסצנה הצילומית שפרשה. בדיקה אחת מחזיקה אותו בחיים."],
  "lib": ["content", "תפר התוכן. סטטי היום, בנוי כך שמעבר לשאילתה ישנה גופי פונקציות ולא אתרי קריאה."],
  "lib/content": ["content", "מודול לכל משטח. כולם אסינכרוניים חוץ מ־home.ts."],
  "server": ["backend", "ה־API של מודל המידע. לעולם לא מייבא את הפרונטאנד."],
  "server/db": ["data", "סכימה, מיגרציות ומעבדת PGlite. חוקים עסקיים חיים ב־triggers לא פחות מב־TypeScript."],
  "server/modules": ["backend", "index.ts אל service.ts אל repo.ts. שניים מקפלים את ה־repo פנימה."],
  "server/core": ["backend", "קונפיגורציה, גרסאות, outbox, ביקורת, הרשאות ושער AI."],
  "server/contracts": ["bridge", "zod ותו לא. השכבה היחידה מ־server/ שהפרונטאנד רשאי לייבא."],
  "server/http": ["backend", "handler() עוטף כל מסלול ומחליף תפקיד בבסיס הנתונים לכל בקשה."],
  "server/jobs": ["backend", "צרכני התור. לא ניגשים לבסיס הנתונים ישירות."],
  "content-packages": ["content", "נתוני מקור מחויבים לגיט — לא פלט. המדיה עצמה לעולם לא נכנסת."],
  "docs": ["docs", "תיעוד עזר, שנכתב כדי להיות נכון ולא שאפתני."],
  "docs/archive": ["archive", "מסמכים שעשו את שלהם. שום דבר כאן אינו מקור אמת."],
  "tests": ["tests", "vitest מול PGlite — פוסטגרס אמיתי ב־WASM, ממוגרר לכל בדיקה."],
  "scripts": ["tests", "אימות, ייבוא ואפייה. חלקם דורשים Chrome אמיתי על macOS."],
  "public": ["data", "פלט אפוי וקורפוס. נטען לפי נתיב מילולי — שינוי שם שובר בשקט."],
  "assets": ["data", "מקורות אפייה — וגם ייבוא בזמן ריצה, ולכן זה נשלח."],
  ".ai": ["docs", "יומן הפרויקט ולולאת העבודה המשותפת לכל הסוכנים. DECISIONS הוא append-only; STATE נכתב מחדש במקומו."],
  ".claude": ["local", "סוכנים, hooks ומיומנויות. מוחרג מה־deploy."],
  ".design-sync": ["local", "צינור הייצוא של מערכת העיצוב. מונע מכלי חיצוני — אין npm script ואין שלב CI שמריץ אותו."],
  ".github": ["deploy", "CI: שער, ואז עשן מסלולים ללא ראש."],
  "app/geopolitical-brief": ["frontend", "התדריך הגאופוליטי. היעד היחיד עם פריסה משלו במקום מעטפת התיקים."],
  "app/israels-story": ["frontend", "הסיפור הישראלי. תיק קריאה על מעטפת SectionPage."],
  "app/war-update": ["frontend", "עדכון הלחימה. מפצל רכיב לקוח לסינון ולקישורים קבועים."],
  "app/we-are": ["frontend", "מי אנחנו. תיק קריאה."],
  "app/our-heroes": ["frontend", "הגיבורים. הדף היחיד שבו כרטיסים בגריד מוותרים על שולי הראיות."],
  "app/support-us": ["frontend", "תמיכה. מחזיק את שני הטפסים האינטראקטיביים היחידים באתר."],
  "app/corrections": ["frontend", "יומן תיקונים. מוגש מתפר שמחזיר רשימה ריקה — ריק כן, לא placeholder."],
  "app/methodology": ["frontend", "המתודולוגיה. דף מדיניות על מעטפת DocPage."],
  "app/particle-demo": ["frontend", "מעבדת הכוונון והנפילה־לאחור. חסום לזחלנים, ואף פעם לא נבדק בעשן."],
  "content-packages/october7": ["content", "עדויות october7.org. האינדקס הוא שמייצר את המסלולים, לא רשימה ידנית."],
  "content-packages/hamas-massacre": ["content", "תיעוד hamas-massacre.net. אפס חפיפת מזהים עם הארכיון השני."],
  "content-packages/fake-resistance": ["content", "תיקי המחקר. שום משיכת ראיות גולמית מעולם לא נכנסה לגיט."],
  "public/particles": ["data", "חוצצי LNP1 של האריה בשלוש רמות ביצועים. נטענים לפי נתיב מילולי."],
  "public/icons": ["data", "SDF לכל אחד משמונת צמתי הניווט. אפויים מ־assets/source/icons."],
  "public/posters": ["data", "הפוסטר לשכבת ה־no-WebGL, וגם כרטיס ה־OG. דטרמיניסטי."],
  "public/assets": ["data", "הגופן ל־Three.js. שני הצרכנים היחידים הם האינטרו ובדיקה אחת."],
  "public/matrix": ["data", "קורפוס הסריקה — תוכן עריכתי שנכתב ביד ויושב ב־public/."],
  "assets/reference": ["data", "תמונת הייחוס לאפיית האריה. גם ייבוא בזמן ריצה, ולכן נשלחת."],
  "assets/source": ["data", "אייקוני המקור. גם מקור אפייה וגם ייבוא של רכיבי React."],
  "scripts/particle-nav": ["tests", "האפייה הדטרמיניסטית: חוצצים, SDF ופוסטר. אותו זרע — אותם בתים."],
  ".claude/hooks": ["local", "כלי עזר מקומיים שאינם מופעלים אוטומטית."],
  ".claude/skills": ["local", "מיומנויות מקומיות אופציונליות."],
  ".design-sync/previews": ["local", "דוגמאות שימוש לחבילת מערכת העיצוב. מייבאות את שם החבילה הבנויה ולא את המקור המקומי, ולכן שום דבר במאגר לא מייבא אותן — הכלי החיצוני מוצא אותן לפי מוסכמת ספרייה."],
  ".design-sync/shims": ["local", "מתאמים שמאפשרים לרכיבים להיבנות מחוץ ל־Next."],
  ".github/workflows": ["deploy", "הגדרת ה־CI היחידה. שער, ואז עשן מסלולים."],
};

/* one line per file at the repository root */
const ROOTFILES = {
  "CLAUDE.md": ["docs", true, "תיעוד יישום. הוראת הבעלים גוברת על כל כלל היסטורי שבו."],
  "AGENTS.md": ["docs", true, "סמכות הבעלים היחיד ואזהרת Next.js המנוהלת שנשמרת ללא שינוי."],
  "README.md": ["docs", false, "דלת הכניסה: מה זה, איך מתקינים, איפה כל תחום."],
  "TODOS.md": ["docs", true, "תוכנית האספקה בעברית. המקום לבדוק בו מה נחשב לא גמור."],
  "PROJECT_STRUCTURE_AUDIT.md": ["docs", true, "ביקורת המבנה: כל אזור מסווג עם הוכחה, ומה הושאר להחלטת הבעלים."],
  "package.json": ["deploy", true, "התלויות והסקריפטים. אף סקריפט אינו מת; שתי תלויות פיתוח בלתי־מוזכרות הוסרו בביקורת."],
  "package-lock.json": ["deploy", false, "נעילת הגרסאות. אפס סחיפה מול package.json."],
  "tsconfig.json": ["deploy", false, "הגדרות TypeScript. מחריג כעת את התיקיות האוטומטיות, כך ש־typecheck מקומי תואם ל־CI."],
  "eslint.config.mjs": ["deploy", true, "הארכיטקטורה מנוסחת כשגיאות lint — מי רשאי לייבא את מי. לקרוא לפני העברת קוד בין שכבות."],
  "next.config.ts": ["deploy", false, "הגדרות Next. כותרות מטמון קבועות ל־/particles/ ול־/icons/ בלבד."],
  "vercel.json": ["deploy", true, "טריגר תור אחד וארבעה לוחות cron. כל החמישה מגיעים למטפלים אמיתיים."],
  "vitest.config.ts": ["tests", false, "הגדרות הבדיקות. ממפה את server-only למודול ריק במקום לתת לבדיקות להשמיט אותו."],
  "drizzle.config.ts": ["data", false, "מכוון את drizzle-kit לסכימה ולמיגרציות. דורש DATABASE_URL אמיתי; הבדיקות לא."],
  "proxy.ts": ["deploy", false, "www אל apex ב־308, ו־Neon Auth על /admin/*."],
  ".gitignore": ["deploy", false, "מה לא נכנס לגיט. .claude/worktrees נוסף בביקורת — קודם הוא הוחרג פר־clone בלבד."],
  ".vercelignore": ["deploy", false, "מה לא נשלח ב־deploy. חשוב במיוחד כאן: הפריסה ידנית, ולכן זה הסינון היחיד."],
  ".mcp.json": ["local", false, "רישום שרתי MCP לכלי פיתוח מקומיים."],
};
const SOT = new Set(["server/contracts","server/core","server/db","content-packages",
  "docs",".ai","assets",".github","components/particle-nav","components/intro"]);

/* ── scan ──────────────────────────────────────────────────────────────── */
/* Include untracked, non-ignored files so `map:check` catches a new area before
   it is staged or committed. The agent loop deliberately runs before either
   action, and a map that can only see committed structure would approve the
   exact drift it exists to prevent. */
const files = sh(["ls-files", "--cached", "--others", "--exclude-standard"])
  .split("\n")
  .filter(Boolean)
  .filter((file) => existsSync(R(file)));
const sizeOf = (p) => { try { return statSync(R(p)).size; } catch { return 0; } };
const human = (b) => b >= 1048576 ? (b/1048576).toFixed(b>=10485760?0:1)+"MB"
                   : b >= 1024 ? Math.round(b/1024)+"K" : b+"B";

function areaStats(prefix){
  const f = files.filter((p) => p === prefix || p.startsWith(prefix + "/"));
  return { files: f.length, bytes: f.reduce((n,p)=>n+sizeOf(p),0) };
}
const topDirs = [...new Set(files.filter(p=>p.includes("/")).map(p=>p.split("/")[0]))].sort();
const areas = [];
for (const d of topDirs) {
  const s = areaStats(d);
  const subs = [...new Set(files.filter(p=>p.startsWith(d+"/")&&p.split("/").length>2)
    .map(p=>d+"/"+p.split("/")[1]))].sort();
  areas.push({ path:d, ...s, subs: subs.map(x=>({path:x, ...areaStats(x)})) });
}
const rootFiles = files.filter(p=>!p.includes("/")).sort();

/* routes */
const pageFiles  = files.filter(p=>/^app\/.*\/page\.tsx$/.test(p) || p==="app/page.tsx");
const routeFiles = files.filter(p=>/^app\/.*\/route\.ts$/.test(p));
const dynamicPages = pageFiles.filter(p=>p.includes("["));
const staticPages  = pageFiles.length - dynamicPages.length;

/* migrations */
const migrations = files.filter(p=>/^server\/db\/migrations\/\d+.*\.sql$/.test(p)).sort();
let journalEntries = 0;
try { journalEntries = JSON.parse(read("server/db/migrations/meta/_journal.json")).entries.length; } catch {}
const snapshotIdx = files
  .map((p) => p.match(/^server\/db\/migrations\/meta\/(\d+)_snapshot\.json$/))
  .filter(Boolean).map((m) => Number(m[1]));
const snapshots = snapshotIdx.length;
/* A hand-written migration legitimately has no snapshot — drizzle only
   snapshots what it generates. So "snapshots === migrations" is the wrong
   test and reports normal practice as drift. What actually matters is whether
   the newest snapshot is behind the newest migration: if it is, `db:generate`
   diffs the schema against a stale baseline and re-emits changes those
   hand-written migrations already applied. */
const newestSnapshot = snapshotIdx.length ? Math.max(...snapshotIdx) : -1;
const newestMigration = migrations.length
  ? Math.max(...migrations.map((p) => Number(p.match(/(\d+)/)[1]))) : -1;
/* …but only if it actually changed the schema. Drizzle models tables,
   columns, indexes and foreign keys — nothing else. A migration that only
   grants, revokes, or defines a policy, function or trigger is invisible to
   it, so it leaves the baseline current and `db:generate` still emits nothing.
   Verified against `0022`, which is REVOKE/GRANT only: generate reported "No
   schema changes". Counting it as drift produced a false warning. */
const SCHEMA_DDL = /^\s*(CREATE|DROP)\s+(TABLE|INDEX|TYPE|SEQUENCE|VIEW)\b|^\s*ALTER\s+TABLE\b(?![^;]*\b(ENABLE|DISABLE|FORCE)\s+ROW\s+LEVEL)/im;
const handWrittenAfterSnapshot = migrations
  .map((p) => ({ idx: Number(p.match(/(\d+)/)[1]), name: p.split("/").pop(), path: p }))
  .filter((m) => m.idx > newestSnapshot)
  .filter((m) => SCHEMA_DDL.test(read(m.path).replace(/^\s*--.*$/gm, "")))
  .map((m) => m.name);

/* tests + scripts */
const testFiles = files.filter(p=>/^tests\/.*\.test\.ts$/.test(p));
const scriptFiles = files.filter(p=>/^scripts\//.test(p));
const CHROME_LITERAL = "Applications/Google Chrome.app";
const chromeScripts = [...scriptFiles, ".claude/skills/verify-intro/capture.mjs"]
  .filter(p=>files.includes(p))
  .filter(p=>{ const s=read(p); if(!s.includes(CHROME_LITERAL)) return false;
    // a mention inside a comment is not a use: require it to reach executablePath
    return /executablePath\s*:/.test(s); });

/* nav nodes */
const cfg = read("components/particle-nav/config.ts");
const navIds = [...cfg.matchAll(/id:\s*['"]([a-z0-9-]+)['"]/g)].map(m=>m[1]);
const navMissing = navIds.filter(id=>!files.includes(`app/${id}/page.tsx`));

/* PUBLIC_V1 */
const handler = read("server/http/handler.ts");
const pubBlock = handler.match(/const PUBLIC_V1 = \[([\s\S]*?)\] as const;/);
const publicRoutes = pubBlock
  ? pubBlock[1].split("\n").map((line) => {
      // Each entry is one line; a non-greedy match would stop inside [^/]+.
      const m = line.match(/\["(\w+)",\s*\/\^(.+)\$\/\]/);
      if (!m) return null;
      const path = m[2].replace(/\\\//g, "/").replace(/\[\^\/\]\+/g, "{id}");
      return `${m[1]} ${path}`;
    }).filter(Boolean)
  : [];

/* content packages */
const pkgs = [];
for (const d of readdirSync(R("content-packages"), {withFileTypes:true}).filter(e=>e.isDirectory())) {
  const name = d.name;
  let records = files.filter(p=>p.startsWith(`content-packages/${name}/records/`)).length;
  let cases = files.filter(p=>p.startsWith(`content-packages/${name}/cases/`)).length;
  let versions = 0;
  try {
    const idx = JSON.parse(read(`content-packages/${name}/index.json`));
    const arr = Array.isArray(idx) ? idx : (idx.records || idx.cases || idx.items || []);
    versions = arr.reduce((n,r)=>n+((r.available_languages||r.languages||[]).length||1),0);
  } catch {}
  pkgs.push({name, records: records||cases, versions, ...areaStats(`content-packages/${name}`)});
}

/* import edges + boundary violations */
const srcFiles = files.filter(p=>/\.(ts|tsx)$/.test(p) && !p.startsWith("tests/"));
const areaOf = (p) => {
  for (const a of ["server/contracts","server/db","server/modules","server/core","server/http",
                   "server/jobs","lib/content","app/api","app","components","lib","scripts"])
    if (p===a || p.startsWith(a+"/")) return a;
  return null;
};
// app/auth/** has a purpose-written carve-out in eslint.config.mjs. A scan that
// reports it as a violation is crying wolf; a scan that ignores the carve-out
// entirely would miss a real one. So it is detected, and reported separately.
const eslintCfg = read("eslint.config.mjs");
const carvedOut = [...eslintCfg.matchAll(/files:\s*\[["'`]([^"'`]*app\/auth[^"'`]*)["'`]\]/g)]
  .map((m) => m[1].replace(/\*\*.*$/, ""));
const isCarvedOut = (f) => carvedOut.some((c) => f.startsWith(c));
const edges = new Map(); const violations = []; const sanctioned = [];
for (const f of srcFiles) {
  const from = areaOf(f); if (!from) continue;
  const src = read(f);
  for (const m of src.matchAll(/from\s+["']@\/([^"']+)["']/g)) {
    const to = areaOf(m[1]); if (!to || to===from) continue;
    edges.set(`${from}→${to}`, (edges.get(`${from}→${to}`)||0)+1);
    if ((from==="app"||from==="components") && to.startsWith("server/") && to!=="server/contracts") {
      (isCarvedOut(f) ? sanctioned : violations).push({ file: f, imports: "@/" + m[1] });
    }
  }
}
const crossings = [...edges.entries()].map(([k,v])=>({edge:k,count:v}))
  .sort((a,b)=>b.count-a.count);

/* duplicate content, across every tracked file */
import { createHash } from "node:crypto";
const byHash = new Map();
for (const f of files) {
  const h = createHash("sha256").update(readFileSync(R(f))).digest("hex");
  (byHash.get(h) || byHash.set(h, []).get(h)).push(f);
}
const duplicateSets = [...byHash.values()].filter((g) => g.length > 1);

/* reachability: can anything actually get to this file?
 *
 * Written because "is anything here unnecessary" is a question a table of
 * classifications answers by assertion and a graph answers by measurement.
 * Entry points are the file conventions and the tools that read a path rather
 * than import it; everything else has to be reached. */
const EXT = ["", ".ts", ".tsx", ".mjs", ".js", ".json", "/index.ts", "/index.tsx"];
const tracked = new Set(files);
function resolveSpec(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = pathJoin(dirOf(from), spec);
  else return null;
  for (const e of EXT) if (tracked.has(base + e)) return base + e;
  return null;
}
const dirOf = (p) => p.split("/").slice(0, -1).join("/");
function pathJoin(dir, rel) {
  const out = dir ? dir.split("/") : [];
  for (const part of rel.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}
const entryPoints = files.filter((f) =>
  /^app\/.*(page|layout|route|loading|error|not-found|template|default)\.tsx?$/.test(f) ||
  /^app\/(sitemap|robots|manifest|opengraph-image)\.tsx?$/.test(f) ||
  /^app\/(icon|apple-icon|favicon)\.[a-z]+$/.test(f) ||
  /^(next\.config|proxy|drizzle\.config|vitest\.config|eslint\.config)\.(ts|mjs)$/.test(f) ||
  /^tests\/.*\.test\.ts$/.test(f) ||
  /^(scripts|content-packages)\//.test(f) ||
  /^server\/db\/migrations\//.test(f) ||
  /^\.(github|claude)\//.test(f) ||
  /* `.design-sync/` is driven from outside the repository: its previews import
     the *built* package name (`lions-of-zion`), not local source, and the
     Claude Design tool discovers them by directory convention. Nothing here
     imports them and nothing should — treating them as orphans would make the
     unreferenced count noise instead of a signal. */
  /^\.design-sync\//.test(f) ||
  /^(package|package-lock|tsconfig|vercel)\.json$/.test(f) ||
  /^\.(gitignore|vercelignore|mcp\.json)$/.test(f));
const reached = new Set(entryPoints);
const stack = [...entryPoints];
while (stack.length) {
  const f = stack.pop();
  if (!/\.(ts|tsx|mjs|js|css)$/.test(f)) continue;
  const src = read(f);
  const specs = [
    ...src.matchAll(/from\s+["']([^"']+)["']/g),
    ...src.matchAll(/^\s*import\s+["']([^"']+)["']/gm),
    ...src.matchAll(/import\s*\(\s*["']([^"']+)["']\s*\)/g),
    ...src.matchAll(/(?:composes:[^;]*from|@import)\s+["']([^"']+)["']/g),
  ].map((m) => m[1]);
  for (const spec of specs) {
    const r = resolveSpec(spec, f);
    if (r && !reached.has(r)) { reached.add(r); stack.push(r); }
  }
}
/* assets and documents are addressed by literal path or by link, not import */
const corpus = files.filter((f) => /\.(ts|tsx|mjs|js|css|json|md|html)$/.test(f)).map(read).join("\n");
for (const f of files) {
  if (reached.has(f)) continue;
  const base = f.split("/").pop();
  if (/^(public|assets)\//.test(f) && (corpus.includes("/" + f.replace(/^public\//, "")) || corpus.includes(base))) reached.add(f);
  if (/\.(md|html)$/.test(f) && (corpus.includes(base) || f === "README.md")) reached.add(f);
}
const unreferenced = files.filter((f) => !reached.has(f));

/* Do the documents describe files and commands that exist?
 *
 * Added because a stale path in a runbook is worse than no runbook, and
 * because this audit itself shipped one: `.ai/ROLLBACK.md` told you to roll
 * back `npm run build:lion-data`, a script that does not exist. Two exclusions
 * are deliberate — `app/loading.tsx` is named *because* it must not exist, and
 * `.ai/DECISIONS.md` is append-only, so it correctly names files that were
 * real when the decision was made. */
const npmScriptNames = new Set(Object.keys(JSON.parse(read("package.json")).scripts || {}));
const DOC_PATH = /`((?:app|components|lib|server|scripts|tests|public|assets|docs|\.ai|\.claude|\.github|content-packages)\/[A-Za-z0-9_@[\]/.-]*\.[a-z]{2,5})`/g;
const docProblems = [];
for (const d of files.filter((f) => f.endsWith(".md") && !f.startsWith("docs/archive/") && f !== ".ai/DECISIONS.md")) {
  const txt = read(d);
  for (const m of txt.matchAll(DOC_PATH)) {
    const target = m[1];
    if (target.includes("*") || target.includes("<") || target === "app/loading.tsx") continue;
    if (!tracked.has(target)) docProblems.push(`${d} → ${target}`);
  }
  for (const m of txt.matchAll(/npm run ([a-z:-]+)/g)) {
    if (!npmScriptNames.has(m[1])) docProblems.push(`${d} → npm run ${m[1]}`);
  }
}

/* Design-system prop contracts, checked against the real source types.
 *
 * `.design-sync/NOTES.md` calls this "the main re-sync risk in this repo" and
 * says nothing detects it: there is no library build, so the converter stubbed
 * every prop interface, and `cfg.dtsPropsFor` carries a hand-transcribed body
 * for all 21 components. A prop renamed in `components/**` would silently ship
 * a wrong contract to whoever codes against the design system.
 *
 * Uses the TypeScript parser rather than a regex — three regex attempts at
 * this produced two false positives, once by counting a nested type's fields
 * as top-level props. */
const dsProblems = [];
if (tracked.has(".design-sync/config.json")) {
  const ts = await import("typescript").then((m) => m.default ?? m).catch(() => null);
  const cfg = JSON.parse(read(".design-sync/config.json") || "{}");
  if (ts && cfg.dtsPropsFor) {
    const parse = (t) => ts.createSourceFile("x.ts", t, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const namedType = (sf, n) => { let r = null;
      const walk = (x) => { if (r) return;
        if (ts.isTypeAliasDeclaration(x) && x.name.text === n && ts.isTypeLiteralNode(x.type)) r = x.type.members;
        else if (ts.isInterfaceDeclaration(x) && x.name.text === n) r = x.members;
        else ts.forEachChild(x, walk); };
      ts.forEachChild(sf, walk); return r; };
    const inlineType = (sf, comp) => { let r = null;
      const walk = (x) => { if (r) return;
        if (ts.isFunctionDeclaration(x) && x.name?.text === comp &&
            x.parameters[0]?.type && ts.isTypeLiteralNode(x.parameters[0].type)) r = x.parameters[0].type.members;
        else ts.forEachChild(x, walk); };
      ts.forEachChild(sf, walk); return r; };
    const keys = (m) => (m ? m.filter((x) => x.name).map((x) => x.name.getText()) : null);
    for (const [name, body] of Object.entries(cfg.dtsPropsFor)) {
      const src = cfg.componentSrcMap?.[name];
      if (!src || !tracked.has(src)) { dsProblems.push(`${name}: no source path`); continue; }
      const sf = parse(read(src));
      const actual = keys(namedType(sf, `${name}Props`)) ?? keys(inlineType(sf, name)) ?? [];
      const declared = keys(namedType(parse(`type P={${body}};`), "P")) ?? [];
      const A = new Set(actual), B = new Set(declared);
      const missing = [...A].filter((k) => !B.has(k));
      const extra = [...B].filter((k) => !A.has(k));
      if (missing.length || extra.length)
        dsProblems.push(`${name}: source-only [${missing}] config-only [${extra}]`);
    }
  }
}

/* npm scripts + ignored dirs */
const pkg = JSON.parse(read("package.json"));
const gitignored = read(".gitignore").split("\n")
  .map(l=>l.trim()).filter(l=>l && !l.startsWith("#") && l.endsWith("/"));

const D = {
  generatedAt: new Date().toISOString().slice(0,16).replace("T"," "),
  head: sh(["log","-1","--format=%h"]),
  headSubject: sh(["log","-1","--format=%s"]),
  branch: sh(["rev-parse","--abbrev-ref","HEAD"]),
  totalFiles: files.length,
  totalBytes: files.reduce((n,p)=>n+sizeOf(p),0),
  areas, rootFiles, AREAS, ROOTFILES, SOT: [...SOT],
  pages: pageFiles.length, staticPages, dynamicPages: dynamicPages.length,
  apiRoutes: routeFiles.length,
  migrations: migrations.length, journalEntries, snapshots,
  newestSnapshot, newestMigration, handWrittenAfterSnapshot,
  tests: testFiles.length, scripts: scriptFiles.length,
  chromeScripts, navIds, navMissing, publicRoutes, pkgs,
  crossings, violations, sanctioned, carvedOut, gitignored,
  duplicateSets, unreferenced, reachable: reached.size, docProblems, dsProblems,
  npmScripts: Object.keys(pkg.scripts||{}).length,
};


/* ── render ────────────────────────────────────────────────────────────── */
const esc = (t) => String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const LAYERS = { frontend:"פרונטאנד", backend:"בקאנד", content:"תוכן", data:"נתונים",
  tests:"בדיקות", docs:"תיעוד", deploy:"תשתית", local:"מקומי", bridge:"גשר",
  archive:"ארכיון", stale:"מיושן" };

/* node ids used by the diagrams, resolved against live data */
const N = {};
const put = (k, title, meta, body, keys="") => { N[k] = [title, meta, body, keys]; };
const A = (path) => AREAS[path] ? AREAS[path][1] : "לא מתועד";
const stat = (path) => { const f = files.filter(p=>p===path||p.startsWith(path+"/"));
  return `${f.length} קבצים · ${human(f.reduce((n,q)=>n+sizeOf(q),0))}`; };

put("app","app/",stat("app"),A("app"),`${D.pages} page.tsx · ${D.apiRoutes} route.ts`);
put("components","components/",stat("components"),A("components"));
put("libcontent","lib/content/",stat("lib/content"),A("lib/content"));
put("packages","content-packages/",stat("content-packages"),A("content-packages"),
  D.pkgs.map(p=>`${p.name}: ${p.records} רשומות`).join(" · "));
put("contracts","server/contracts/",stat("server/contracts"),A("server/contracts"));
put("api","app/api/",`${D.apiRoutes} מסלולים`,A("app/api"));
put("handler","server/http/handler.ts","",A("server/http"));
put("modules","server/modules/",stat("server/modules"),A("server/modules"));
put("db","server/db/",`${D.migrations} מיגרציות`,A("server/db"));
put("req","בקשה נכנסת","","כל בקשה ל־/api/ עוברת דרך handler.ts לפני שגוף המסלול רץ.");
put("accessfor","accessFor()","נקודת ההכרעה היחידה",
  "מסווגת את הבקשה לאחד משלושה תפקידים בבסיס הנתונים. גוף המסלול לא מחליט על הרשאות.");
put("pub","app_public",`${D.publicRoutes.length} נתיבים`,
  `PUBLIC_V1 נסרק מ־handler.ts והוא בדיוק ${D.publicRoutes.length} כניסות. שום דבר אחר אינו אנונימי.`,
  D.publicRoutes.join(" · "));
put("staff","app_staff","ברירת המחדל",
  "כל שאר /api/v1/ עובר authenticateAdmin ונכשל סגור. התיעוד סימן כתריסר מהם כאנונימיים — שגוי לכיוון המחמיר.");
put("svc","app_service","cron ותור","נתיבי cron ותור בלבד, מאומתים ב־CRON_SECRET.");
put("setrole","SET ROLE + RLS","",
  "חיבור ייעודי מהבריכה, SET ROLE ו־set_config('app.identity'), ובשחרור RESET ALL. זה המנגנון שמפעיל את מדיניות ה־RLS בפועל.");
put("gsp","generateStaticParams","נגזר מהאינדקס",
  "האינדקסים של החבילות מייצרים את רשימת המסלולים. רשומה חדשה נכנסת לאתר בלי לגעת בקוד.");
const totalRecords = D.pkgs.reduce((n,p)=>n+p.records,0);
const totalVersions = D.pkgs.reduce((n,p)=>n+p.versions,0);
put("pages",`${totalVersions.toLocaleString("en")} דפים`,"מוכנים מראש",
  `${totalRecords} רשומות בשלוש חבילות מתפרשות ל־${totalVersions} גרסאות שפה, וכל אחת היא דף.`);
put("nav","defaultNodes",`${D.navIds.length} יעדים`,
  D.navMissing.length ? `אזהרה: ${D.navMissing.join(", ")} ללא page.tsx תואם.`
  : `נסרק מ־config.ts. לכל אחד מ־${D.navIds.length} המזהים יש app/<id>/page.tsx תואם — נבדק.`,
  D.navIds.join(" · "));
put("ci","CI על Ubuntu",`${D.tests} קובצי בדיקה`,
  "typecheck, lint, הבדיקות ו־build — ואז עשן מסלולים עם Chromium מובנה.");
put("mac","רק על macOS",`${D.chromeScripts.length} סקריפטים`,
  `נסרקו לפי נעילת נתיב Chrome מוחלט יחד עם executablePath — אזכור בהערה בלבד לא נספר.`,
  D.chromeScripts.join(" · "));
put("nojs","invariant ללא JavaScript","לא מכוסה ב־CI",
  "CLAUDE.md מסמן אותו כנושא משקל, אבל ci-smoke רץ עם JavaScript דלוק ואף בדיקה לא מזכירה loading.tsx. השומר היחיד דורש Chrome אמיתי על macOS.");

const box=(k,x,y,w=180,h=56,cls="")=>{const v=N[k];if(!v)return"";
  const ty=v[1]?y+h/2-3:y+h/2+4;
  return `<g class="n ${cls}" data-k="${k}" tabindex="0" role="button" aria-label="${esc(v[0])}">`+
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>`+
    `<text class="t" x="${x+w/2}" y="${ty}" text-anchor="middle">${esc(v[0])}</text>`+
    (v[1]?`<text class="m" x="${x+w/2}" y="${y+h/2+14}" text-anchor="middle">${esc(v[1])}</text>`:"")+
    `</g>`;};
const ar=(id,x1,y1,x2,y2,label,lx,ly,dash)=>
  `<line class="a" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${dash?' stroke-dasharray="5 4"':''} marker-end="url(#${id})"/>`+
  (label?`<text class="al" x="${lx??(x1+x2)/2}" y="${ly??(y1+y2)/2-7}" text-anchor="middle">${esc(label)}</text>`:"");
const mk=(id)=>`<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker></defs>`;

const d1=`<svg viewBox="0 0 900 372" role="img" aria-label="הייבוא היחיד שחוצה בין שתי החציים">${mk("m1")}
<line class="wall" x1="450" y1="16" x2="450" y2="112"/><line class="wall" x1="450" y1="184" x2="450" y2="348"/>
<text class="wl" x="450" y="366" text-anchor="middle">eslint.config.mjs — הגבול נאכף כשגיאת lint</text>
<text class="al" x="450" y="100" text-anchor="middle">${D.violations.length===0?"אפס הפרות — נסרק":"אזהרה: "+D.violations.length+" הפרות"}</text>
${box("app",70,30)}${box("components",70,110)}${box("libcontent",70,190)}${box("packages",70,270)}
${box("api",650,30)}${box("handler",650,110)}${box("modules",650,190)}${box("db",650,270)}
${box("contracts",340,110,220,56,"acc")}
${[86,166,246].map(y=>ar("m1",160,y,160,y+22)+ar("m1",740,y,740,y+22)).join("")}
${ar("m1",250,138,336,138)}${ar("m1",650,138,564,138)}
<text class="al" x="140" y="352" text-anchor="middle">קריאה בזמן build</text></svg>`;

const d2=`<svg viewBox="0 0 900 268" role="img" aria-label="כל בקשה מקבלת תפקיד לפני שהמסלול רץ">${mk("m2")}
${box("req",24,100,150)}${ar("m2",174,128,214,128)}${box("accessfor",214,100,170,56,"acc")}
${box("pub",470,16,170)}${box("staff",470,100,170)}${box("svc",470,184,170)}
${ar("m2",384,120,466,52,D.publicRoutes.length+" נתיבים",428,78)}
${ar("m2",384,128,466,128,"נכשל סגור",428,122)}
${ar("m2",384,136,466,212,"cron · תור",428,190)}
${ar("m2",640,44,700,110)}${ar("m2",640,128,700,128)}${ar("m2",640,212,700,146)}
${box("setrole",700,100,176,56,"acc")}
<text class="al" x="788" y="180" text-anchor="middle">ובשחרור — RESET ALL</text></svg>`;

const d3=`<svg viewBox="0 0 900 216" role="img" aria-label="הדפים נגזרים מהנתונים">${mk("m3")}
${box("packages",24,40,196)}${ar("m3",220,68,262,68)}${box("libcontent",262,40,176)}
${ar("m3",438,68,480,68)}${box("gsp",480,40,180)}${ar("m3",660,68,702,68)}
${box("pages",702,40,174,56,"acc")}${box("nav",262,142,176)}
${ar("m3",438,170,700,170,D.navIds.length+" יעדים מתוחזקים ביד",560,163)}${ar("m3",789,138,789,102)}</svg>`;

const d4=`<svg viewBox="0 0 900 250" role="img" aria-label="ה־invariant היחיד ש־CI לא רואה">${mk("m4")}
${box("ci",24,30,200)}${box("mac",24,158,200)}
<rect class="lane" x="264" y="20" width="300" height="76" rx="7"/>
<text class="lt" x="414" y="46" text-anchor="middle">typecheck · lint · ${D.tests} קובצי בדיקה · build</text>
<text class="lt" x="414" y="70" text-anchor="middle">ci-smoke</text>
<text class="lm" x="414" y="88" text-anchor="middle">רץ עם JavaScript דלוק</text>
<rect class="lane" x="264" y="148" width="300" height="76" rx="7"/>
<text class="lt" x="414" y="174" text-anchor="middle">Chrome אמיתי · headless: false</text>
<text class="lt" x="414" y="198" text-anchor="middle">final-verify.mjs</text>
<text class="lm" x="414" y="216" text-anchor="middle">javaScriptEnabled: false</text>
${ar("m4",224,60,260,60)}${ar("m4",224,188,260,188)}
${box("nojs",620,96,250,60,"gap")}${ar("m4",564,186,616,140)}
<line class="a broken" x1="564" y1="58" x2="596" y2="86" stroke-dasharray="5 4"/>
<g class="x"><line x1="600" y1="82" x2="616" y2="98"/><line x1="616" y1="82" x2="600" y2="98"/></g>
<text class="al" x="556" y="242" text-anchor="middle">השומר היחיד — ורק על תחנת העבודה</text></svg>`;

const FIGS=[
 ["שתי חציים, ודלת אחת בקיר",d1,
  `המאגר מחזיק אתר חלקיקים ו־API שלא חולקים אף קובץ מקור. הפרונטאנד רשאי לייבא שכבה אחת בלבד מ־<code>server/</code> — את החוזים. הסריקה מצאה <b>${D.violations.length}</b> הפרות של הגבול הזה, ועוד <b>${D.sanctioned.length}</b> ייבואים תחת ה־carve-out המתועד של <code>app/auth/</code>.`],
 ["כל בקשה מקבלת תפקיד לפני שהמסלול רץ",d2,
  `<code>accessFor()</code> היא נקודת ההכרעה היחידה. <code>PUBLIC_V1</code> נסרק מהקוד והוא בדיוק ${D.publicRoutes.length} כניסות; כל השאר נכשל סגור.`],
 ["הדפים נגזרים מהנתונים, לא נכתבים ביד",d3,
  `${totalRecords} רשומות בשלוש חבילות מתפרשות ל־${totalVersions} גרסאות שפה. האינדקס מייצר את המסלולים, ולכן רשומה חדשה נכנסת בלי לגעת בקוד. ${D.navIds.length} היעדים בניווט, לעומת זאת, מתוחזקים ביד.`],
 ["ה־invariant היחיד ש־CI לא יכול לראות",d4,
  `${D.chromeScripts.length} סקריפטים נועלים נתיב Chrome מוחלט ורצים רק על תחנת העבודה. אחד מהם הוא הבדיקה היחידה שרצה בלי JavaScript — כלומר רגרסיה שם עוברת את CI בשקט.`],
];

const layerOf=(p)=>AREAS[p]?AREAS[p][0]:"local";
const treeHtml = areas.map(a=>{
  const sot=SOT.has(a.path);
  const subs=a.subs.map(sb=>
    `<button class="it sub n" data-k="dir:${esc(sb.path)}"><span class="nm">${esc(sb.path.split("/")[1])}/</span>`+
    `<span class="cn">${sb.files}</span></button>`).join("");
  return `<div class="grp"><button class="it head n" data-k="dir:${esc(a.path)}">`+
    `<span class="dot l-${layerOf(a.path)}"></span><span class="nm">${esc(a.path)}/</span>`+
    (sot?`<span class="st">★</span>`:"")+
    `<span class="cn">${a.files} · ${human(a.bytes)}</span></button>`+
    (subs?`<div class="subs">${subs}</div>`:"")+`</div>`;}).join("");
const rootHtml = rootFiles.map(f=>{
  const r=ROOTFILES[f]||["local",false,"לא מתועד"];
  return `<button class="it n" data-k="file:${esc(f)}"><span class="dot l-${r[0]}"></span>`+
    `<span class="nm">${esc(f)}</span>${r[1]?'<span class="st">★</span>':''}</button>`;}).join("");

for (const a of areas){ N["dir:"+a.path]=[a.path+"/", `${a.files} קבצים · ${human(a.bytes)} · ${LAYERS[layerOf(a.path)]}`, A(a.path), a.subs.map(s=>s.path.split("/")[1]+"/").join(" · ")];
  for (const sb of a.subs) N["dir:"+sb.path]=[sb.path+"/", `${sb.files} קבצים · ${human(sb.bytes)}`, A(sb.path), ""]; }
for (const f of rootFiles){ const r=ROOTFILES[f]||["local",false,"לא מתועד"];
  N["file:"+f]=[f, `${human(sizeOf(f))} · ${LAYERS[r[0]]}${r[1]?" · מקור אמת":""}`, r[2], ""]; }

const findings = [
  [D.violations.length===0, `אפס הפרות של גבול הייבוא בין הפרונטאנד ל־server/`, `${D.violations.length} הפרות: ${D.violations.map(v=>v.file).join(", ")}`],
  [D.navMissing.length===0, `לכל ${D.navIds.length} יעדי הניווט יש page.tsx תואם`, `חסר page.tsx ל: ${D.navMissing.join(", ")}`],
  [D.migrations===D.journalEntries, `${D.migrations} מיגרציות תואמות ל־journal`, `סחיפה בין הקבצים ל־journal`],
  [D.handWrittenAfterSnapshot.length===0,
   `בסיס ה־snapshots עדכני — db:generate לא יפלוט מיגרציה מיותרת`,
   `ה־snapshot האחרון הוא ${String(D.newestSnapshot).padStart(4,"0")} אבל יש ${D.handWrittenAfterSnapshot.length} מיגרציות כתובות־ביד אחריו (${D.handWrittenAfterSnapshot.join(", ")}). ` +
   `‏db:generate ישווה מול בסיס מיושן ויפלוט מחדש שינוי שכבר הוחל. חסר snapshot, לא חסרה מיגרציה.`],
  [D.dsProblems.length===0,
   `חוזי ה־props של מערכת העיצוב תואמים לטיפוסי המקור`,
   `${D.dsProblems.length} רכיבים שבהם dtsPropsFor נסחף מהמקור: ${D.dsProblems.join(" · ")}`],
  [D.docProblems.length===0,
   `כל נתיב וכל פקודת npm שמוזכרים בתיעוד קיימים`,
   `${D.docProblems.length} הפניות מתות בתיעוד: ${D.docProblems.join(" · ")}`],
  [D.duplicateSets.length===0, `אפס קבצים כפולים — כל ${D.totalFiles.toLocaleString("en")} הקבצים בעלי תוכן שונה`,
   `${D.duplicateSets.length} קבוצות של קבצים זהים בייט־בייט: ${D.duplicateSets.map(g=>g.join(" = ")).join(" · ")}`],
  [D.unreferenced.length===0, `כל קובץ נגיע אליו מנקודת כניסה`,
   `${D.reachable} מתוך ${D.totalFiles} נגישים; ${D.unreferenced.length} לא מוזכרים בשום מקום — ${
     Object.entries(D.unreferenced.reduce((a,f)=>{const k=f.split("/").slice(0,2).join("/");a[k]=(a[k]||0)+1;return a;},{}))
       .sort((x,y)=>y[1]-x[1]).map(([k,v])=>`${k} (${v})`).join(", ")}`],
].map(([ok,good,bad])=>`<li class="${ok?"ok":"warn"}">${ok?good:bad}</li>`).join("");

const html=`<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>מפת אריות ציון</title>
<style>
:root{
 --bg:#0d0c0b;--panel:#161514;--line:#2b2825;--ink:#c4c4c4;--ink-hi:#eeeeee;--lo:#929292;
 --gold:#c9a24b;--gold-hi:#efd79a;--acc:#57a7d9;--warn:#a85a61;--ok:#7fb894;--soft:#111010;
 --sh:0 1px 2px rgba(0,0,0,.6),0 12px 34px rgba(0,0,0,.45)}
@media(prefers-color-scheme:light){:root:not([data-theme=dark]){
 --bg:#f7f5f1;--panel:#fff;--line:#ded8ce;--ink:#26231f;--ink-hi:#0f0e0d;--lo:#6b645b;
 --gold:#8a6d2f;--gold-hi:#6d5423;--acc:#2f6b96;--warn:#8d4048;--ok:#3d6b4a;--soft:#efece6;
 --sh:0 1px 2px rgba(0,0,0,.05),0 10px 30px rgba(0,0,0,.07)}}
:root[data-theme=light]{
 --bg:#f7f5f1;--panel:#fff;--line:#ded8ce;--ink:#26231f;--ink-hi:#0f0e0d;--lo:#6b645b;
 --gold:#8a6d2f;--gold-hi:#6d5423;--acc:#2f6b96;--warn:#8d4048;--ok:#3d6b4a;--soft:#efece6;
 --sh:0 1px 2px rgba(0,0,0,.05),0 10px 30px rgba(0,0,0,.07)}
*{box-sizing:border-box}
html,body{direction:rtl}
body{margin:0;background:var(--bg);color:var(--ink);padding-bottom:150px;
 font:16px/1.7 "IBM Plex Sans Hebrew","Assistant","Segoe UI",system-ui,-apple-system,sans-serif;
 -webkit-font-smoothing:antialiased}
code,.nm{direction:ltr;unicode-bidi:isolate;
 font-family:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em}
h1,h2{font-family:"Frank Ruhl Libre","IBM Plex Sans Hebrew",Georgia,serif;text-wrap:balance}
.wrap{max-width:1060px;margin:0 auto;padding:0 26px}
header{padding-top:40px}
h1{margin:0 0 8px;font-size:clamp(1.7rem,4vw,2.2rem);font-weight:600;line-height:1.15;color:var(--ink-hi)}
.sub{color:var(--lo);max-width:64ch}
.gen{margin-top:10px;font-size:12.5px;color:var(--lo)}
.stats{display:flex;flex-wrap:wrap;gap:9px;margin:18px 0 30px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:7px 13px;font-size:13px;color:var(--lo)}
.stat b{color:var(--ink);font-weight:700}
.fig{margin:0 0 30px;background:var(--panel);border:1px solid var(--line);border-radius:13px;box-shadow:var(--sh);overflow:hidden}
.fig h2{margin:0;padding:19px 24px 15px;font-size:1.2rem;font-weight:500;color:var(--ink-hi);border-bottom:1px solid var(--line)}
.canvas{padding:22px 20px;overflow-x:auto;background:var(--soft)}
.canvas svg{display:block;width:100%;min-width:640px;max-width:900px;height:auto;margin:0 auto;color:var(--ink);direction:ltr}
figcaption{padding:16px 24px 20px;color:var(--lo);font-size:14.5px;border-top:1px solid var(--line)}
svg text{unicode-bidi:plaintext}
svg .n rect{fill:var(--panel);stroke:var(--line);stroke-width:1.5;transition:.14s}
svg .n .t{font-size:12.5px;font-weight:600;fill:var(--ink);font-family:ui-monospace,Menlo,monospace}
svg .n .m{font-size:11px;fill:var(--lo);font-family:"Segoe UI",system-ui,sans-serif}
svg .n{cursor:pointer;outline:none}
svg .n:hover rect,svg .n:focus-visible rect{stroke:var(--acc);stroke-width:2.5}
svg .n.sel rect{stroke:var(--acc);stroke-width:2.5;fill:color-mix(in srgb,var(--acc) 9%,var(--panel))}
svg .n.acc rect{stroke:var(--gold);stroke-width:2}svg .n.acc .t{fill:var(--gold-hi)}
svg .n.gap rect{stroke:var(--warn);stroke-width:2;fill:color-mix(in srgb,var(--warn) 8%,var(--panel))}
svg .n.gap .t{fill:var(--warn)}
svg .a{stroke:var(--lo);stroke-width:1.6;fill:none}svg marker path{fill:var(--lo)}
svg .al{font-size:11px;fill:var(--lo);font-family:"Segoe UI",system-ui,sans-serif}
svg .wall{stroke:var(--warn);stroke-width:2;stroke-dasharray:7 5;opacity:.75}
svg .wl{font-size:11px;fill:var(--warn);font-family:"Segoe UI",system-ui,sans-serif}
svg .lane{fill:none;stroke:var(--line);stroke-width:1.5;stroke-dasharray:4 4}
svg .lt{font-size:11.5px;fill:var(--ink);font-family:"Segoe UI",system-ui,sans-serif}
svg .lm{font-size:11px;fill:var(--lo);font-style:italic;font-family:"Segoe UI",system-ui,sans-serif}
svg .broken{stroke:var(--warn);opacity:.6}svg .x line{stroke:var(--warn);stroke-width:2.4;stroke-linecap:round}
h2.sec{font-size:1.35rem;font-weight:500;color:var(--ink-hi);margin:38px 0 6px}
p.secsub{color:var(--lo);margin:0 0 16px;font-size:14px}
.grp{margin-bottom:8px;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.it{display:flex;align-items:center;gap:9px;width:100%;padding:10px 14px;background:none;border:0;
 color:inherit;font:inherit;cursor:pointer;text-align:start}
.it:hover,.it:focus-visible{background:color-mix(in srgb,var(--acc) 8%,transparent);outline:none}
.it.sel{background:color-mix(in srgb,var(--acc) 14%,transparent)}
.it.head .nm{font-weight:650}
.subs{border-top:1px dashed var(--line);padding:4px 0}
.it.sub{padding-inline-start:34px;font-size:13.5px;color:var(--lo)}
.cn{margin-inline-start:auto;font-size:11.5px;font-variant-numeric:tabular-nums;color:var(--lo);direction:ltr;unicode-bidi:isolate}
.st{color:var(--gold);font-size:12px}
.stat b{font-variant-numeric:tabular-nums}
.dot{width:9px;height:9px;border-radius:50%;flex:0 0 9px}
.l-frontend{background:var(--acc)}.l-backend{background:var(--ok)}.l-content{background:var(--gold)}
.l-data{background:var(--gold)}.l-tests{background:var(--warn)}.l-docs{background:var(--lo)}
.l-deploy{background:var(--warn)}.l-local{background:var(--lo)}.l-bridge{background:var(--gold-hi)}
.l-archive{background:var(--lo)}.l-stale{background:var(--warn)}
.rootgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:6px}
.rootgrid .it{background:var(--panel);border:1px solid var(--line);border-radius:9px}
ul.f{list-style:none;padding:0;margin:0}
ul.f li{padding:9px 14px;border-radius:8px;margin-bottom:6px;font-size:14px;border:1px solid var(--line);background:var(--panel)}
ul.f li.ok{border-inline-start:3px solid var(--ok)}
ul.f li.warn{border-inline-start:3px solid var(--warn);color:var(--warn)}
.gens{display:flex;flex-wrap:wrap;gap:6px;direction:ltr}
.gens code{padding:3px 9px;border:1px dashed var(--line);border-radius:5px;color:var(--lo)}
#d{position:fixed;inset-inline:0;bottom:0;background:var(--panel);border-top:2px solid var(--acc);
 box-shadow:0 -8px 26px rgba(0,0,0,.12);padding:16px 26px 18px;z-index:20}
#d[hidden]{display:none}
#d .in{max-width:1060px;margin:0 auto;position:relative}
#d .dt{font-size:15px;font-weight:700;direction:ltr;unicode-bidi:isolate;text-align:left;font-family:ui-monospace,Menlo,monospace}
#d .dm{font-size:12px;color:var(--lo);margin:2px 0 8px}
#d .dp{font-size:14.5px;max-width:80ch}
#d .dk{margin-top:8px;font-size:12px;color:var(--lo);direction:ltr;unicode-bidi:isolate;text-align:left;
 font-family:ui-monospace,Menlo,monospace;max-height:56px;overflow-y:auto}
#d button{position:absolute;inset-inline-end:0;top:0;background:none;border:1px solid var(--line);
 color:var(--lo);border-radius:6px;padding:3px 10px;cursor:pointer;font:inherit;font-size:13px}
footer{color:var(--lo);font-size:13px;border-top:1px solid var(--line);margin-top:34px;padding-top:16px}
</style></head><body>
<div class="wrap">
<header>
 <h1>מפת אריות ציון</h1>
 <p class="sub">נוצר מסריקה של המאגר עצמו. כל מספר, גודל, מסלול, קשת והפרה בדף הזה נמדדו בזמן הרצה — שום דבר לא הוקלד ביד. ריחוף או לחיצה על כל פריט פותחים את ההסבר שלו.</p>
 <p class="gen">נסרק ${D.generatedAt} · <code>${D.head}</code> · ענף <code>${D.branch}</code> · הרצה חוזרת: <code>npm run map</code></p>
 <div class="stats">
  <span class="stat"><b>${D.totalFiles.toLocaleString("en")}</b> קבצים במעקב</span>
  <span class="stat"><b>${human(D.totalBytes)}</b></span>
  <span class="stat"><b>${totalVersions.toLocaleString("en")}</b> דפי ארכיון</span>
  <span class="stat"><b>${D.apiRoutes}</b> מסלולי API</span>
  <span class="stat"><b>${D.tests}</b> קובצי בדיקה</span>
  <span class="stat"><b>${D.migrations}</b> מיגרציות</span>
  <span class="stat"><b>${D.npmScripts}</b> סקריפטים</span>
 </div>
</header>
${FIGS.map(([t,svg,cap])=>`<figure class="fig"><h2>${t}</h2><div class="canvas">${svg}</div><figcaption>${cap}</figcaption></figure>`).join("")}
<h2 class="sec">כל תיקייה</h2>
<p class="secsub">כל תיקייה ותת־תיקייה במאגר, עם הסבר. ★ מסמן מקור אמת לנושא שלו.</p>
${treeHtml}
<h2 class="sec">כל קובץ בשורש</h2>
<p class="secsub">שבעה־עשר הקבצים שיושבים ישירות בשורש, כל אחד ומה שהוא מחליט.</p>
<div class="rootgrid">${rootHtml}</div>
<h2 class="sec">מה הסריקה מצאה</h2>
<p class="secsub">נבדק בזמן ההרצה הזו, לא הוקלד.</p>
<ul class="f">${findings}</ul>
<h2 class="sec">נוצר אוטומטית — לא נכנס לגיט</h2>
<p class="secsub">נקרא מ־<code>.gitignore</code>. תלויות חיצוניות אינן מופיעות כצמתים בשום מקום בדף.</p>
<div class="gens">${gitignored.map(g=>`<code>${esc(g)}</code>`).join("")}</div>
<footer>נוצר על ידי <code>scripts/project-map.mjs</code>. אין לערוך את הקובץ הזה ביד — הרץ <code>npm run map</code>.
 ‏<code>npm run map:check</code> נכשל אם הדף אינו תואם לעץ, כדי שסחיפה תתגלה ולא תצטבר.</footer>
</div>
<div id="d" hidden><div class="in"><button id="dx" type="button">סגירה</button>
 <div class="dt" id="dt"></div><div class="dm" id="dm"></div><div class="dp" id="dp"></div><div class="dk" id="dk"></div></div></div>
<script>
const N=${JSON.stringify(N)};
const d=document.getElementById("d"),dt=document.getElementById("dt"),dm=document.getElementById("dm"),
      dp=document.getElementById("dp"),dk=document.getElementById("dk");
let pin=null;
const show=k=>{const v=N[k];if(!v)return;dt.textContent=v[0];dm.textContent=v[1]||"";
  dp.textContent=v[2];dk.textContent=v[3]||"";d.hidden=false;};
const clr=()=>{if(!pin)d.hidden=true;};
const unsel=()=>document.querySelectorAll(".sel").forEach(e=>e.classList.remove("sel"));
document.querySelectorAll(".n").forEach(g=>{const k=g.dataset.k;
  g.addEventListener("mouseenter",()=>show(k));g.addEventListener("focus",()=>show(k));
  g.addEventListener("mouseleave",clr);g.addEventListener("blur",clr);
  g.addEventListener("click",()=>{unsel();
    if(pin===k){pin=null;d.hidden=true;}else{pin=k;g.classList.add("sel");show(k);}});
  if(g.tagName!=="BUTTON")g.addEventListener("keydown",e=>{
    if(e.key==="Enter"||e.key===" "){e.preventDefault();g.click();}});});
document.getElementById("dx").onclick=()=>{pin=null;d.hidden=true;unsel();};
document.addEventListener("keydown",e=>{if(e.key==="Escape"){pin=null;d.hidden=true;unsel();}});
</script></body></html>`;

const OUT = "docs/project-map.html";

/* The artifact build is the same page as a body fragment: the host supplies
   <!doctype>, <head> and <body>, so those must not be emitted. It is also the
   only build that may load webfonts — the repository copy is opened straight
   from disk and its footer promises no network request, so there it falls back
   to the system Hebrew stack. */
function toFragment(doc) {
  const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
    'family=Frank+Ruhl+Libre:wght@400;500;600&family=IBM+Plex+Sans+Hebrew:wght@400;500;600' +
    '&family=Geist+Mono:wght@400;500&display=swap">';
  const title = doc.match(/<title>[\s\S]*?<\/title>/)[0];
  const style = doc.match(/<style>[\s\S]*?<\/style>/)[0];
  const body  = doc.slice(doc.indexOf("<body>") + 6, doc.lastIndexOf("</body>"));
  return `${title}\n${FONTS}\n${style}\n<div dir="rtl">${body}</div>`;
}

if (process.argv.includes("--check")) {
  const cur = read(OUT);
  const norm = (t) => t.replace(/נסרק [\d-]+ [\d:]+ · <code>[0-9a-f]+<\/code>[^<]*<code>[^<]*<\/code>/, "");
  if (norm(cur) !== norm(html)) {
    console.error("project-map.html is out of date — run: npm run map");
    process.exit(1);
  }
  console.log("project-map.html is up to date");
} else if (process.argv.includes("--artifact")) {
  const dest = process.argv[process.argv.indexOf("--artifact") + 1] || "project-map.artifact.html";
  writeFileSync(dest, toFragment(html));
  console.log(`${dest} — artifact fragment, ${Object.keys(N).length} explained nodes`);
} else {
  writeFileSync(R(OUT), html);
  console.log(`${OUT} — ${D.totalFiles} files, ${areas.length} areas, ${rootFiles.length} root files, ` +
    `${Object.keys(N).length} explained nodes`);
  if (D.violations.length) console.warn(`  warning: ${D.violations.length} import-boundary violations`);
  if (D.handWrittenAfterSnapshot.length)
    console.warn(`  warning: newest snapshot is ${String(D.newestSnapshot).padStart(4,"0")}, ` +
      `behind ${D.handWrittenAfterSnapshot.length} hand-written migration(s) — db:generate will re-emit applied changes`);
  if (D.duplicateSets.length) console.warn(`  warning: ${D.duplicateSets.length} set(s) of byte-identical files`);
  if (D.docProblems.length) console.warn(`  warning: ${D.docProblems.length} dead reference(s) in documentation`);
  if (D.dsProblems.length) console.warn(`  warning: ${D.dsProblems.length} design-system prop contract(s) drifted`);
  if (D.unreferenced.length) console.warn(`  note: ${D.unreferenced.length} file(s) reached by nothing — ${D.reachable}/${D.totalFiles} reachable`);
}
