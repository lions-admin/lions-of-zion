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

describe("the console's added reads", () => {
  const overview = read("app/admin/OverviewPanel.tsx");
  const pipeline = read("app/admin/PipelinePanel.tsx");

  it("keeps the new overview regions off the area's poll budget", () => {
    /* The overview declares three 30s polls — summary, briefing, status.
       The costs meters and the outbox backlog are mount + signal only, so
       opening the console adds no route to the timer. */
    expect(overview).toContain('useConsoleRead<ConsoleCosts>("admin/console/costs", { signal });');
    expect(overview).toContain('useConsoleRead<ConsoleIncidents>("admin/console/incidents", { signal });');
    expect(overview.match(/pollInterval: OVERVIEW_POLL_MS/g)).toHaveLength(3);
  });

  it("reads the draft preview pre-contract, held until its region is opened", () => {
    expect(pipeline).toContain("useConsoleRead<DraftPreview>(");
    expect(pipeline).toContain("`admin/briefing/draft?date=${encodeURIComponent(draftDate)}`");
    expect(pipeline).toContain("{ signal, enabled: draftOpen }");
    /* "Today" is the server's own Israel-local date, mirrored in the
       wire-shape module because `app/**` cannot import the briefing module. */
    expect(read("app/admin/briefing-shapes.ts")).toContain('timeZone: "Asia/Jerusalem"');
  });
});

