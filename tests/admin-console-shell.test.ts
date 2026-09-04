import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OPS_TOOLS, CONFIRMED_OPS_TOOLS } from "@/server/contracts/admin-console";
import { AREA_LABEL } from "@/app/admin/lexicon";

/**
 * The console shell, and the one property the operations chat exists to have.
 *
 * `tests/admin-console.test.ts` covers the confirmation contract, focus and
 * keyboard order across every area. This file covers what the rebuild added:
 * five areas behind a manual-activation tab row, a docked chat, and a
 * client that treats a proposal as a proposal.
 *
 * These are structural assertions over the sources rather than rendered
 * markup, and are named as such: the shell renders skeletons until its
 * effects run, and the properties below are about which code paths exist,
 * which is not something a first paint can show.
 *
 * The console reads in Hebrew, and nothing below hard-codes a Hebrew string.
 * The words come from `app/admin/lexicon.ts`, which is where they are
 * decided, so rewording an area does not break a test that was never about
 * the wording. What is pinned instead is that the five areas are wired to the
 * five lexicon entries and that those entries actually hold Hebrew — an area
 * quietly reverting to English is the failure this still has to catch.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const uncommented = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("the shell", () => {
  const shell = read("app/admin/OperationsConsole.tsx");
  const page = read("app/admin/page.tsx");

  it("mounts five areas and the docked chat", () => {
    /* Each area takes its label from the lexicon rather than a literal, so
       the five words are decided in one place and the panels can head
       themselves with the same ones. */
    for (const key of ["overview", "pipeline", "sources", "editorial", "system"] as const) {
      expect(shell, `${key} is an area`).toContain(`label: AREA_LABEL.${key}`);
      expect(AREA_LABEL[key], `${key} is named in Hebrew`).toMatch(/[֐-׿]/);
    }
    expect(Object.keys(AREA_LABEL), "five areas, no more").toHaveLength(5);
    /* Docked, not tabbed: it is the surface used while reading another. */
    expect(shell).toContain("<OpsChat");
    expect(shell).not.toMatch(/<Tab value="chat"/);
  });

  it("gives each area the same reload signal, so a chat action refreshes what is on screen", () => {
    /* A counter rather than a flag: two changes in a row are two reloads. */
    expect(shell).toMatch(/setSignal\(\(current\) => current \+ 1\)/);
    for (const panel of ["OverviewPanel", "PipelinePanel", "SourcesPanel", "EditorialDesk", "SystemPanel"]) {
      expect(shell, `${panel} takes the signal`).toContain(`<${panel} signal={signal} />`);
    }
    expect(shell).toContain("onStateChanged={reloadActiveArea}");
  });

  it("declares the console's language and direction, and keeps the sign-out control mounted", () => {
    /* The console is the owner's own operating surface and reads in Hebrew.
       `dir` is asserted alongside `lang` because a Hebrew page left in a
       left-to-right run is the actual bug: every label lands on the wrong
       side of the thing it labels, and it reads as broken CSS rather than as
       a missing attribute. ADMIN-002's sign-out slot survived the rebuild —
       it was written once before and mounted nowhere. */
    expect(page).toContain('lang="he"');
    expect(page).toContain('dir="rtl"');
    expect(page).toContain("<SignOutButton />");
  });
});

describe("the operations chat", () => {
  const chat = read("app/admin/OpsChat.tsx");
  const code = uncommented(chat);

  it("answers every proposal, including the one the operator dismisses", () => {
    /* A proposal left unanswered sits signed and valid for ten minutes, and
       the audit log would record that the assistant asked and nothing
       happened — which is not the same as recording that a person said no. */
    expect(code).toContain("onDismiss.current()");
    expect(code).toMatch(/decide\(false\)/);
    expect(code).toMatch(/decide\(true\)/);
    /* And exactly once: an approved proposal must not also send a decline
       when its dialog unmounts. */
    expect(code).toContain("if (decided.current) return;");
  });

  it("routes a proposal through the shared confirmation, never a bespoke one", () => {
    expect(code).toContain("setConfirmIntent(");
    expect(code).toContain("consequence: next.consequence");
    expect(code).toContain("target: next.target");
    expect(code).not.toMatch(/(?<![.\w])confirm\s*\(/);
  });

  it("guards every storage access, so a private window is not a broken chat", () => {
    /* `localStorage` throws rather than returning null in a browser set to
       block site data, and a thrown getter in a render is a blank console. */
    const accesses = [...code.matchAll(/window\.localStorage\.\w+\(/g)];
    expect(accesses.length).toBeGreaterThanOrEqual(3);
    for (const access of accesses) {
      const before = code.slice(Math.max(0, access.index! - 400), access.index!);
      expect(before, `${access[0]} is inside a try`).toMatch(/try\s*\{[^}]*$/);
    }
  });

  it("treats a missing endpoint as a state with words, not a broken composer", () => {
    expect(code).toContain("RouteUnavailable");
    /* The words are Hebrew now, so what is pinned is the shape rather than
       the sentence: the 404 branch renders a named `StatusState` of its own
       instead of falling through to a composer that cannot send. */
    expect(code).toMatch(/if \(unavailable\)/);
    expect(code).toMatch(/absenceStatus\("unavailable"\)/);
    /* The composer cannot be used before capabilities arrive, so a send can
       never be attempted against a route that answered 404. */
    expect(code).toMatch(/disabled=\{sending \|\| !capabilities\}/);
  });

  it("sends the transcript back, because the server holds no conversation state", () => {
    expect(code).toContain("history:");
    expect(code).toContain("confirmations: decisions");
  });
});

describe("what the console tells the operator the assistant can do", () => {
  it("shows every tool, and marks the ones that will ask first", () => {
    const chat = read("app/admin/OpsChat.tsx");
    /* Read from the server's own capability list rather than a copy in the
       client — a hard-coded list is a list that goes stale silently. */
    expect(chat).toContain("capabilities.tools.map");
    expect(chat).toContain("tool.requiresConfirmation");
    /* Two names per tool, and both are shown. `tool.label` is the Hebrew one
       the operator reads; `tool.name` is the Latin identifier that appears in
       `audit_log`, which is what they grep for afterwards. Dropping either
       leaves the list unusable, in two different ways. `tool.description` is
       deliberately not rendered — it is English prompt text for the model. */
    expect(chat).toContain("{tool.label}");
    expect(chat).toContain("{tool.name}");
    expect(chat).not.toContain("{tool.description}");
  });

  it("has a contract where the confirmed tools are a subset of the tools", () => {
    for (const name of CONFIRMED_OPS_TOOLS) {
      expect(OPS_TOOLS, `${name} is a tool`).toContain(name);
    }
    /* Everything that reaches the public, spends the budget again, or cannot
       be undone. A tool dropping off this list is a tool the assistant can
       fire on its own. */
    for (const name of [
      "publish_publication",
      "unpublish_publication",
      "archive_publication",
      "delete_publication",
      "rollback_publication",
      "force_rerun",
      "pause_publication",
      "set_source_active",
    ] as const) {
      expect(CONFIRMED_OPS_TOOLS, `${name} asks first`).toContain(name);
    }
  });
});
