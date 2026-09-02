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
 * Authored prose lives in project-map-prose.mjs. A path with no exact entry
 * still gets a real explanation from a pattern — it does not vanish, and it
 * does not render as "לא מתועד" unless no pattern applies either.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LAYERS, lessonFor, KIND_HE } from "./project-map-prose.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => join(ROOT, p);
const sh = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
const read = (p) => { try { return readFileSync(R(p), "utf8"); } catch { return ""; } };

/* ── scan ──────────────────────────────────────────────────────────────── */
/* Include untracked, non-ignored files so `map:check` catches a new area before
   it is staged or committed. The agent loop deliberately runs before either
   action, and a map that can only see committed structure would approve the
   exact drift it exists to prevent. */
const files = sh(["ls-files", "--cached", "--others", "--exclude-standard"])
  .split("\n")
  .filter(Boolean)
  .filter((file) => existsSync(R(file)));
const OUT_PATH = "docs/project-map.html";
const sizeOf = (p) => {
  /* The output file is rewritten every run. Using its live size would make
     `map:check` fail against the file it just wrote. */
  if (p === OUT_PATH) return 0;
  try { return statSync(R(p)).size; } catch { return 0; }
};
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
const newestSnapshot = snapshotIdx.length ? Math.max(...snapshotIdx) : -1;
const newestMigration = migrations.length
  ? Math.max(...migrations.map((p) => Number(p.match(/(\d+)/)[1]))) : -1;
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
    return /executablePath\s*:/.test(s); });