describe("the drilldown, fetch-log and recovery reads (source)", () => {
  /* The P1 wave's regions, pinned the same way the earlier ones are:
     structurally over the sources, because the panels render skeletons until
     their effects run. What is pinned is which payload each region reads,
     through which gate, and which route each control calls. */

  const pipeline = read("app/admin/PipelinePanel.tsx");
  const sources = read("app/admin/SourcesPanel.tsx");
  const system = read("app/admin/SystemPanel.tsx");
  const lexicon = read("app/admin/lexicon.ts");

  it("holds the edition drilldown until one edition is asked, and opens it as an end-edge drawer", () => {
    expect(pipeline).toContain("useConsoleRead<ConsoleEditionDrilldown>(");
    expect(pipeline).toContain("`admin/console/editions/${encodeURIComponent(localDate)}`");
    expect(pipeline).toContain("enabled: localDate !== null");
    expect(pipeline).toContain('variant="drawer"');
  });

  it("surfaces every piece of the drilldown payload the contract carries", () => {
    for (const piece of ["drill.value.edition", "drill.value.runs", "drill.value.runAi", "drill.value.artifacts", "drill.value.claims", "drill.value.jobs"]) {
      expect(pipeline, piece).toContain(piece);
    }
    /* The artifact's payload is the expandable JSON; the hash is truncated,
       not shown whole. */
    expect(pipeline).toContain("inputHash.slice(0, 12)");
    expect(pipeline).toContain("JSON.stringify(artifact.payload, null, 2)");
  });

  it("holds the fetch log until one source is asked, and reads today's rollup from the same payload", () => {
    expect(sources).toContain("useConsoleRead<ConsoleSourceFetches>(");
    expect(sources).toContain("`admin/console/sources/${source.id}/fetches?limit=50`");
    expect(sources).toContain("enabled: source !== null");
    for (const piece of ["fetches.value.fetches", "fetches.value.today"]) {
      expect(sources, piece).toContain(piece);
    }
  });

  it("drains the outbox and runs the maintenance tick straight through the shared operation state", () => {
    expect(system).toContain('"admin/console/outbox/drain"');
    expect(system).toContain('"admin/console/maintenance/tick"');
    /* Both are reversible, so neither opens a confirmation: the handler is
       `ops.run` alone. */
    for (const handler of ["drainOutboxNow", "runMaintenanceTick"]) {
      const declared = system.indexOf(`function ${handler}`);
      expect(declared, `${handler} exists`).toBeGreaterThan(-1);
      const body = system.slice(declared, system.indexOf("\n  }", declared));
      expect(body, `${handler} runs through ops.run`).toContain("ops.run(");
      expect(body, `${handler} asks for nothing`).not.toContain("setConfirmIntent(");
    }
  });

  it("resolves a quarantined row without asking, and discards only through the shared confirmation with a required note", () => {
    expect(system).toContain("`admin/console/quarantine/${entry.id}/resolve`");
    expect(system).toContain("`admin/console/quarantine/${entry.id}/discard`");

    const resolveDeclared = system.indexOf("function resolveQuarantine");
    const resolveBody = system.slice(resolveDeclared, system.indexOf("\n  }", resolveDeclared));
    expect(resolveBody).toContain("ops.run(");
    expect(resolveBody).not.toContain("setConfirmIntent(");

    const discardDeclared = system.indexOf("function requestDiscard");
    expect(discardDeclared, "requestDiscard exists").toBeGreaterThan(-1);
    const body = system.slice(discardDeclared, system.indexOf("\n  }", discardDeclared));
    expect(body).toContain("setConfirmIntent(");
    expect(body).toMatch(/tone:\s*"danger"/);
    expect(body, "the note field is required and bounded like the route's schema").toMatch(/required/);
    expect(body).toContain("maxLength={500}");
    /* The route refuses an empty note; the client refuses it first, before
       anything is sent. */
    expect(system).toMatch(/noteRef\.current\.trim\(\)/);
    expect(system).toMatch(/if \(!note\) throw/);
    expect(system).toContain("body: { note },");
  });

  it("routes the collect sweep through the shared confirmation and surfaces its counts", () => {
    expect(sources).toContain('"admin/console/sources/collect-sweep"');
    const declared = sources.indexOf("function requestSweep");
    expect(declared, "requestSweep exists").toBeGreaterThan(-1);
    const body = sources.slice(declared, sources.indexOf("\n  }", declared));
    expect(body).toContain("setConfirmIntent(");
    for (const piece of ["result.enqueued", "result.alreadyCompleted", "result.dispatchFailed"]) {
      expect(sources, piece).toContain(piece);
    }
  });

  it("keeps the new label maps in the lexicon, each holding Hebrew", () => {
    for (const name of ["RUN_STATUS_LABEL", "CLAIM_LAYER_LABEL", "ASSESSMENT_LABEL", "FETCH_STATUS_LABEL"]) {
      const map = lexicon.slice(lexicon.indexOf(`export const ${name}`));
      expect(map.startsWith("export const"), `${name} is a lexicon export`).toBe(true);
      const body = map.slice(0, map.indexOf("};"));
      expect(body, `${name} holds Hebrew`).toMatch(/[֐-׿]/);
    }
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

describe("the final wave's sub-tabs (source)", () => {
  /* The four SystemPanel sub-tabs the last UI wave added, pinned the way
     every other region is: structurally over the sources. What is pinned is
     which payload each sub-tab reads, that it mounts visit-once like the
     other seven, that the keyset pages append through the cursor, and that
     the one dangerous control per area is placed last in it. */
  const system = read("app/admin/SystemPanel.tsx");
  const reports = read("app/admin/ReportsSection.tsx");
  const threads = read("app/admin/ChatThreadsSection.tsx");
  const prompts = read("app/admin/PromptsSection.tsx");
  const lineage = read("app/admin/LineageSection.tsx");
  const chat = read("app/admin/OpsChat.tsx");
  const lexicon = read("app/admin/lexicon.ts");

  it("mounts the four new sub-tabs visit-once and names them from the lexicon", () => {
    for (const [key, entry] of [
      ["reports", "reportsTab"],
      ["chat", "chatTab"],
      ["prompts", "promptsTab"],
      ["lineage", "lineageTab"],
    ] as const) {
      expect(system, `${key} is a sub-area key`).toContain(`"${key}"`);
      expect(system, `${key} is gated on first visit`).toContain(`visited.has("${key}")`);
      expect(system, `${key} is labelled from the lexicon`).toContain(`label: T.${entry}`);
      const named = lexicon.slice(lexicon.indexOf(`${entry}:`));
      expect(named.slice(0, named.indexOf("\n")), `${entry} holds Hebrew`).toMatch(/[֐-׿]/);
    }
  });

  it("pages the reports desk by keyset and appends through nextCursor", () => {
    expect(reports).toContain("`admin/console/reports?${params.toString()}`");
    expect(reports).toContain('params.set("cursor", cursor)');
    for (const piece of ["page.reports", "page.nextCursor"]) {
      expect(reports, piece).toContain(piece);
    }
    expect(reports).toContain("T.loadOlder");
    /* The triage actions go to the staff route, exactly as it is mounted. */
    expect(reports).toContain("`reports/${report.id}/triage`");
  });

  it("confirms close and reject — the two moves that demand a note — and asks nothing for the internal moves", () => {
    const declared = reports.indexOf("function requestDecision");
    expect(declared, "requestDecision exists").toBeGreaterThan(-1);
    const body = reports.slice(declared, reports.indexOf("\n  }", declared));
    expect(body).toContain("setConfirmIntent(");
    expect(body).toMatch(/tone:\s*"danger"/);
    expect(body, "the note field is required like the route's schema").toMatch(/required/);
    expect(reports).toMatch(/noteRef\.current\.trim\(\)/);
    expect(reports).toMatch(/if \(!note\) throw/);
    expect(reports).toContain("body: { to, resolutionNote: note },");

    const transferDeclared = reports.indexOf("async function transfer");
    const transferBody = reports.slice(transferDeclared, reports.indexOf("\n  }", transferDeclared));
    expect(transferBody).toContain("ops.run(");
    expect(transferBody).not.toContain("setConfirmIntent(");
  });

  it("pages the chat threads by keyset and holds each transcript until its thread is expanded", () => {
    expect(threads).toContain("`admin/console/chat/threads/${thread.id}/transcript`");
    expect(threads).toContain('params.set("cursor", cursor)');
    for (const piece of ["page.threads", "page.nextCursor"]) {
      expect(threads, piece).toContain(piece);
    }
    expect(threads).toContain("T.loadOlder");
    /* The transcript is a held read: idle until the expander is pressed,
       kept once it arrives. */
    expect(threads).toMatch(/kind: "idle"/);
    expect(threads).toContain("transcript.kind === \"ready\" || transcript.kind === \"loading\"");
  });

  it("routes the archive through the shared confirmation, danger, as the thread row's last control", () => {
    const declared = threads.indexOf("function requestArchive");
    expect(declared, "requestArchive exists").toBeGreaterThan(-1);
    const body = threads.slice(declared, threads.indexOf("\n  }", declared));
    expect(body).toContain("setConfirmIntent(");
    expect(body).toMatch(/tone:\s*"danger"/);
    expect(threads).toContain("`admin/console/chat/threads/${thread.id}/archive`");

    /* At the granularity that exists: the archive control comes after the
        transcript toggle on the row, and only on a thread not yet archived. */
    const row = threads.slice(threads.indexOf("function ThreadRow"));
    expect(row.indexOf("aria-expanded={open}")).toBeLessThan(row.indexOf('variant="danger"'));
  });

  it("inserts prompt versions through the append-only note and activates only through the shared confirmation", () => {
    expect(prompts).toContain('"admin/console/ai/prompts"');
    expect(prompts).toContain('"admin/console/ai/prompts/activate"');
    expect(prompts).toContain("T.insertPromptNote");

    const declared = prompts.indexOf("function requestActivate");
    expect(declared, "requestActivate exists").toBeGreaterThan(-1);
    const body = prompts.slice(declared, prompts.indexOf("\n  }", declared));
    expect(body).toContain("setConfirmIntent(");
    expect(body).toMatch(/tone:\s*"danger"/);
    /* The consequence names what activation actually changes: what every
       future model call sees. */
    expect(prompts).toContain("T.activatePromptConsequence");
    expect(lexicon).toContain("קריאת מודל עתידית");
  });

  it("holds both lineage lookups until submitted, and names the second cause of their 404", () => {
    expect(lineage).toContain("`admin/console/entities/${entityType}/${id}/versions?limit=50`");
    expect(lineage).toContain("`admin/console/evidence/${id}/provenance`");
    expect(lineage).toMatch(/kind: "idle"/);
    expect(lineage).toContain("<InlineAbsence");
    expect(lineage).toContain("ABSENCE.lineageAbsent");
    expect(lineage).toContain("ABSENCE.provenanceAbsent");
  });

  it("surfaces Agent Search's recorded spend beside the estimate, with the absent-not-zero wording", () => {
    const sources = read("app/admin/SourcesPanel.tsx");
    expect(sources).toContain('"admin/console/costs"');
    expect(sources).toContain("T.actualSearchSpend");
    expect(sources).toMatch(/actualSpendUsd === undefined \? T\.notRecorded : formatUsd/);
    expect(system).toMatch(/actualSpendUsd === undefined \? T\.notRecorded : formatUsd/);
  });

  it("renders the turn's recorded cost on the tool chip when the turn carries it", () => {
    expect(chat).toMatch(/call\.costUsd !== undefined/);
    expect(chat).toContain("formatUsd(call.costUsd)");
  });

  it("adds the internals read to the environment sub-area, semantic arm included", () => {
    expect(system).toContain('"admin/console/system-internals"');
    for (const piece of ["internals.value.embeddingBacklog", "internals.value.semanticArm", "internals.value.embeddingRuns", "internals.value.publicReadCache"]) {
      expect(system, piece).toContain(piece);
    }
    expect(system).toContain("T.lexicalOnly");
    expect(system).toContain("T.semanticEngaged");
  });
});
