import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { freshDatabase } from "@/server/db/testing";

/**
 * The two ways migrations are applied must agree.
 *
 * `drizzle-kit migrate` — the production path — applies only what is listed in
 * `meta/_journal.json`. The test harness applies every `.sql` file in filename
 * order. A hand-written migration that never makes it into the journal is
 * therefore applied in tests and silently skipped in production, which means
 * the suite proves a guarantee the deployed database does not have.
 *
 * That already happened once: the append-only triggers existed only as a file.
 * This test is why it cannot happen quietly again.
 */

const DIR = join(process.cwd(), "server", "db", "migrations");

type Journal = { entries: { idx: number; tag: string }[] };

async function journal(): Promise<Journal> {
  return JSON.parse(await readFile(join(DIR, "meta", "_journal.json"), "utf8")) as Journal;
}

async function sqlFiles(): Promise<string[]> {
  return (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();
}

describe("migration integrity", () => {
  it("applies the complete migration journal to a fresh PostgreSQL-compatible database", async () => {
    const database = await freshDatabase();
    const result = await database.execute<{ currentDatabase: string }>("SELECT current_database() AS \"currentDatabase\"");
    expect(result.rows[0]?.currentDatabase).toBeTruthy();
  });

  it("journals every SQL file on disk", async () => {
    const tags = new Set((await journal()).entries.map((e) => e.tag));
    const orphans = (await sqlFiles())
      .map((f) => f.replace(/\.sql$/, ""))
      .filter((tag) => !tags.has(tag));
    expect(
      orphans,
      "these migrations exist on disk but not in meta/_journal.json, so " +
        "`drizzle-kit migrate` would skip them in production while the tests apply them",
    ).toEqual([]);
  });

  it("has a file on disk for every journal entry", async () => {
    const files = new Set((await sqlFiles()).map((f) => f.replace(/\.sql$/, "")));
    const missing = (await journal()).entries.map((e) => e.tag).filter((tag) => !files.has(tag));
    expect(missing, "journalled migrations with no file would fail on deploy").toEqual([]);
  });

  it("numbers files uniquely and in journal order", async () => {
    const files = await sqlFiles();
    const prefixes = files.map((f) => f.slice(0, 4));
    expect(new Set(prefixes).size, `duplicate migration numbers: ${files.join(", ")}`).toBe(
      files.length,
    );
    expect(files.map((f) => f.replace(/\.sql$/, ""))).toEqual(
      (await journal()).entries.sort((a, b) => a.idx - b.idx).map((e) => e.tag),
    );
  });

  it("separates statements so plpgsql bodies survive", async () => {
    /* Splitting on semicolons would tear a function body in half at its first
       internal statement. Every file carrying a `$$` body must therefore use
       drizzle's explicit breakpoint marker. */
    for (const file of await sqlFiles()) {
      const text = await readFile(join(DIR, file), "utf8");
      if (text.includes("$$")) {
        expect(text, `${file} defines a function but has no statement breakpoints`).toContain(
          "--> statement-breakpoint",
        );
      }
    }
  });
});
