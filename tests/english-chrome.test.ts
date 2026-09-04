import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Two languages, one boundary, and the boundary is `app/admin/**`.
 *
 * **The public site is English.** Every page, every component, every string a
 * reader outside this organisation can reach. The root element is `lang="en"`
 * and stays that way.
 *
 * **The operations console is Hebrew.** It is the owner's own operating
 * surface — one account, nobody else signs into it — and it reads in the
 * language the owner operates in. `/admin/login` is the one exception inside
 * that directory and is left in English on purpose: it is read by whoever is
 * locked out, and by a password manager.
 *
 * The original version of this file forbade a Hebrew webfont outright. That
 * is no longer the rule and could not be: the console needs a Hebrew face, so
 * `app/layout.tsx` loads IBM Plex Sans Hebrew and declares it as
 * `--font-plex-sans-hebrew` on the root element. What replaced the ban is the
 * narrower property that was the point all along — the face is loaded but
 * wired into no global token, so nothing outside the console can render in
 * it. The first test below pins that shape rather than the absence.
 */

const ROOT = process.cwd();
const HEBREW = /[\u0590-\u05FF]/;
const ALLOWED_EXT = new Set([".tsx", ".ts", ".css"]);

/** The console. Hebrew is expected here and nowhere else under `app/`. */
const CONSOLE = `app${path.sep}admin${path.sep}`;

function walk(dir: string, into: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "data") continue;
      walk(full, into);
      continue;
    }
    if (ALLOWED_EXT.has(path.extname(name))) into.push(full);
  }
  return into;
}

function isQuotedSourceSpan(lines: string[], index: number): boolean {
  const window = lines.slice(Math.max(0, index - 6), index + 1).join("\n");
  return /lang=["']he["']/.test(window);
}

describe("English product chrome", () => {
  it("loads the Hebrew face for the console without wiring it into a site token", () => {
    const layout = readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
    const globals = readFileSync(path.join(ROOT, "app/globals.css"), "utf8");

    /* The face exists, because the console needs one. */
    expect(layout).toMatch(/IBM_Plex_Sans_Hebrew/);
    expect(layout).toMatch(/--font-plex-sans-hebrew/);

    /* And the root element stays English. A Hebrew webfont is a resource;
       `lang` is the claim about the document, and only that claim would make
       the public site Hebrew. */
    expect(layout).toMatch(/lang=["']en["']/);

    /* The face reaches exactly one consumer. `--face-text` and `--face-data`
       are what every public surface renders in, and neither may name the
       Hebrew variable: that single substitution is all it would take for the
       whole site to change face without one string changing. */
    const faceTokens = globals
      .split(/\n/)
      .filter((line) => /^\s*--face-(text|display|data)\s*:/.test(line));
    expect(faceTokens.length, "the three face tokens are declared in globals.css").toBe(3);
    for (const token of faceTokens) {
      expect(token, "no site face token reaches for the Hebrew webfont")
        .not.toMatch(/plex-sans-hebrew/);
    }
  });

  it("keeps Hebrew strings inside the console and out of the public site", () => {
    const files = [
      ...walk(path.join(ROOT, "app")),
      ...walk(path.join(ROOT, "components")),
    ];
    const hits: string[] = [];
    let consoleHebrew = 0;

    for (const file of files) {
      const rel = path.relative(ROOT, file);
      if (rel.startsWith(`app${path.sep}api${path.sep}`)) continue;
      const text = readFileSync(file, "utf8");
      const lines = text.split(/\n/);
      lines.forEach((line, i) => {
        if (!HEBREW.test(line)) return;
        if (isQuotedSourceSpan(lines, i)) return;
        const trimmed = line.trim();
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*") ||
          trimmed.startsWith("{/*")
        ) {
          return;
        }
        /* The console is the carve-out, and the only one. */
        if (rel.startsWith(CONSOLE)) {
          consoleHebrew += 1;
          return;
        }
        hits.push(`${rel}:${i + 1}:${trimmed.slice(0, 120)}`);
      });
    }

    expect(hits, hits.join("\n")).toEqual([]);
    /* The carve-out is not a hole nothing goes through: if the console ever
       stops being Hebrew, the assertion above would keep passing for the
       wrong reason, so the translation is pinned from this side too. */
    expect(consoleHebrew, "the operations console is translated").toBeGreaterThan(0);
  });

  it("keeps the sign-in surface English, because it is read by whoever is locked out", () => {
    /* `/admin/login` sits inside the console's directory and outside its
       language: a password manager, and an operator who cannot get in, are
       both better served by the language the rest of the deployment's
       tooling speaks. */
    for (const rel of ["app/admin/login/page.tsx", "app/admin/login/AdminLogin.tsx"]) {
      const source = readFileSync(path.join(ROOT, rel), "utf8");
      expect(source, `${rel} declares no Hebrew`).not.toMatch(/lang=["']he["']/);
      const strings = source
        .split(/\n/)
        .filter((line) => {
          const trimmed = line.trim();
          return (
            !trimmed.startsWith("//") &&
            !trimmed.startsWith("*") &&
            !trimmed.startsWith("/*") &&
            !trimmed.startsWith("{/*")
          );
        })
        .filter((line) => HEBREW.test(line));
      expect(strings, `${rel} has no Hebrew strings`).toEqual([]);
    }
  });
});