/* public navigation */
const siteNavigation = read("lib/site-navigation.ts");
const navIds = [...siteNavigation.matchAll(/id:\s*["']([a-z0-9-]+)["']/g)].map(m=>m[1]);
const navMissing = navIds.filter(id=>!files.includes(`app/${id}/page.tsx`));

/* PUBLIC_V1 */
const handler = read("server/http/handler.ts");
const pubBlock = handler.match(/const PUBLIC_V1 = \[([\s\S]*?)\] as const;/);
const publicRoutes = pubBlock
  ? pubBlock[1].split("\n").map((line) => {
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

const byHash = new Map();
for (const f of files) {
  if (f === OUT_PATH) continue;
  const h = createHash("sha256").update(readFileSync(R(f))).digest("hex");
  (byHash.get(h) || byHash.set(h, []).get(h)).push(f);
}
const duplicateSets = [...byHash.values()].filter((g) => g.length > 1);

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
  /^(next\.config|proxy|drizzle\.config|vitest\.config|eslint\.config|postcss\.config)\.(ts|mjs)$/.test(f) ||
  /^tests\/.*\.test\.ts$/.test(f) ||
  /^(scripts|content-packages)\//.test(f) ||
  /^server\/db\/migrations\//.test(f) ||
  /^\.(github|claude)\//.test(f) ||
  /^\.design-sync\//.test(f) ||
  /^(package|package-lock|tsconfig|vercel|components)\.json$/.test(f) ||
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
const corpus = files.filter((f) => /\.(ts|tsx|mjs|js|css|json|md|html)$/.test(f)).map(read).join("\n");
for (const f of files) {
  if (reached.has(f)) continue;
  const base = f.split("/").pop();
  if (/^(public|assets)\//.test(f) && (corpus.includes("/" + f.replace(/^public\//, "")) || corpus.includes(base))) reached.add(f);
  if (/\.(md|html)$/.test(f) && (corpus.includes(base) || f === "README.md")) reached.add(f);
}
const unreferenced = files.filter((f) => !reached.has(f));

const npmScriptNames = new Set(Object.keys(JSON.parse(read("package.json")).scripts || {}));
const DOC_PATH = /`((?:app|components|lib|server|scripts|tests|public|assets|docs|\.ai|\.claude|\.github|content-packages)\/[A-Za-z0-9_@[\]/.-]*\.[a-z]{2,5})`/g;
const MUST_NOT_EXIST = new Set(["app/loading.tsx", "app/template.tsx", "app/default.tsx"]);
const docProblems = [];
for (const d of files.filter((f) => f.endsWith(".md") && !f.startsWith("docs/archive/") && f !== ".ai/DECISIONS.md")) {
  const txt = read(d);
  for (const m of txt.matchAll(DOC_PATH)) {
    const target = m[1];
    if (target.includes("*") || target.includes("<") || MUST_NOT_EXIST.has(target)) continue;
    if (!tracked.has(target)) docProblems.push(`${d} → ${target}`);
  }
  for (const m of txt.matchAll(/npm run ([a-z:-]+)/g)) {
    if (!npmScriptNames.has(m[1])) docProblems.push(`${d} → npm run ${m[1]}`);
  }
}

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

const pkg = JSON.parse(read("package.json"));
const gitignored = read(".gitignore").split("\n")
  .map(l=>l.trim()).filter(l=>l && !l.startsWith("#") && l.endsWith("/"));

const totalRecords = pkgs.reduce((n,p)=>n+p.records,0);
const totalVersions = pkgs.reduce((n,p)=>n+p.versions,0);

/* ── explanations for every path ───────────────────────────────────────── */
function glean(path) {
  if (!/\.(ts|tsx|mjs|js|css|md)$/.test(path)) return "";
  const src = read(path).slice(0, 1800);
  const block = src.match(/^\s*\/\*\*?[\s\S]*?\*\//);
  if (!block) return "";
  const text = block[0]
    .replace(/^\/\*+/, "").replace(/\*+\/$/, "")
    .replace(/^\s*\*\s?/gm, "")
    .replace(/@\w+[\s\S]*$/m, "")
    .trim();
  const para = text.split(/\n\n/)[0].replace(/\s+/g, " ").trim();
  return para.length > 24 ? para.slice(0, 280) : "";
}

const E = {};
function putExplain(key, path, isDir) {
  const info = lessonFor(path, { isDir, glean: isDir ? "" : glean(path) });
  const listed = isDir
    ? files.filter((p) => p === path || p.startsWith(path + "/"))
    : [path];
  const bytes = listed.reduce((n, p) => n + sizeOf(p), 0);
  const rec = path.match(/^content-packages\/([^/]+)\/(records|cases)\//);
  if (!isDir && rec) {
    E[key] = {
      t: path, k: "record", l: "content", s: false,
      m: human(sizeOf(path)) + " · תוכן",
      pkg: rec[1],
    };
    return;
  }
  const row = {
    t: isDir ? path + "/" : path,
    m: (isDir ? (listed.length + " קבצים · " + human(bytes)) : human(bytes))
      + " · " + (LAYERS[info.layer] || info.layer)
      + (info.sot ? " · מקור אמת" : ""),
    r: info.role,
    p: info.lesson,
    k: info.kind,
    l: info.layer,
    s: !!info.sot,
  };
  if (info.related && info.related.length) row.rel = info.related;
  if (!isDir) {
    const g = glean(path);
    if (g) row.g = g;
    if (!reached.has(path)) row.u = 1;
  }
  E[key] = row;
}

for (const f of files) putExplain(f, f, false);
const dirSet = new Set();
for (const f of files) {
  const parts = f.split("/");
  for (let i = 1; i < parts.length; i++) dirSet.add(parts.slice(0, i).join("/"));
}
for (const d of [...dirSet].sort()) putExplain(d, d, true);
for (const f of rootFiles) if (!E[f]) putExplain(f, f, false);

function putNode(key, title, meta, role, lesson, rel) {
  E[key] = { t: title, m: meta || "", r: role, p: lesson, k: "code", l: "bridge", s: false, rel: rel || [] };
}

putNode("n:req", "בקשה נכנסת", "", "כל בקשה ל־/api/",
  "לפני שגוף המסלול רץ, handler.ts כבר תפס את הבקשה: מזהה, סיווג, תפקיד במסד. המסלול עצמו לא מחליט מי רשאי.",
  ["server/http/handler.ts"]);
putNode("n:access", "accessFor()", "נקודת ההכרעה היחידה", "סיווג התפקיד במסד",
  "מחלקת את הבקשה ל־app_public, app_staff או app_service. גוף המסלול לא בוחר הרשאות — הוא רץ אחרי שהתפקיד כבר הוחל.",
  ["server/http/handler.ts"]);
putNode("n:pub", "app_public", publicRoutes.length + " נתיבים", "הנתיבים האנונימיים היחידים",
  "PUBLIC_V1 נסרק מ־handler.ts והוא בדיוק " + publicRoutes.length + " כניסות. שום דבר אחר תחת /api/v1/ אינו אנונימי.",
  publicRoutes);
putNode("n:staff", "app_staff", "ברירת המחדל", "כל השאר נכשל סגור",
  "authenticateAdmin. בלי סשן אדמין הבקשה לא מגיעה למסלול. התיעוד סימן פעם כתריסר מאלה כאנונימיים — שגוי לכיוון המחמיר.",
  ["server/core/auth/neon.ts"]);
putNode("n:svc", "app_service", "cron ותור", "עבודה פנימית",
  "נתיבי cron ותור בלבד, מאומתים ב־CRON_SECRET. לא חשופים למבקר.",
  ["server/http/internal-guard.ts"]);
putNode("n:role", "SET ROLE + RLS", "", "מה שמפעיל את מדיניות השורות",
  "חיבור ייעודי מהבריכה, SET ROLE ו־set_config('app.identity'), ובשחרור RESET ALL. בלי זה מדיניות RLS היא טקסט שלא רץ.",
  ["server/http/handler.ts"]);
putNode("n:gsp", "generateStaticParams", "נגזר מהאינדקס", "רשימת המסלולים לא נכתבת ביד",
  "האינדקסים של החבילות מייצרים את רשימת הדפים. רשומה חדשה נכנסת לאתר בלי לגעת בקוד.",
  ["lib/content/archive.ts"]);
putNode("n:pages", totalVersions.toLocaleString("en") + " דפים", "מוכנים מראש",
  totalRecords + " רשומות מתפרשות לגרסאות שפה",
  totalRecords + " רשומות בשלוש חבילות מתפרשות ל־" + totalVersions + " גרסאות שפה, וכל אחת היא דף.",
  ["content-packages"]);
putNode("n:nav", "SITE_NAVIGATION", navIds.length + " יעדים", "חוזה הניווט",
  navMissing.length
    ? "אזהרה: " + navMissing.join(", ") + " בלי page.tsx תואם."
    : "נסרק מ־lib/site-navigation.ts. לכל אחד מ־" + navIds.length + " המזהים יש app/<id>/page.tsx — נבדק.",
  navIds.map((id) => "app/" + id + "/page.tsx"));
putNode("n:ci", "CI על Ubuntu", testFiles.length + " קובצי בדיקה", "השער שרץ בכל push",
  "typecheck, lint, הבדיקות, build, map:check — ואז עשן מסלולים עם Chromium מובנה, כולל / בלי JavaScript.",
  ["scripts/ci-smoke.mjs", ".github/workflows/ci.yml"]);
putNode("n:mac", "רק על macOS", chromeScripts.length + " סקריפטים", "Chrome אמיתי, headless: false",
  "נסרקו לפי נעילת נתיב Chrome מוחלט יחד עם executablePath. אלה בדיקות הסצנה וה־no-JS המלאות. CI לא רואה אותן.",
  chromeScripts);
putNode("n:nojs", "invariant בלי JavaScript", "נשמר ב־CI על /", "הדף חייב להופיע בלי סקריפט",
  "ci-smoke טוען את / עם javaScriptEnabled: false ומוודא 8 קישורים, פוסטר, ואפס מעטפות Suspense חבויות. tests/no-js-invariant.test.ts הוא ה־tripwire ל־loading/template/default. הכיסוי הוא / בלבד.",
  ["scripts/ci-smoke.mjs", "tests/no-js-invariant.test.ts"]);
putNode("n:eslint", "eslint.config.mjs", "הגבול נאכף כשגיאת lint", "מי רשאי לייבא את מי",
  "app/ ו־components/ → רק server/contracts. הסריקה מצאה " + violations.length + " הפרות, ועוד " + sanctioned.length + " ייבואים תחת carve-out של app/auth/.",
  ["eslint.config.mjs"]);

/* ── flow diagrams ─────────────────────────────────────────────────────── */
const NW = 228, NH = 86, CS = 268, RS = 108, OX = 56, OY = 64;
const fn = (id, col, row, key, he, meta, cls) => ({
  id, x: OX + col * CS, y: OY + row * RS, w: NW, h: NH,
  key, he, meta: meta || "", cls: cls || "",
});
const st = (path) => {
  const a = areaStats(path);
  return a.files + " · " + human(a.bytes);
};

const flowHalves = {
  id: "halves",
  title: "שתי חציים ודלת אחת",
  caption: "אתר חלקיקים ו־API שלא חולקים אף קובץ מקור. הפרונטאנד רשאי לייבא שכבה אחת מ־server/ — את החוזים.",
  nodes: [
    fn("app", 0, 0, "app", "app/", st("app")),
    fn("components", 0, 1, "components", "components/", st("components")),
    fn("libcontent", 0, 2, "lib/content", "lib/content/", st("lib/content")),
    fn("packages", 0, 3, "content-packages", "content-packages/", st("content-packages")),
    fn("contracts", 1, 1, "server/contracts", "server/contracts/", st("server/contracts"), "acc"),
    fn("api", 2, 0, "app/api", "app/api/", DapiMeta()),
    fn("handler", 2, 1, "server/http/handler.ts", "handler.ts", "כל בקשה"),
    fn("modules", 2, 2, "server/modules", "server/modules/", st("server/modules")),
    fn("db", 2, 3, "server/db", "server/db/", migrations.length + " מיגרציות"),
  ],
  edges: [
    ["app", "libcontent"], ["components", "libcontent"], ["libcontent", "packages"],
    ["app", "contracts"], ["components", "contracts"],
    ["api", "handler"], ["handler", "modules"], ["modules", "db"],
    ["api", "contracts"], ["modules", "contracts"],
  ],
};
function DapiMeta() { return routeFiles.length + " מסלולים"; }

const flowReq = {
  id: "request",
  title: "כל בקשה מקבלת תפקיד",
  caption: "accessFor() היא נקודת ההכרעה היחידה. PUBLIC_V1 נסרק מהקוד; כל השאר נכשל סגור.",
  nodes: [
    fn("req", 0, 1, "n:req", "בקשה נכנסת", "/api/"),
    fn("access", 1, 1, "n:access", "accessFor()", "הכרעה יחידה", "acc"),
    fn("pub", 2, 0, "n:pub", "app_public", publicRoutes.length + " נתיבים"),
    fn("staff", 2, 1, "n:staff", "app_staff", "ברירת מחדל"),
    fn("svc", 2, 2, "n:svc", "app_service", "cron · תור"),
    fn("role", 3, 1, "n:role", "SET ROLE + RLS", "ואז RESET ALL", "acc"),
  ],
  edges: [
    ["req", "access"],
    ["access", "pub"], ["access", "staff"], ["access", "svc"],
    ["pub", "role"], ["staff", "role"], ["svc", "role"],
  ],
};

const flowPages = {
  id: "pages",
  title: "הדפים נגזרים מהנתונים",
  caption: totalRecords + " רשומות מתפרשות ל־" + totalVersions + " גרסאות שפה. האינדקס מייצר מסלולים; שמונת היעדים בניווט מתוחזקים ביד.",
  nodes: [
    fn("pkg", 0, 0, "content-packages", "content-packages/", st("content-packages")),
    fn("lib", 1, 0, "lib/content", "lib/content/", st("lib/content")),
    fn("gsp", 2, 0, "n:gsp", "generateStaticParams", "נגזר מהאינדקס"),
    fn("pgs", 3, 0, "n:pages", totalVersions.toLocaleString("en") + " דפים", "מוכנים מראש", "acc"),
    fn("nav", 1, 1, "n:nav", "SITE_NAVIGATION", navIds.length + " יעדים"),
  ],
  edges: [["pkg", "lib"], ["lib", "gsp"], ["gsp", "pgs"], ["nav", "pgs"]],
};

const flowVerify = {
  id: "verify",
  title: "מה CI רואה ומה לא",
  caption: chromeScripts.length + " סקריפטים רצים רק על תחנת macOS. CI שומר את ה־no-JS של / בלבד.",
  nodes: [
    fn("ci", 0, 0, "n:ci", "CI על Ubuntu", testFiles.length + " בדיקות"),
    fn("mac", 0, 1, "n:mac", "רק על macOS", chromeScripts.length + " סקריפטים"),
    fn("nojs", 2, 0, "n:nojs", "בלי JavaScript", "נשמר ב־CI על /", "acc"),
  ],
  edges: [["ci", "nojs"], ["mac", "nojs"]],
};

const flowModule = {
  id: "module",
  title: "איך מודול בנוי",
  caption: "המסלול רשאי לייבא רק את index.ts. SQL ב־repo, מדיניות ב־rules, כתיבה מנוהלת־גרסאות ב־recordVersion.",
  nodes: [
    fn("rt", 0, 1, "app/api", "route.ts", "פרסור + JSON"),
    fn("idx", 1, 1, "server/modules", "index.ts", "קושר db()", "acc"),
    fn("svc", 2, 1, "server/modules", "service.ts", "זרימת עבודה"),
    fn("repo", 3, 1, "server/modules", "repo.ts", "שאילתות"),
    fn("rules", 2, 2, "server/modules", "rules.ts", "בלי מסד"),
    fn("ver", 3, 0, "server/core/versioning.ts", "recordVersion()", "הכתיבה היחידה"),
    fn("dbn", 4, 1, "server/db", "Postgres + RLS", migrations.length + " מיגרציות"),
  ],
  edges: [
    ["rt", "idx"], ["idx", "svc"], ["svc", "repo"], ["svc", "rules"],
    ["svc", "ver"], ["repo", "dbn"], ["ver", "dbn"],
  ],
};

const flowParticles = {
  id: "particles",
  title: "מאיפייה לסצנה",
  caption: "מקורות ב־assets/, פלט דטרמיניסטי ב־public/, רנדרר יחיד ב־Scene.tsx. שינוי שם ב־public/ שובר בשקט.",
  nodes: [
    fn("asrc", 0, 0, "assets/source", "assets/source/", "אייקוני מקור"),
    fn("aref", 0, 1, "assets/reference", "assets/reference/", "תמונת האריה"),
    fn("bakei", 1, 0, "scripts/particle-nav", "bake-icons", "SDF"),
    fn("bakel", 1, 1, "scripts/particle-nav", "bake-lion", "LNP1"),
    fn("bakep", 1, 2, "scripts/particle-nav", "make-poster", "פוסטר"),
    fn("picons", 2, 0, "public/icons", "public/icons/", "8 SDF"),
    fn("ppart", 2, 1, "public/particles", "public/particles/", "45 / 90 / 180k"),
    fn("ppost", 2, 2, "public/posters", "public/posters/", "no-WebGL"),
    fn("scene", 3, 1, "components/particle-nav/Scene.tsx", "Scene.tsx", "רנדרר יחיד", "acc"),
  ],
  edges: [
    ["asrc", "bakei"], ["aref", "bakel"],
    ["bakei", "picons"], ["bakel", "ppart"], ["bakep", "ppost"],
    ["picons", "scene"], ["ppart", "scene"], ["ppost", "scene"],
  ],
};

/* live import graph */
const colOf = {
  app: 0, components: 0,
  lib: 1, "lib/content": 1,
  "content-packages": 2, "server/contracts": 2,
  "app/api": 3, "server/http": 3,
  "server/modules": 4, "server/core": 4, scripts: 4,
  "server/db": 5, "server/jobs": 5,
};
const importIds = [...new Set(crossings.flatMap((c) => c.edge.split("→")))];
const colBuckets = new Map();
for (const id of importIds) {
  const c = colOf[id] ?? 6;
  if (!colBuckets.has(c)) colBuckets.set(c, []);
  colBuckets.get(c).push(id);
}
const importNodes = [];
for (const [c, ids] of [...colBuckets.entries()].sort((a, b) => a[0] - b[0])) {
  ids.sort().forEach((id, row) => {
    const meta = E[id] ? E[id].m.split(" · ")[0] : "";
    importNodes.push(fn("i-" + id, c, row, id, id, meta, id === "server/contracts" ? "acc" : ""));
  });
}
const flowImports = {
  id: "imports",
  title: "גרף הייבוא שנמדד",
  caption: "כל קשת היא ייבוא @/ אמיתי בין אזורים. לא ציור יד — נספר בהרצה הזו.",
  nodes: importNodes,
  edges: crossings.map((c) => {
    const [a, b] = c.edge.split("→");
    return ["i-" + a, "i-" + b, String(c.count)];
  }),
};

const FLOWS = [flowHalves, flowReq, flowPages, flowModule, flowParticles, flowVerify, flowImports];

const findings = [
  [violations.length===0,
    "אפס הפרות של גבול הייבוא בין הפרונטאנד ל־server/",
    violations.length + " הפרות: " + violations.map(v=>v.file).join(", ")],
  [navMissing.length===0,
    "לכל " + navIds.length + " יעדי הניווט יש page.tsx תואם",
    "חסר page.tsx ל: " + navMissing.join(", ")],
  [migrations.length===journalEntries,
    migrations.length + " מיגרציות תואמות ל־journal",
    "סחיפה בין הקבצים ל־journal"],
  [handWrittenAfterSnapshot.length===0,
    "בסיס ה־snapshots עדכני — db:generate לא יפלוט מיגרציה מיותרת",
    "ה־snapshot האחרון הוא " + String(newestSnapshot).padStart(4,"0") +
    " אבל יש מיגרציות DDL אחריו (" + handWrittenAfterSnapshot.join(", ") + ")"],
  [dsProblems.length===0,
    "חוזי ה־props של מערכת העיצוב תואמים לטיפוסי המקור",
    dsProblems.length + " רכיבים שנסחפו: " + dsProblems.join(" · ")],
  [docProblems.length===0,
    "כל נתיב וכל פקודת npm שמוזכרים בתיעוד קיימים",
    docProblems.length + " הפניות מתות: " + docProblems.join(" · ")],
  [duplicateSets.length===0,
    "אפס קבצים כפולים — כל " + files.length.toLocaleString("en") + " הקבצים בעלי תוכן שונה",
    duplicateSets.length + " קבוצות זהות בייט־בייט"],
  [unreferenced.length===0,
    "כל קובץ נגיע אליו מנקודת כניסה",
    reached.size + " מתוך " + files.length + " נגישים; " + unreferenced.length + " לא מוזכרים"],
].map(([ok, good, bad]) => ({ ok, text: ok ? good : bad }));

const FILE_LIST = files.map((p) => [p, sizeOf(p)]);

const generatedAt = new Date().toISOString().slice(0,16).replace("T"," ");
const payload = {
  head: sh(["log","-1","--format=%h"]),
  branch: sh(["rev-parse","--abbrev-ref","HEAD"]),
  totalFiles: files.length,
  totalBytes: files.reduce((n,p)=>n+sizeOf(p),0),
  pages: pageFiles.length,
  apiRoutes: routeFiles.length,
  tests: testFiles.length,
  migrations: migrations.length,
  npmScripts: Object.keys(pkg.scripts||{}).length,
  archivePages: totalVersions,
  files: FILE_LIST,
  E,
  flows: FLOWS,
  findings,
  gitignored,
  layers: LAYERS,
  kindHe: KIND_HE,
  unref: unreferenced.length,
};

/* ── render ────────────────────────────────────────────────────────────── */
const CSS = `
:root{
  --ground:#EDF0F4; --surface:#FFFFFF; --surface-2:#F5F7FA; --surface-3:#E7ECF2;
  --line:#D0D8E2; --line-soft:#E2E8EF; --edge:#A9B6C6;
  --text:#14202E; --text-dim:#57677A; --text-faint:#8494A6;
  --accent:#8A6112; --accent-soft:#F0E4C6;
  --ok:#226646; --warn:#912C28; --ok-soft:#E6F4EC; --warn-soft:#F8E8E7;
  --c-frontend:#1B646F; --c-backend:#226646; --c-content:#8A6112; --c-data:#825C12;
  --c-tests:#912C28; --c-docs:#57677A; --c-deploy:#8C3349; --c-local:#8494A6;
  --c-bridge:#8A6112; --c-archive:#57677A; --c-stale:#912C28;
  --shadow:0 1px 2px rgba(20,32,46,.06), 0 8px 24px rgba(20,32,46,.07);
  --shadow-lg:0 2px 8px rgba(20,32,46,.10), 0 24px 60px rgba(20,32,46,.16);
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
  --sans:"IBM Plex Sans Hebrew","Assistant",system-ui,-apple-system,"Segoe UI",sans-serif;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme=light]){
    --ground:#0E1520; --surface:#16202E; --surface-2:#1B2634; --surface-3:#22303F;
    --line:#2B3A4B; --line-soft:#223040; --edge:#42566B;
    --text:#E6EDF5; --text-dim:#93A3B5; --text-faint:#6D7F93;
    --accent:#D8A93F; --accent-soft:#3A2F14;
    --ok:#5FBD8F; --warn:#EC7B75; --ok-soft:#163328; --warn-soft:#3A1C1B;
    --c-frontend:#4FB3C4; --c-backend:#5FBD8F; --c-content:#D6A83E; --c-data:#D6A83E;
    --c-tests:#EC7B75; --c-docs:#93A3B5; --c-deploy:#E4869C; --c-local:#6D7F93;
    --c-bridge:#D8A93F; --c-archive:#93A3B5; --c-stale:#EC7B75;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
    --shadow-lg:0 2px 8px rgba(0,0,0,.5), 0 24px 60px rgba(0,0,0,.55);
  }
}
:root[data-theme=dark]{
  --ground:#0E1520; --surface:#16202E; --surface-2:#1B2634; --surface-3:#22303F;
  --line:#2B3A4B; --line-soft:#223040; --edge:#42566B;
  --text:#E6EDF5; --text-dim:#93A3B5; --text-faint:#6D7F93;
  --accent:#D8A93F; --accent-soft:#3A2F14;
  --ok:#5FBD8F; --warn:#EC7B75; --ok-soft:#163328; --warn-soft:#3A1C1B;
  --c-frontend:#4FB3C4; --c-backend:#5FBD8F; --c-content:#D6A83E; --c-data:#D6A83E;
  --c-tests:#EC7B75; --c-docs:#93A3B5; --c-deploy:#E4869C; --c-local:#6D7F93;
  --c-bridge:#D8A93F; --c-archive:#93A3B5; --c-stale:#EC7B75;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
  --shadow-lg:0 2px 8px rgba(0,0,0,.5), 0 24px 60px rgba(0,0,0,.55);
}
*{box-sizing:border-box}
html,body{height:100%;}
body{
  margin:0; background:var(--ground); color:var(--text);
  font:16px/1.65 var(--sans); direction:rtl;
  -webkit-font-smoothing:antialiased;
  display:flex; flex-direction:column; overflow:hidden;
}
code,.mono,.nm{font-family:var(--mono); direction:ltr; unicode-bidi:isolate;}
h1{font-size:20px; font-weight:800; letter-spacing:-.02em; margin:0;}
.top{flex:none; z-index:60; background:var(--surface); border-bottom:1px solid var(--line); box-shadow:var(--shadow);}
.top-in{max-width:1600px; margin:0 auto; padding:12px 22px 8px; display:flex; align-items:center; gap:14px; flex-wrap:wrap;}
.brand{display:flex; align-items:baseline; gap:11px; margin-inline-end:auto;}
.brand .sub{font-size:13px; color:var(--text-dim);}
.tabs{display:flex; gap:4px; background:var(--surface-2); padding:4px; border-radius:9px; border:1px solid var(--line-soft);}
.tab{
  appearance:none; border:0; background:transparent; color:var(--text-dim);
  font:inherit; font-size:13.5px; font-weight:600; padding:7px 14px; border-radius:6px; cursor:pointer;
}
.tab:hover{color:var(--text);}
.tab[aria-selected=true]{background:var(--surface); color:var(--text); box-shadow:var(--shadow);}
.search{
  width:min(340px,100%); font:inherit; font-size:14px; padding:8px 12px; border-radius:8px;
  border:1px solid var(--line); background:var(--surface-2); color:var(--text);
}
.search:focus{outline:2.5px solid var(--accent); outline-offset:1px; border-color:var(--accent);}
.btn{
  appearance:none; font:inherit; font-size:13px; font-weight:600; cursor:pointer;
  background:var(--surface-2); color:var(--text); border:1px solid var(--line);
  padding:7px 13px; border-radius:7px;
}
.btn:hover{background:var(--surface-3);}
.btn:focus-visible,.tab:focus-visible,.row:focus-visible,.node:focus-visible,.chip:focus-visible{
  outline:2.5px solid var(--accent); outline-offset:2px;
}
.meta-in{max-width:1600px; margin:0 auto; padding:0 22px 12px;}
.gen{margin:0 0 8px; font-size:12.5px; color:var(--text-dim);}
.stats{display:flex; flex-wrap:wrap; gap:7px;}
.stat{background:var(--surface-2); border:1px solid var(--line-soft); border-radius:7px; padding:4px 10px; font-size:12.5px; color:var(--text-dim);}
.stat b{color:var(--text); font-variant-numeric:tabular-nums;}
main{flex:1; min-height:0; position:relative;}
.panel{display:none; height:100%;}
.panel.on{display:flex; flex-direction:column;}
#p-list.on{overflow:hidden;}
.list-scroll{flex:1; min-height:0; overflow:auto; padding:16px 22px 48px;}
.list-in{max-width:1100px; margin:0 auto;}
.scan-box{margin-bottom:16px; border:1px solid var(--line); border-radius:10px; background:var(--surface);}
.scan-box > summary{cursor:pointer; padding:10px 14px; font-size:13.5px; font-weight:600; list-style:none;}
.scan-box > summary::-webkit-details-marker{display:none;}
.scan-box[open] > summary{border-bottom:1px solid var(--line-soft);}
.findings{display:flex; flex-direction:column; gap:6px; margin:0; padding:10px 12px 12px;}
.findings li{
  list-style:none; margin:0; padding:8px 12px; border-radius:8px; font-size:13.5px;
  border:1px solid var(--line); background:var(--surface);
}
.findings{padding:0;}
.findings li.ok{border-inline-start:3px solid var(--ok); background:var(--ok-soft);}
.findings li.warn{border-inline-start:3px solid var(--warn); background:var(--warn-soft); color:var(--warn);}
.tree-hint{margin:0 0 8px; font-size:13px; color:var(--text-dim);}
.tree-tools{display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;}
.tree details{border:1px solid var(--line); background:var(--surface); border-radius:10px; margin-bottom:6px; box-shadow:var(--shadow);}
.tree details details{border:0; box-shadow:none; background:transparent; border-radius:0; margin:0; border-bottom:1px dashed var(--line-soft);}
.tree details details:last-child{border-bottom:0;}
.row{
  display:flex; align-items:center; gap:8px; width:100%; padding:8px 12px;
  background:none; border:0; color:inherit; font:inherit; cursor:pointer; text-align:start;
}
.row:hover{background:color-mix(in srgb, var(--accent) 8%, transparent);}
.row.sel{background:var(--accent-soft);}
summary.row{list-style:none;}
summary.row::-webkit-details-marker{display:none;}
.chev{width:32px; height:32px; flex:none; display:grid; place-items:center; color:var(--text-faint); border-radius:6px;}
.chev:hover{background:var(--surface-3); color:var(--text);}
details[open] > summary .chev{transform:rotate(-90deg);}
.dot{width:8px; height:8px; border-radius:50%; flex:none; background:var(--c-local);}
.l-frontend{background:var(--c-frontend)}.l-backend{background:var(--c-backend)}
.l-content{background:var(--c-content)}.l-data{background:var(--c-data)}
.l-tests{background:var(--c-tests)}.l-docs{background:var(--c-docs)}
.l-deploy{background:var(--c-deploy)}.l-local{background:var(--c-local)}
.l-bridge{background:var(--c-bridge)}.l-archive{background:var(--c-archive)}.l-stale{background:var(--c-stale)}
.nm{font-size:13.5px;}
.role{font-size:12.5px; color:var(--text-dim); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; unicode-bidi:plaintext;}
.cn{margin-inline-start:auto; font-size:11.5px; font-variant-numeric:tabular-nums; color:var(--text-faint); direction:ltr; unicode-bidi:isolate; flex:none;}
.st{color:var(--accent); font-size:11px;}
.kids{padding:0 0 4px;}
.file{border-radius:0;}
.bulk-note{padding:6px 12px 10px 38px; font-size:12.5px; color:var(--text-dim);}
.hidden{display:none !important;}
#p-flow.on{height:100%;}
.flow-bar{flex:none; display:flex; gap:6px; padding:10px 16px 8px; overflow-x:auto; background:var(--surface);}
#flow-caption{flex:none; margin:0; padding:0 16px 10px; font-size:13px; color:var(--text-dim); background:var(--surface); border-bottom:1px solid var(--line); unicode-bidi:plaintext;}
.chip{
  appearance:none; border:1px solid var(--line); background:var(--surface-2); color:var(--text-dim);
  font:inherit; font-size:13px; font-weight:600; padding:6px 12px; border-radius:999px; cursor:pointer; white-space:nowrap;
}
.chip[aria-selected=true]{background:var(--accent); color:var(--ground); border-color:var(--accent);}
.stage{position:relative; flex:1; min-height:0; overflow:hidden; cursor:grab; background:
  radial-gradient(circle at 1px 1px, var(--line-soft) 1px, transparent 0) 0 0/22px 22px, var(--ground);}
.stage.dragging{cursor:grabbing;}
.world{position:absolute; left:0; top:0; transform-origin:0 0; direction:ltr;}
.edges{position:absolute; inset:0; overflow:visible; pointer-events:none;}
.edges path{fill:none; stroke:var(--edge); stroke-width:2; transition:stroke .2s, opacity .2s;}
.edges path.hot{stroke:var(--accent); stroke-width:2.8;}
.edges .elab{fill:var(--text-faint); font-size:11px; font-family:var(--sans);}
.node{
  position:absolute; direction:rtl; text-align:right;
  background:var(--surface); border:1px solid var(--line); border-radius:11px;
  padding:0; cursor:pointer; box-shadow:var(--shadow); color:var(--text); font:inherit;
  transition:transform .16s, box-shadow .16s, border-color .16s, opacity .2s;
}
.node:hover{transform:translateY(-2px); box-shadow:var(--shadow-lg);}
.node.hot{border-color:var(--accent); box-shadow:0 0 0 2.5px var(--accent-soft), var(--shadow-lg);}
.node.acc{border-color:var(--accent);}
.node .hd{display:flex; align-items:center; gap:7px; padding:7px 11px 0;}
.node .kind{font-size:10px; font-weight:800; letter-spacing:.08em; color:var(--text-faint);}
.node h3{margin:0; padding:2px 11px 0; font-size:13.5px; font-weight:700; line-height:1.3;}
.node h3[dir=ltr]{unicode-bidi:isolate; display:block; text-align:right;}
.node .en{display:block; padding:1px 11px 10px; font-family:var(--mono); font-size:10.5px; color:var(--text-dim);
  direction:ltr; unicode-bidi:isolate; text-align:right;}
.handle{
  position:absolute; top:50%; width:10px; height:10px; margin-top:-5px; border-radius:50%;
  background:var(--surface); border:2px solid var(--accent); pointer-events:none;
}
.handle.in{left:-6px;} .handle.out{right:-6px;}
.zoom{position:absolute; bottom:14px; inset-inline-start:14px; z-index:20; display:flex; gap:6px;}
.hint{
  position:absolute; top:12px; inset-inline-end:14px; z-index:20; background:var(--surface);
  border:1px solid var(--line); border-radius:8px; padding:7px 12px; font-size:12.5px;
  color:var(--text-dim); box-shadow:var(--shadow);
}
.scrim{position:fixed; inset:0; background:rgba(10,16,24,.5); z-index:70; opacity:0; pointer-events:none; transition:opacity .22s;}
.scrim.on{opacity:1; pointer-events:auto;}
.drawer{
  position:fixed; top:0; bottom:0; right:0; width:min(470px,94vw); z-index:80;
  background:var(--surface); border-left:1px solid var(--line); box-shadow:var(--shadow-lg);
  transform:translateX(100%); transition:transform .26s cubic-bezier(.4,0,.2,1);
  overflow-y:auto; padding:0 0 44px; visibility:hidden;
}
.drawer.on{transform:translateX(0); visibility:visible;}
.dr-head{position:sticky; top:0; background:var(--surface); border-bottom:1px solid var(--line); padding:18px 22px 15px; z-index:2;}
.dr-head .nm{display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:12px; color:var(--text-dim);}
.dr-head h2{margin:0 0 4px; font-size:20px; font-weight:800; letter-spacing:-.02em; line-height:1.25; direction:ltr; unicode-bidi:isolate; text-align:right; word-break:break-all;}
.dr-en{font-size:12px; color:var(--text-dim); unicode-bidi:plaintext;}
.dr-close{position:absolute; top:14px; left:14px; width:31px; height:31px; border-radius:7px; border:1px solid var(--line); background:var(--surface-2); cursor:pointer; color:var(--text); font-size:17px; line-height:1;}
.dr-body{padding:18px 22px;}
.fld{margin-bottom:18px;}
.fld h4{margin:0 0 6px; font-size:10.5px; font-weight:800; letter-spacing:.13em; color:var(--text-faint);}
.fld p{margin:0; font-size:14.5px; line-height:1.72; unicode-bidi:plaintext; overflow-wrap:anywhere;}
.fld.purpose{background:var(--accent-soft); border-radius:9px; padding:13px 15px;}
.fld.purpose h4{color:var(--accent);}
.fld.purpose p{font-size:15.5px; font-weight:600; line-height:1.7;}
.fld.warn{background:var(--warn-soft); border-radius:8px; padding:12px 14px;}
.rel{display:flex; flex-wrap:wrap; gap:6px;}
.rel button{
  font:inherit; font-size:12.5px; font-family:var(--mono); direction:ltr;
  background:var(--surface-2); border:1px solid var(--line); border-radius:6px;
  padding:5px 9px; cursor:pointer; color:var(--text);
}
.rel button:hover{border-color:var(--accent);}
.gens{display:flex; flex-wrap:wrap; gap:6px; direction:ltr; margin-top:18px;}
.gens code{padding:3px 9px; border:1px dashed var(--line); border-radius:5px; color:var(--text-dim); font-size:12px;}
.empty{padding:32px 8px; color:var(--text-dim);}
@media (max-width:820px){
  .brand .sub,.hint{display:none;}
  .top-in{padding:10px 14px; gap:10px;}
  .search{width:100%; order:5;}
  .list-scroll{padding:12px 12px 40px;}
  .role{display:none;}
}
@media (prefers-reduced-motion:reduce){
  *{transition:none !important; animation:none !important;}
}
`;

const CLIENT = `
(function(){
  const D = DATA;
  const E = D.E;
  const $ = function(id){ return document.getElementById(id); };
  const esc = function(t){
    return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  };
  const human = function(b){
    return b >= 1048576 ? (b/1048576).toFixed(b>=10485760?0:1)+"MB"
         : b >= 1024 ? Math.round(b/1024)+"K" : b+"B";
  };
  const info = function(key){
    const e = E[key];
    if (!e) return null;
    if (e.k === "record" && !e.p) {
      return {
        t: e.t, m: e.m, k: "record", l: "content", s: false,
        r: "רשומת מקור ב־" + e.pkg,
        p: "JSON מחויב לגיט. האינדקס קורא אותו בזמן build ו־generateStaticParams מייצר ממנו דף ארכיון. המדיה עצמה לא נמצאת כאן — רק מזהה media_id שמצביע ל־CDN. המאגר ציבורי: push כבר מפרסם את הטקסט, גם לפני פריסה.",
        rel: ["content-packages/" + e.pkg]
      };
    }
    return e;
  };

  $("stat-files").innerHTML = "<b>" + D.totalFiles.toLocaleString("en") + "</b> קבצים במעקב";
  $("stat-bytes").innerHTML = "<b>" + human(D.totalBytes) + "</b>";
  $("stat-arch").innerHTML = "<b>" + D.archivePages.toLocaleString("en") + "</b> דפי ארכיון";
  $("stat-api").innerHTML = "<b>" + D.apiRoutes + "</b> מסלולי API";
  $("stat-tests").innerHTML = "<b>" + D.tests + "</b> בדיקות";
  $("stat-mig").innerHTML = "<b>" + D.migrations + "</b> מיגרציות";
  $("stat-npm").innerHTML = "<b>" + D.npmScripts + "</b> סקריפטים";
  $("findings").innerHTML = D.findings.map(function(f){
    return "<li class='" + (f.ok ? "ok" : "warn") + "'>" + esc(f.text) + "</li>";
  }).join("");
  (function(){
    const w = D.findings.filter(function(f){ return !f.ok; }).length;
    $("scan-sum").textContent = D.findings.length + " בדיקות סריקה · " +
      (w ? (w + " אזהרות") : "הכל תקין");
    if (w) $("scan-sum").style.color = "var(--warn)";
  })();
  $("gens").innerHTML = D.gitignored.map(function(g){ return "<code>" + esc(g) + "</code>"; }).join("");

  /* tree */
  function buildForest(){
    const root = { name:"", path:"", kids: new Map(), files: [] };
    D.files.forEach(function(pair){
      const path = pair[0], size = pair[1];
      const parts = path.split("/");
      let n = root;
      for (let i = 0; i < parts.length; i++) {
        if (i === parts.length - 1) n.files.push({ path: path, size: size, name: parts[i] });
        else {
          if (!n.kids.has(parts[i])) {
            const p = parts.slice(0, i+1).join("/");
            n.kids.set(parts[i], { name: parts[i], path: p, kids: new Map(), files: [] });
          }
          n = n.kids.get(parts[i]);
        }
      }
    });
    return root;
  }
  const forest = buildForest();
  const layerOf = function(path){
    const e = info(path);
    return e && e.l ? e.l : "local";
  };
  const countNode = function(n){
    let c = n.files.length;
    n.kids.forEach(function(k){ c += countNode(k); });
    return c;
  };
  const bytesNode = function(n){
    let b = n.files.reduce(function(s,f){ return s + f.size; }, 0);
    n.kids.forEach(function(k){ b += bytesNode(k); });
    return b;
  };

  function renderNode(n, depth){
    const kids = [];
    n.kids.forEach(function(k){ kids.push(k); });
    kids.sort(function(a,b){ return a.name.localeCompare(b.name); });
    const files = n.files.slice().sort(function(a,b){ return a.name.localeCompare(b.name); });
    const bulk = files.length > 48 && kids.length === 0;
    const open = depth < 1 && !bulk ? " open" : "";
    const e = info(n.path);
    const role = e && e.r ? e.r : "";
    const sot = e && e.s ? "<span class='st'>★</span>" : "";
    let html = "<details class='dir' data-path='" + esc(n.path) + "'" + open + ">" +
      "<summary class='row' data-path='" + esc(n.path) + "'>" +
      "<span class='chev' aria-hidden='true'>▾</span>" +
      "<span class='dot l-" + layerOf(n.path) + "'></span>" +
      "<span class='nm'>" + esc(n.name) + "/</span>" + sot +
      (role ? "<span class='role'>" + esc(role) + "</span>" : "") +
      "<span class='cn'>" + countNode(n) + " · " + human(bytesNode(n)) + "</span></summary><div class='kids'>";
    if (bulk) html += "<p class='bulk-note'>" + files.length + " קבצים. פתיחה מציגה את כולם — כל אחד נפתח לחלון הסבר. חיפוש מסנן גם כאן.</p>";
    kids.forEach(function(k){ html += renderNode(k, depth + 1); });
    files.forEach(function(f){
      const fe = info(f.path);
      const fr = fe && fe.r ? fe.r : "";
      const star = fe && fe.s ? "<span class='st'>★</span>" : "";
      html += "<button type='button' class='row file' data-path='" + esc(f.path) + "'>" +
        "<span class='dot l-" + layerOf(f.path) + "'></span>" +
        "<span class='nm'>" + esc(f.name) + "</span>" + star +
        (fr ? "<span class='role'>" + esc(fr) + "</span>" : "") +
        "<span class='cn'>" + human(f.size) + "</span></button>";
    });
    html += "</div></details>";
    return html;
  }
  function renderTree(){
    const top = [];
    forest.kids.forEach(function(k){ top.push(k); });
    top.sort(function(a,b){ return a.name.localeCompare(b.name); });
    const roots = forest.files.slice().sort(function(a,b){ return a.name.localeCompare(b.name); });
    let html = "";
    if (roots.length) {
      html += "<div class='dir' style='border:1px solid var(--line);background:var(--surface);border-radius:10px;margin-bottom:8px;padding:4px 0'>";
      roots.forEach(function(f){
        const fe = info(f.path);
        html += "<button type='button' class='row file' data-path='" + esc(f.path) + "'>" +
          "<span class='dot l-" + layerOf(f.path) + "'></span>" +
          "<span class='nm'>" + esc(f.name) + "</span>" +
          (fe && fe.s ? "<span class='st'>★</span>" : "") +
          (fe && fe.r ? "<span class='role'>" + esc(fe.r) + "</span>" : "") +
          "<span class='cn'>" + human(f.size) + "</span></button>";
      });
      html += "</div>";
    }
    top.forEach(function(k){ html += renderNode(k, 0); });
    $("tree").innerHTML = html;
    bindTree($("tree"));
  }
  function bindTree(root){
    root.querySelectorAll("summary.row").forEach(function(sum){
      sum.addEventListener("click", function(ev){
        if (ev.target.closest(".chev")) return;
        ev.preventDefault();
        openExplain(sum.getAttribute("data-path"));
      });
    });
    root.querySelectorAll("button.file").forEach(function(btn){
      btn.addEventListener("click", function(){ openExplain(btn.getAttribute("data-path")); });
    });
  }
  renderTree();

  $("expand").onclick = function(){ $("tree").querySelectorAll("details").forEach(function(d){ d.open = true; }); };
  $("collapse").onclick = function(){ $("tree").querySelectorAll("details").forEach(function(d){ d.open = false; }); };

  /* search */
  const filter = function(q){
    q = (q || "").trim().toLowerCase();
    const rows = $("tree").querySelectorAll("[data-path]");
    if (!q) {
      rows.forEach(function(el){ el.classList.remove("hidden"); });
      $("tree").querySelectorAll("details").forEach(function(d,i){
        const bulk = d.querySelector(".bulk-note");
        d.open = !bulk && d.parentElement && d.parentElement.id === "tree";
      });
      $("empty").hidden = true;
      return;
    }
    let shown = 0;
    $("tree").querySelectorAll("details").forEach(function(d){ d.open = false; });
    rows.forEach(function(el){
      const path = el.getAttribute("data-path") || "";
      const e = info(path) || {};
      const hay = (path + " " + (e.r||"") + " " + (e.p||"") + " " + (e.k||"")).toLowerCase();
      const hit = hay.indexOf(q) !== -1;
      if (el.tagName === "BUTTON") {
        el.classList.toggle("hidden", !hit);
        if (hit) {
          shown++;
          let p = el.parentElement;
          while (p) {
            if (p.tagName === "DETAILS") p.open = true;
            p = p.parentElement;
          }
        }
      } else if (el.tagName === "DETAILS") {
        /* dirs stay; hidden if nothing inside matches — handled after */
      }
    });
    $("tree").querySelectorAll("details.dir").forEach(function(d){
      const any = d.querySelector("button.file:not(.hidden), details:not(.hidden)");
      const self = ((d.getAttribute("data-path")||"") + " " + ((info(d.getAttribute("data-path"))||{}).r||"")).toLowerCase().indexOf(q) !== -1;
      d.classList.toggle("hidden", !any && !self);
      if (self) d.open = true;
    });
    $("empty").hidden = shown > 0 || $("tree").querySelector("details:not(.hidden)");
    if (!$("empty").hidden) $("empty").textContent = "אין קובץ שמתאים ל־\\"" + q + "\\".";
  };
  $("q").addEventListener("input", function(){ filter($("q").value); });
  document.addEventListener("keydown", function(ev){
    if (ev.key === "/" && ev.target.tagName !== "INPUT") { ev.preventDefault(); $("q").focus(); }
    if (ev.key === "Escape") closeDrawer();
  });

  /* drawer */
  const drawer = $("drawer"), scrim = $("scrim");
  let lastFocus = null, selected = null;
  function markSel(path){
    document.querySelectorAll(".row.sel,.node.hot").forEach(function(el){ el.classList.remove("sel","hot"); });
    document.querySelectorAll("[data-path=\\"" + CSS.escape(path) + "\\"]").forEach(function(el){ el.classList.add(el.classList.contains("node") ? "hot" : "sel"); });
    selected = path;
  }
  function openExplain(key){
    const e = info(key);
    if (!e) return;
    lastFocus = document.activeElement;
    markSel(key);
    $("dr-dot").className = "dot l-" + (e.l || "local");
    $("dr-kind").textContent = (D.kindHe[e.k] || e.k || "") + " · " + (D.layers[e.l] || e.l || "");
    $("dr-title").textContent = e.t;
    $("dr-meta").textContent = e.m || "";
    const bits = [];
    bits.push("<div class='fld purpose'><h4>התכלית</h4><p>" + esc(e.r || "") + "</p></div>");
    bits.push("<div class='fld'><h4>איך זה עובד, ולמה זה כאן</h4><p>" + esc(e.p || "") + "</p></div>");
    if (e.g) bits.push("<div class='fld'><h4>מהקובץ עצמו</h4><p>" + esc(e.g) + "</p></div>");
    if (e.u) bits.push("<div class='fld warn'><h4>לא נגיע מנקודת כניסה</h4><p>הסריקה לא מצאה ייבוא, נתיב מילולי או אזכור שמוביל לכאן. יכול להיות נכס שמחכים לו, או קובץ שהתנתק.</p></div>");
    if (e.rel && e.rel.length) {
      bits.push("<div class='fld'><h4>קשור אל</h4><div class='rel'>" +
        e.rel.map(function(r){ return "<button type='button' data-rel='" + esc(r) + "'>" + esc(r) + "</button>"; }).join("") +
        "</div></div>");
    }
    $("dr-body").innerHTML = bits.join("");
    $("dr-body").querySelectorAll("[data-rel]").forEach(function(b){
      b.addEventListener("click", function(){ openExplain(b.getAttribute("data-rel")); });
    });
    drawer.classList.add("on"); scrim.classList.add("on"); drawer.focus();
  }
  function closeDrawer(){
    drawer.classList.remove("on"); scrim.classList.remove("on");
    document.querySelectorAll(".row.sel,.node.hot").forEach(function(el){ el.classList.remove("sel","hot"); });
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $("dr-close").onclick = closeDrawer;
  scrim.onclick = closeDrawer;

  /* modes */
  function setMode(mode){
    document.querySelectorAll(".tab").forEach(function(t){
      t.setAttribute("aria-selected", t.getAttribute("data-mode") === mode ? "true" : "false");
    });
    $("p-list").classList.toggle("on", mode === "list");
    $("p-flow").classList.toggle("on", mode === "flow");
    if (mode === "flow") requestAnimationFrame(fit);
  }
  document.querySelectorAll(".tab").forEach(function(t){
    t.addEventListener("click", function(){ setMode(t.getAttribute("data-mode")); });
  });

  /* flows */
  let flowId = D.flows[0].id;
  const bar = $("flow-bar");
  bar.innerHTML = D.flows.map(function(f){
    return "<button type='button' class='chip' data-flow='" + f.id + "' " +
      (f.id === flowId ? "aria-selected='true'" : "aria-selected='false'") + ">" + esc(f.title) + "</button>";
  }).join("");
  bar.querySelectorAll(".chip").forEach(function(c){
    c.addEventListener("click", function(){
      flowId = c.getAttribute("data-flow");
      bar.querySelectorAll(".chip").forEach(function(x){ x.setAttribute("aria-selected", x === c ? "true" : "false"); });
      drawFlow();
      requestAnimationFrame(fit);
    });
  });

  const world = $("world"), svg = $("edges"), stage = $("stage");
  let scale = 0.8, tx = 0, ty = 0, WORLD_W = 1200, WORLD_H = 800;
  const apply = function(){ world.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")"; };
  function fit(){
    const r = stage.getBoundingClientRect();
    if (r.width < 50 || r.height < 50) return;
    scale = Math.min(r.width / (WORLD_W + 80), r.height / (WORLD_H + 80), 1);
    if (r.width < 700) scale = Math.max(scale, 0.62);
    tx = (r.width - WORLD_W * scale) / 2;
    ty = (r.height - WORLD_H * scale) / 2;
    apply();
  }
  function edgePath(a, b){
    if (Math.abs(a.x - b.x) < 40) {
      const x = a.x + a.w / 2;
      const down = b.y >= a.y;
      const y1 = down ? a.y + a.h : a.y;
      const y2 = down ? b.y : b.y + b.h;
      const dy = Math.max(24, Math.abs(y2 - y1) * 0.4);
      return "M " + x + " " + y1 + " C " + x + " " + (y1 + (down ? dy : -dy)) + ", " + x + " " + (y2 + (down ? -dy : dy)) + ", " + x + " " + y2;
    }
    const leftToRight = a.x <= b.x;
    const x1 = leftToRight ? a.x + a.w : a.x;
    const x2 = leftToRight ? b.x : b.x + b.w;
    const y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.42);
    return "M " + x1 + " " + y1 + " C " + (x1 + (leftToRight ? dx : -dx)) + " " + y1 + ", " + (x2 + (leftToRight ? -dx : dx)) + " " + y2 + ", " + x2 + " " + y2;
  }
  function drawFlow(){
    const flow = D.flows.filter(function(f){ return f.id === flowId; })[0];
    if (!flow) return;
    $("flow-caption").textContent = flow.caption;
    let maxX = 0, maxY = 0;
    const byId = {};
    flow.nodes.forEach(function(n){
      byId[n.id] = n;
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    });
    WORLD_W = maxX + 80; WORLD_H = maxY + 80;
    world.style.width = WORLD_W + "px";
    world.style.height = WORLD_H + "px";
    svg.setAttribute("width", WORLD_W);
    svg.setAttribute("height", WORLD_H);
    svg.innerHTML = "";
    world.querySelectorAll(".node").forEach(function(n){ n.remove(); });
    flow.edges.forEach(function(ed){
      const a = byId[ed[0]], b = byId[ed[1]];
      if (!a || !b) return;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", edgePath(a, b));
      svg.appendChild(p);
      if (ed[2]) {
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("class", "elab");
        t.setAttribute("x", (a.x + a.w / 2 + b.x + b.w / 2) / 2);
        t.setAttribute("y", (a.y + a.h / 2 + b.y + b.h / 2) / 2 - 6);
        t.setAttribute("text-anchor", "middle");
        t.textContent = ed[2];
        svg.appendChild(t);
      }
    });
    flow.nodes.forEach(function(n){
      const e = info(n.key) || {};
      const el = document.createElement("button");
      el.type = "button";
      el.className = "node" + (n.cls ? " " + n.cls : "");
      el.setAttribute("data-path", n.key);
      el.style.left = n.x + "px";
      el.style.top = n.y + "px";
      el.style.width = n.w + "px";
      el.style.minHeight = n.h + "px";
      el.innerHTML = "<span class='handle in'></span><span class='handle out'></span>" +
        "<span class='hd'><span class='dot l-" + (e.l || "local") + "'></span>" +
        "<span class='kind'>" + esc(D.kindHe[e.k] || "") + "</span></span>" +
        "<h3" + (/[/.()]/.test(n.he) || /^[A-Za-z]/.test(n.he) ? " dir='ltr'" : "") + ">" + esc(n.he) + "</h3>" +
        "<span class='en'>" + esc(n.meta || e.m || "") + "</span>";
      el.addEventListener("click", function(){ openExplain(n.key); });
      world.appendChild(el);
    });
  }
  drawFlow();

  let drag = null;
  stage.addEventListener("pointerdown", function(e){
    if (e.target.closest(".node,.btn,.chip")) return;
    drag = { x: e.clientX - tx, y: e.clientY - ty };
    stage.classList.add("dragging");
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", function(e){
    if (!drag) return;
    tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply();
  });
  const endDrag = function(){ drag = null; stage.classList.remove("dragging"); };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("wheel", function(e){
    e.preventDefault();
    const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const ns = Math.min(1.9, Math.max(0.28, scale * (e.deltaY < 0 ? 1.11 : 0.9)));
    tx = mx - (mx - tx) * (ns / scale); ty = my - (my - ty) * (ns / scale); scale = ns; apply();
  }, { passive: false });
  const zoomBy = function(k){
    const r = stage.getBoundingClientRect(), mx = r.width/2, my = r.height/2;
    const ns = Math.min(1.9, Math.max(0.28, scale * k));
    tx = mx - (mx - tx) * (ns / scale); ty = my - (my - ty) * (ns / scale); scale = ns; apply();
  };
  $("zin").onclick = function(){ zoomBy(1.2); };
  $("zout").onclick = function(){ zoomBy(1/1.2); };
  $("zfit").onclick = fit;
  window.addEventListener("resize", function(){
    if ($("p-flow").classList.contains("on")) fit();
  });

  /* theme */
  $("theme").onclick = function(){
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : cur === "light" ? null : (matchMedia("(prefers-color-scheme:dark)").matches ? "light" : "dark");
    if (next) document.documentElement.setAttribute("data-theme", next);
    else document.documentElement.removeAttribute("data-theme");
  };
})();
`;

const genLine = `נסרק ${generatedAt} · <code>${payload.head}</code> · ענף <code>${payload.branch}</code> · הרצה חוזרת: <code>npm run map</code>`;

const html = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>מפת אריות ציון</title>
<style>${CSS}</style></head><body>
<header class="top">
  <div class="top-in">
    <div class="brand">
      <h1>מפת אריות ציון</h1>
      <span class="sub">כל קובץ במאגר, מה תפקידו, ואיך הוא זורם</span>
    </div>
    <div class="tabs" role="tablist">
      <button class="tab" type="button" role="tab" data-mode="list" aria-selected="true">מצב רשימה</button>
      <button class="tab" type="button" role="tab" data-mode="flow" aria-selected="false">מצב תרשים</button>
    </div>
    <input class="search" id="q" type="search" placeholder="חיפוש קובץ, תיקייה או רעיון…" autocomplete="off">
    <button class="btn" id="theme" type="button">ערכת צבע</button>
  </div>
  <div class="meta-in">
    <p class="gen">${genLine}</p>
    <div class="stats">
      <span class="stat" id="stat-files"></span>
      <span class="stat" id="stat-bytes"></span>
      <span class="stat" id="stat-arch"></span>
      <span class="stat" id="stat-api"></span>
      <span class="stat" id="stat-tests"></span>
      <span class="stat" id="stat-mig"></span>
      <span class="stat" id="stat-npm"></span>
    </div>
  </div>
</header>
<main>
  <section class="panel on" id="p-list">
    <div class="list-scroll">
      <div class="list-in">
        <details class="scan-box" id="scan-box">
          <summary id="scan-sum">בדיקות סריקה</summary>
          <ul class="findings" id="findings"></ul>
        </details>
        <p class="tree-hint">לחיצה על שם פותחת חלון הסבר. החץ פותח את התיקייה. ★ הוא מקור אמת.</p>
        <div class="tree-tools">
          <button class="btn" type="button" id="expand">פתח הכל</button>
          <button class="btn" type="button" id="collapse">כווץ הכל</button>
        </div>
        <div class="tree" id="tree"></div>
        <p class="empty" id="empty" hidden></p>
        <p class="secsub" style="margin-top:28px;color:var(--text-dim);font-size:13px">נוצר אוטומטית — לא נכנס לגיט</p>
        <div class="gens" id="gens"></div>
      </div>
    </div>
  </section>
  <section class="panel" id="p-flow">
    <div class="flow-bar" id="flow-bar"></div>
    <p id="flow-caption"></p>
    <div class="stage" id="stage">
      <div class="world" id="world"><svg class="edges" id="edges"></svg></div>
      <div class="zoom">
        <button class="btn" type="button" id="zin">+</button>
        <button class="btn" type="button" id="zout">−</button>
        <button class="btn" type="button" id="zfit">התאם</button>
      </div>
    </div>
  </section>
</main>
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" tabindex="-1" aria-label="חלון הסבר">
  <div class="dr-head">
    <button class="dr-close" id="dr-close" type="button" aria-label="סגירה">×</button>
    <div class="nm"><span class="dot" id="dr-dot"></span><span id="dr-kind"></span></div>
    <h2 id="dr-title"></h2>
    <div class="dr-en" id="dr-meta"></div>
  </div>
  <div class="dr-body" id="dr-body"></div>
</aside>
<script>
const DATA = ${JSON.stringify(payload).replace(/</g, "\\u003c")};
${CLIENT}
</script></body></html>`;

const OUT = OUT_PATH;

function toFragment(doc) {
  const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?' +
    'family=IBM+Plex+Sans+Hebrew:wght@400;500;600;700;800&display=swap">';
  const title = doc.match(/<title>[\s\S]*?<\/title>/)[0];
  const style = doc.match(/<style>[\s\S]*?<\/style>/)[0];
  const body  = doc.slice(doc.indexOf("<body>") + 6, doc.lastIndexOf("</body>"));
  return `${title}\n${FONTS}\n${style}\n<div dir="rtl">${body}</div>`;
}

if (process.argv.includes("--check")) {
  const cur = read(OUT);
  /* Normalise away BOTH places the generation stamp appears, not just the
     visible one. It is also embedded in the DATA payload as `"head"`, and
     leaving that in made the check unsatisfiable: you regenerate the map,
     commit it, and the commit itself changes HEAD — so the very act of
     committing an up-to-date map made it report as out of date. The check is
     about the repository's structure, and the SHA is metadata about when the
     scan ran, not part of that structure. */
  const norm = (t) => t
    .replace(/נסרק [\d-]+ [\d:]+ · <code>[0-9a-f]+<\/code>[^<]*<code>[^<]*<\/code>/, "")
    .replace(/"head":"[0-9a-f]+"/, '"head":""');
  if (norm(cur) !== norm(html)) {
    console.error("project-map.html is out of date — run: npm run map");
    process.exit(1);
  }
  console.log("project-map.html is up to date");
} else if (process.argv.includes("--artifact")) {
  const dest = process.argv[process.argv.indexOf("--artifact") + 1] || "project-map.artifact.html";
  writeFileSync(dest, toFragment(html));
  console.log(`${dest} — artifact fragment, ${Object.keys(E).length} explained nodes`);
} else {
  writeFileSync(R(OUT), html);
  console.log(`${OUT} — ${files.length} files, ${dirSet.size} dirs, ` +
    `${Object.keys(E).length} explained nodes, ${FLOWS.length} flows`);
  if (violations.length) console.warn(`  warning: ${violations.length} import-boundary violations`);
  if (handWrittenAfterSnapshot.length)
    console.warn(`  warning: newest snapshot is ${String(newestSnapshot).padStart(4,"0")}, ` +
      `behind ${handWrittenAfterSnapshot.length} hand-written migration(s)`);
  if (duplicateSets.length) console.warn(`  warning: ${duplicateSets.length} set(s) of byte-identical files`);
  if (docProblems.length) console.warn(`  warning: ${docProblems.length} dead reference(s) in documentation`);
  if (dsProblems.length) console.warn(`  warning: ${dsProblems.length} design-system prop contract(s) drifted`);
  if (unreferenced.length) console.warn(`  note: ${unreferenced.length} file(s) reached by nothing — ${reached.size}/${files.length} reachable`);
}
